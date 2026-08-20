import {
  DM_LIMITS,
  ERROR_CODES,
  MAX_MESSAGE_PREVIEW_LENGTH,
  type Conversation,
  type DirectMessage,
  type Page,
} from "@socialapp/shared"

import { buildPage, encodeKeysetCursor, parseKeysetCursor } from "../lib/cursor"
import { HttpError, badRequest, forbidden, notFound } from "../lib/errors"
import { prisma } from "../lib/prisma"
import {
  buildViewerContext,
  conversationInclude,
  directMessageInclude,
  toConversation,
  toDirectMessage,
  type ConversationWithRelations,
} from "../serializers"
import { isBlockedBetween } from "./relations.service"

// ---------------------------------------------------------------------------
// Spam control
// ---------------------------------------------------------------------------
//
// The goal is to stop floods without ever getting in the way of two people
// talking to each other. That splits into two very different problems, so it
// uses two very different mechanisms:
//
//   * Bursts are a *rate* problem. They are handled by token buckets kept in
//     memory, which reject a flood in microseconds, before a single query runs.
//     Losing them on restart is harmless: a burst is only meaningful within a
//     few seconds anyway.
//   * Spam is a *pattern* problem (many one sided threads, the same text over
//     and over). Those limits are computed from the database, so restarting the
//     process or rotating IP addresses cannot reset them.
//
// Note for a future multi replica deployment: the buckets are per process, so
// N replicas allow N times the burst. The durable limits below are unaffected.
// Moving the buckets to Redis is the only change needed (see lib/redis.ts).

interface TokenBucket {
  tokens: number
  updatedAt: number
}

const buckets = new Map<string, TokenBucket>()
let lastSweepAt = Date.now()

function sweepBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > 3_600_000) buckets.delete(key)
  }
}

/** Returns 0 when the message is allowed, otherwise the seconds left to wait. */
function takeToken(key: string, capacity: number, refillPerSecond: number): number {
  const now = Date.now()
  if (now - lastSweepAt > 300_000) {
    sweepBuckets(now)
    lastSweepAt = now
  }

  const bucket = buckets.get(key)
  if (!bucket) {
    buckets.set(key, { tokens: capacity - 1, updatedAt: now })
    return 0
  }

  const elapsedSeconds = (now - bucket.updatedAt) / 1000
  const refilled = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond)
  bucket.updatedAt = now

  if (refilled < 1) {
    bucket.tokens = refilled
    return Math.max(1, Math.ceil((1 - refilled) / refillPerSecond))
  }

  bucket.tokens = refilled - 1
  return 0
}

type LimitReason = "burst" | "sender" | "unanswered" | "new_conversations" | "duplicate"

function messageLimit(reason: LimitReason, retryAfterSeconds: number, message: string): HttpError {
  return new HttpError(429, ERROR_CODES.MESSAGE_RATE_LIMITED, message, {
    reason,
    retryAfterSeconds,
  })
}

/** Test seam: lets the suite start from a clean rate limiting state. */
export function resetMessageRateLimits(): void {
  buckets.clear()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function conversationPairKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(":")
}

function previewOf(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_PREVIEW_LENGTH)
}

async function loadConversation(
  viewerId: string,
  conversationId: string,
): Promise<ConversationWithRelations> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  })
  // Non participants get a 404 rather than a 403: the existence of a private
  // thread is itself information.
  if (!conversation) throw notFound("Conversation not found")
  if (!conversation.participants.some((row) => row.userId === viewerId)) {
    throw notFound("Conversation not found")
  }
  return conversation
}

function otherParticipant(conversation: ConversationWithRelations, viewerId: string) {
  const other = conversation.participants.find((row) => row.userId !== viewerId)
  if (!other) throw badRequest("You cannot message yourself")
  return other
}

async function conversationViewerContext(
  viewerId: string,
  userIds: string[],
): Promise<Awaited<ReturnType<typeof buildViewerContext>>> {
  return buildViewerContext(viewerId, { userIds })
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listConversations(args: {
  viewerId: string
  cursor?: string
  limit: number
}): Promise<Page<Conversation>> {
  const { viewerId, limit } = args
  const keyset = parseKeysetCursor(args.cursor)
  const before = keyset ? new Date(keyset.createdAt) : null

  const rows = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: viewerId, isArchived: false } },
      // Threads that were opened but never used stay out of the inbox.
      lastMessageAt: { not: null },
      ...(before && keyset
        ? {
            OR: [
              { lastMessageAt: { lt: before } },
              { lastMessageAt: before, id: { lt: keyset.id } },
            ],
          }
        : {}),
    },
    include: conversationInclude,
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  })

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeKeysetCursor({
          createdAt: (last.lastMessageAt ?? last.createdAt).toISOString(),
          id: last.id,
        })
      : null

  const otherIds = items.flatMap((row) =>
    row.participants.filter((p) => p.userId !== viewerId).map((p) => p.userId),
  )
  const context = await conversationViewerContext(viewerId, otherIds)

  return {
    items: items.map((row) => toConversation(row, viewerId, context)),
    nextCursor,
    hasMore,
  }
}

export async function getConversation(
  viewerId: string,
  conversationId: string,
): Promise<Conversation> {
  const conversation = await loadConversation(viewerId, conversationId)
  const context = await conversationViewerContext(viewerId, [
    otherParticipant(conversation, viewerId).userId,
  ])
  return toConversation(conversation, viewerId, context)
}

export async function listMessages(args: {
  viewerId: string
  conversationId: string
  cursor?: string
  limit: number
}): Promise<Page<DirectMessage>> {
  const { viewerId, conversationId, limit } = args
  await loadConversation(viewerId, conversationId)

  const keyset = parseKeysetCursor(args.cursor)
  const before = keyset ? new Date(keyset.createdAt) : null

  // Newest first, like every other timeline in the API. The client reverses the
  // page for rendering so "load older" is a plain cursor walk.
  const rows = await prisma.directMessage.findMany({
    where: {
      conversationId,
      ...(before && keyset
        ? {
            OR: [{ createdAt: { lt: before } }, { createdAt: before, id: { lt: keyset.id } }],
          }
        : {}),
    },
    include: directMessageInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  })

  const page = buildPage(rows, limit)
  const senderIds = [...new Set(page.items.map((row) => row.senderId))]
  const context = await conversationViewerContext(viewerId, senderIds)

  return {
    items: page.items.map((row) => toDirectMessage(row, viewerId, context)),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  }
}

export async function getUnreadCount(viewerId: string): Promise<number> {
  const result = await prisma.conversationParticipant.aggregate({
    _sum: { unreadCount: true },
    where: { userId: viewerId, isArchived: false },
  })
  return result._sum.unreadCount ?? 0
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Opens the thread with `username`, or returns the existing one. */
export async function startConversation(
  viewerId: string,
  username: string,
): Promise<Conversation> {
  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true, isActive: true },
  })
  if (!target || !target.isActive) throw notFound("That account does not exist")
  if (target.id === viewerId) throw badRequest("You cannot message yourself")
  if (await isBlockedBetween(viewerId, target.id)) {
    throw forbidden("You cannot message this account")
  }

  const pairKey = conversationPairKey(viewerId, target.id)
  const context = await conversationViewerContext(viewerId, [target.id])

  const existing = await prisma.conversation.findUnique({
    where: { pairKey },
    include: conversationInclude,
  })
  if (existing) return toConversation(existing, viewerId, context)

  try {
    const created = await prisma.conversation.create({
      data: {
        pairKey,
        participants: { create: [{ userId: viewerId }, { userId: target.id }] },
      },
      include: conversationInclude,
    })
    return toConversation(created, viewerId, context)
  } catch (error) {
    // Unique violation on pairKey: someone opened the same thread first.
    const raced = await prisma.conversation.findUnique({
      where: { pairKey },
      include: conversationInclude,
    })
    if (raced) return toConversation(raced, viewerId, context)
    throw error
  }
}

export async function sendMessage(args: {
  senderId: string
  conversationId: string
  content: string
}): Promise<{ message: DirectMessage; conversation: Conversation }> {
  const { senderId, conversationId } = args
  const content = args.content.trim()
  if (!content) throw badRequest("Write a message first")

  const conversation = await loadConversation(senderId, conversationId)
  const recipient = otherParticipant(conversation, senderId)

  if (await isBlockedBetween(senderId, recipient.userId)) {
    throw forbidden("You cannot send messages to this account")
  }

  await enforceSpamLimits({
    senderId,
    recipientId: recipient.userId,
    recipientUsername: recipient.user.username,
    conversationId,
    content,
  })

  const now = new Date()
  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.directMessage.create({
      data: { conversationId, senderId, content },
      include: directMessageInclude,
    })

    await tx.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: previewOf(content),
        lastMessageSenderId: senderId,
        messageCount: { increment: 1 },
      },
    })

    // Sending is an implicit read of everything before it.
    await tx.conversationParticipant.updateMany({
      where: { conversationId, userId: senderId },
      data: { unreadCount: 0, lastReadAt: now },
    })

    // A new message pulls the thread back out of the recipient's archive.
    await tx.conversationParticipant.updateMany({
      where: { conversationId, userId: recipient.userId },
      data: { unreadCount: { increment: 1 }, isArchived: false },
    })

    return message
  })

  const refreshed = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  })
  if (!refreshed) throw notFound("Conversation not found")

  const context = await conversationViewerContext(senderId, [recipient.userId])

  return {
    message: toDirectMessage(created, senderId, context),
    conversation: toConversation(refreshed, senderId, context),
  }
}

export async function markConversationRead(
  viewerId: string,
  conversationId: string,
): Promise<{ unreadCount: number }> {
  await loadConversation(viewerId, conversationId)
  const now = new Date()

  await prisma.$transaction([
    prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: viewerId },
      data: { unreadCount: 0, lastReadAt: now },
    }),
    prisma.directMessage.updateMany({
      where: { conversationId, senderId: { not: viewerId }, readAt: null },
      data: { readAt: now },
    }),
  ])

  return { unreadCount: 0 }
}

/** Soft deletes one of the viewer's own messages. */
export async function deleteMessage(viewerId: string, messageId: string): Promise<void> {
  const message = await prisma.directMessage.findUnique({
    where: { id: messageId },
    select: { id: true, senderId: true, conversationId: true, isDeleted: true },
  })
  if (!message) throw notFound("Message not found")
  if (message.senderId !== viewerId) throw forbidden("You can only delete your own messages")
  if (message.isDeleted) return

  const newest = await prisma.directMessage.findFirst({
    where: { conversationId: message.conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  })

  await prisma.$transaction(async (tx) => {
    await tx.directMessage.update({
      where: { id: message.id },
      data: { isDeleted: true, content: "" },
    })
    if (newest?.id === message.id) {
      await tx.conversation.update({
        where: { id: message.conversationId },
        data: { lastMessagePreview: null },
      })
    }
  })
}

// ---------------------------------------------------------------------------
// The limits themselves
// ---------------------------------------------------------------------------

async function enforceSpamLimits(args: {
  senderId: string
  recipientId: string
  recipientUsername: string
  conversationId: string
  content: string
}): Promise<void> {
  const { senderId, recipientId, recipientUsername, conversationId, content } = args

  // 1. Burst inside one conversation. 10 back to back messages then one per
  //    second: faster than anyone types, far slower than a script.
  const burstWait = takeToken(
    `conversation:${senderId}:${conversationId}`,
    DM_LIMITS.BURST_CAPACITY,
    DM_LIMITS.BURST_REFILL_PER_SECOND,
  )
  if (burstWait > 0) {
    throw messageLimit(
      "burst",
      burstWait,
      `You are sending messages too quickly. Try again in ${burstWait}s.`,
    )
  }

  // 2. Same sender across every conversation, so opening 50 threads does not
  //    multiply the budget.
  const senderWait = takeToken(
    `sender:${senderId}`,
    DM_LIMITS.SENDER_CAPACITY,
    DM_LIMITS.SENDER_REFILL_PER_SECOND,
  )
  if (senderWait > 0) {
    throw messageLimit(
      "sender",
      senderWait,
      `Too many messages in a short time. Try again in ${senderWait}s.`,
    )
  }

  const [repliesFromRecipient, myRecentMessages, recipientFollowsMe] = await Promise.all([
    prisma.directMessage.count({ where: { conversationId, senderId: recipientId } }),
    prisma.directMessage.findMany({
      where: { conversationId, senderId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: DM_LIMITS.DUPLICATE_STREAK_MAX,
      select: { content: true, createdAt: true },
    }),
    prisma.follow.findFirst({
      where: { followerId: recipientId, followingId: senderId },
      select: { id: true },
    }),
  ])

  // 3. Copy pasted floods, including slow ones that stay under the buckets.
  const normalized = content.toLowerCase()
  const duplicateWindowMs = DM_LIMITS.DUPLICATE_WINDOW_MINUTES * 60_000
  const isDuplicateStreak =
    myRecentMessages.length >= DM_LIMITS.DUPLICATE_STREAK_MAX &&
    myRecentMessages.every(
      (row) =>
        row.content.trim().toLowerCase() === normalized &&
        Date.now() - row.createdAt.getTime() < duplicateWindowMs,
    )
  if (isDuplicateStreak) {
    throw messageLimit(
      "duplicate",
      duplicateWindowMs / 1000,
      "You already sent this exact message several times. Wait for a reply before repeating it.",
    )
  }

  // A thread the other person answered, or one with someone who follows you, is
  // a real conversation. None of the durable limits below apply to it - only
  // the burst guard above, which no human types through.
  if (repliesFromRecipient > 0 || recipientFollowsMe) return

  // 4. One sided threads behave like a message request: a handful of messages,
  //    then it waits for an answer.
  const myMessages = await prisma.directMessage.count({ where: { conversationId, senderId } })
  if (myMessages >= DM_LIMITS.UNANSWERED_THREAD_MAX) {
    throw messageLimit(
      "unanswered",
      0,
      `You can send up to ${DM_LIMITS.UNANSWERED_THREAD_MAX} messages before @${recipientUsername} replies.`,
    )
  }

  // 5. Mass cold outreach: the quota is spent per new thread, not per message,
  //    so continuing an existing (still unanswered) thread never touches it.
  if (myMessages > 0) return

  const now = Date.now()
  const [startedLastHour, startedLastDay] = await Promise.all([
    countColdConversations(senderId, new Date(now - 3_600_000)),
    countColdConversations(senderId, new Date(now - 86_400_000)),
  ])

  if (startedLastHour >= DM_LIMITS.NEW_CONVERSATIONS_PER_HOUR) {
    throw messageLimit(
      "new_conversations",
      3600,
      `You can start ${DM_LIMITS.NEW_CONVERSATIONS_PER_HOUR} new conversations per hour. Threads that already have a reply are not affected.`,
    )
  }
  if (startedLastDay >= DM_LIMITS.NEW_CONVERSATIONS_PER_DAY) {
    throw messageLimit(
      "new_conversations",
      86_400,
      `You can start ${DM_LIMITS.NEW_CONVERSATIONS_PER_DAY} new conversations per day. Threads that already have a reply are not affected.`,
    )
  }
}

/**
 * Threads opened by this sender since `since` that nobody has answered yet.
 * Counted in the database on purpose: a restart or a new IP address cannot
 * reset it.
 */
function countColdConversations(senderId: string, since: Date): Promise<number> {
  return prisma.conversation.count({
    where: {
      createdAt: { gte: since },
      lastMessageSenderId: senderId,
      participants: { some: { userId: senderId } },
      messages: { none: { senderId: { not: senderId } } },
    },
  })
}

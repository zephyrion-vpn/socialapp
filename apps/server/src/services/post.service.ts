import { extractHashtags, extractMentions, type Post } from "@socialapp/shared"

import { badRequest, forbidden, notFound } from "../lib/errors"
import { buildPage, parseKeysetCursor } from "../lib/cursor"
import { prisma } from "../lib/prisma"
import { publicUrlFor } from "../lib/storage"
import {
  buildViewerContext,
  postInclude,
  toPost,
  toPosts,
  toPublicUser,
  userInclude,
  type PostWithRelations,
} from "../serializers"
import { getHiddenAuthorIds, isBlockedBetween } from "./relations.service"

export interface CreatePostArgs {
  authorId: string
  content: string
  visibility: "PUBLIC" | "FOLLOWERS" | "UNLISTED"
  parentId?: string | null
  quotedPostId?: string | null
  media: Array<{
    key: string
    altText?: string | null
    width?: number | null
    height?: number | null
    mimeType?: string | null
    sizeBytes?: number | null
  }>
}

function mediaTypeFor(mimeType?: string | null): "IMAGE" | "GIF" | "VIDEO" {
  if (!mimeType) return "IMAGE"
  if (mimeType === "image/gif") return "GIF"
  if (mimeType.startsWith("video/")) return "VIDEO"
  return "IMAGE"
}

export async function createPost(args: CreatePostArgs): Promise<Post> {
  const content = args.content.trim()

  // The client can only attach media it uploaded itself.
  for (const item of args.media) {
    if (!item.key.startsWith(`post/${args.authorId}/`)) {
      throw forbidden("This media does not belong to your account")
    }
  }

  let parent: { id: string; rootId: string | null; authorId: string; isDeleted: boolean } | null = null
  if (args.parentId) {
    parent = await prisma.post.findUnique({
      where: { id: args.parentId },
      select: { id: true, rootId: true, authorId: true, isDeleted: true },
    })
    if (!parent || parent.isDeleted) throw notFound("The post you are replying to no longer exists")
    if (await isBlockedBetween(args.authorId, parent.authorId)) {
      throw forbidden("You cannot reply to this post")
    }
  }

  let quoted: { id: string; authorId: string; isDeleted: boolean } | null = null
  if (args.quotedPostId) {
    quoted = await prisma.post.findUnique({
      where: { id: args.quotedPostId },
      select: { id: true, authorId: true, isDeleted: true },
    })
    if (!quoted || quoted.isDeleted) throw notFound("The quoted post no longer exists")
    if (await isBlockedBetween(args.authorId, quoted.authorId)) {
      throw forbidden("You cannot quote this post")
    }
  }

  const hashtags = extractHashtags(content)
  const mentions = extractMentions(content)
  const mentionedUsers = mentions.length
    ? await prisma.user.findMany({
        where: { username: { in: mentions }, id: { not: args.authorId } },
        select: { id: true },
      })
    : []

  const created = await prisma.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: {
        authorId: args.authorId,
        content,
        visibility: args.visibility,
        parentId: parent?.id ?? null,
        quotedPostId: quoted?.id ?? null,
        media: {
          create: args.media.map((item, index) => ({
            storageKey: item.key,
            url: publicUrlFor(item.key),
            type: mediaTypeFor(item.mimeType),
            mimeType: item.mimeType ?? null,
            sizeBytes: item.sizeBytes ?? null,
            width: item.width ?? null,
            height: item.height ?? null,
            altText: item.altText ?? null,
            position: index,
          })),
        },
      },
      select: { id: true },
    })

    // rootId: self for top level posts, inherited for replies.
    await tx.post.update({
      where: { id: post.id },
      data: { rootId: parent ? (parent.rootId ?? parent.id) : post.id },
    })

    await tx.profile.update({
      where: { userId: args.authorId },
      data: { postsCount: { increment: 1 } },
    })

    if (parent) {
      await tx.reply.create({
        data: { postId: parent.id, replyId: post.id, authorId: args.authorId },
      })
      await tx.post.update({
        where: { id: parent.id },
        data: { replyCount: { increment: 1 }, score: { increment: 2 } },
      })
      if (parent.authorId !== args.authorId) {
        await tx.notification.create({
          data: {
            recipientId: parent.authorId,
            actorId: args.authorId,
            type: "REPLY",
            postId: post.id,
          },
        })
      }
    }

    if (quoted) {
      await tx.post.update({
        where: { id: quoted.id },
        data: { repostCount: { increment: 1 }, score: { increment: 4 } },
      })
      if (quoted.authorId !== args.authorId) {
        await tx.notification.create({
          data: {
            recipientId: quoted.authorId,
            actorId: args.authorId,
            type: "QUOTE",
            postId: post.id,
          },
        })
      }
    }

    for (const tag of hashtags) {
      const hashtag = await tx.hashtag.upsert({
        where: { tag },
        create: { tag, postCount: 1, lastUsedAt: new Date() },
        update: { postCount: { increment: 1 }, lastUsedAt: new Date() },
      })
      await tx.postHashtag.create({ data: { postId: post.id, hashtagId: hashtag.id } })
    }

    for (const user of mentionedUsers) {
      await tx.notification.create({
        data: { recipientId: user.id, actorId: args.authorId, type: "MENTION", postId: post.id },
      })
    }

    return tx.post.findUniqueOrThrow({ where: { id: post.id }, include: postInclude })
  })

  const context = await buildViewerContext(args.authorId, { posts: [created] })
  const serialized = toPost(created, context)
  return { ...serialized, mentions }
}

export async function getPost(postId: string, viewerId?: string): Promise<Post> {
  const post = await prisma.post.findUnique({ where: { id: postId }, include: postInclude })
  if (!post || post.isDeleted) throw notFound("Post not found")

  if (viewerId && (await isBlockedBetween(viewerId, post.authorId))) {
    throw notFound("Post not found")
  }

  // Fire and forget view counter - never blocks the response.
  void prisma.post
    .update({ where: { id: postId }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined)

  const context = await buildViewerContext(viewerId, { posts: [post] })
  return toPost(post, context)
}

export async function deletePost(postId: string, viewerId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, parentId: true, isDeleted: true },
  })
  if (!post || post.isDeleted) throw notFound("Post not found")
  if (post.authorId !== viewerId) throw forbidden("You can only delete your own posts")

  // Soft delete keeps thread structure intact ("this post was deleted").
  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: { isDeleted: true, content: "", score: 0 },
    })
    await tx.postMedia.deleteMany({ where: { postId } })
    await tx.profile.update({
      where: { userId: viewerId },
      data: { postsCount: { decrement: 1 } },
    })
    if (post.parentId) {
      await tx.post.update({
        where: { id: post.parentId },
        data: { replyCount: { decrement: 1 } },
      })
    }
  })
}

export async function listReplies(args: {
  postId: string
  viewerId?: string
  cursor?: string
  limit: number
}) {
  const cursor = parseKeysetCursor(args.cursor)
  const hidden = await getHiddenAuthorIds(args.viewerId)

  const rows = await prisma.post.findMany({
    where: {
      parentId: args.postId,
      isDeleted: false,
      ...(hidden.length ? { authorId: { notIn: hidden } } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { gt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { gt: cursor.id } },
            ],
          }
        : {}),
    },
    include: postInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: args.limit + 1,
  })

  const page = buildPage(rows, args.limit)
  const context = await buildViewerContext(args.viewerId, { posts: page.items })
  return { items: toPosts(page.items, context), nextCursor: page.nextCursor, hasMore: page.hasMore }
}

/** Ancestors + the post itself + first page of replies - one thread view. */
export async function getThread(postId: string, viewerId?: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, include: postInclude })
  if (!post || post.isDeleted) throw notFound("Post not found")

  const ancestors: PostWithRelations[] = []
  let currentParentId = post.parentId
  let guard = 0
  while (currentParentId && guard < 20) {
    const parent: PostWithRelations | null = await prisma.post.findUnique({
      where: { id: currentParentId },
      include: postInclude,
    })
    if (!parent) break
    ancestors.unshift(parent)
    currentParentId = parent.parentId
    guard += 1
  }

  const replies = await listReplies({ postId, viewerId, limit: 20 })
  const context = await buildViewerContext(viewerId, { posts: [post, ...ancestors] })

  return {
    ancestors: toPosts(ancestors, context),
    post: toPost(post, context),
    replies,
  }
}

export async function listLikers(args: { postId: string; viewerId?: string; cursor?: string; limit: number }) {
  const cursor = parseKeysetCursor(args.cursor)
  const rows = await prisma.like.findMany({
    where: {
      postId: args.postId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    include: { user: { include: userInclude } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: args.limit + 1,
  })

  const page = buildPage(rows, args.limit)
  const context = await buildViewerContext(args.viewerId, {
    userIds: page.items.map((row) => row.userId),
  })
  return {
    items: page.items.map((row) => toPublicUser(row.user, context)),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  }
}

export function assertPostId(id?: string): string {
  if (!id) throw badRequest("Post id is required")
  return id
}

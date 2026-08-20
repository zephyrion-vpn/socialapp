import type { Page, Post, PublicUser } from "@socialapp/shared"

import { buildPage, parseKeysetCursor } from "../lib/cursor"
import { forbidden, notFound } from "../lib/errors"
import { prisma } from "../lib/prisma"
import { publicUrlFor } from "../lib/storage"
import {
  buildViewerContext,
  postInclude,
  toPosts,
  toPublicUser,
  userInclude,
  type PostWithRelations,
} from "../serializers"
import { getHiddenAuthorIds, isBlockedBetween } from "./relations.service"

async function findUserByUsername(username: string) {
  const user = await prisma.user.findUnique({ where: { username }, include: userInclude })
  if (!user || !user.isActive) throw notFound("This account does not exist")
  return user
}

export async function getProfile(username: string, viewerId?: string): Promise<PublicUser> {
  const user = await findUserByUsername(username)
  const context = await buildViewerContext(viewerId, { userIds: [user.id] })
  return toPublicUser(user, context)
}

export async function updateProfile(
  userId: string,
  input: {
    displayName?: string
    bio?: string | null
    location?: string | null
    website?: string | null
    avatarKey?: string | null
    bannerKey?: string | null
  },
): Promise<PublicUser> {
  // Storage keys are namespaced per user - reject anything else.
  for (const [field, key] of [
    ["avatarKey", input.avatarKey],
    ["bannerKey", input.bannerKey],
  ] as const) {
    if (!key) continue
    const prefix = field === "avatarKey" ? `avatar/${userId}/` : `banner/${userId}/`
    if (!key.startsWith(prefix)) throw forbidden("This media does not belong to your account")
  }

  await prisma.profile.update({
    where: { userId },
    data: {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.avatarKey !== undefined
        ? { avatarUrl: input.avatarKey ? publicUrlFor(input.avatarKey) : null }
        : {}),
      ...(input.bannerKey !== undefined
        ? { bannerUrl: input.bannerKey ? publicUrlFor(input.bannerKey) : null }
        : {}),
    },
  })

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userInclude })
  const context = await buildViewerContext(userId, { userIds: [userId] })
  return toPublicUser(user, context)
}

type TimelineKind = "posts" | "replies" | "media" | "likes" | "reposts"

export async function getUserTimeline(args: {
  username: string
  kind: TimelineKind
  viewerId?: string
  cursor?: string
  limit: number
}): Promise<Page<Post>> {
  const user = await findUserByUsername(args.username)
  if (args.viewerId && (await isBlockedBetween(args.viewerId, user.id))) {
    throw forbidden("This account is not available")
  }

  const cursor = parseKeysetCursor(args.cursor)
  const hidden = await getHiddenAuthorIds(args.viewerId)
  const chronological = cursor
    ? {
        OR: [
          { createdAt: { lt: new Date(cursor.createdAt) } },
          { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
        ],
      }
    : {}

  let rows: PostWithRelations[] = []
  let page: { items: PostWithRelations[]; nextCursor: string | null; hasMore: boolean }

  if (args.kind === "likes" || args.kind === "reposts") {
    const table = args.kind === "likes" ? prisma.like : prisma.repost
    const engagements = await (table as typeof prisma.like).findMany({
      where: { userId: user.id, ...chronological },
      include: { post: { include: postInclude } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: args.limit + 1,
    })
    const visible = engagements.filter(
      (row) => !row.post.isDeleted && !hidden.includes(row.post.authorId),
    )
    const built = buildPage(visible, args.limit)
    rows = built.items.map((row) => row.post)
    page = { items: rows, nextCursor: built.nextCursor, hasMore: built.hasMore }
  } else {
    const where = {
      authorId: user.id,
      isDeleted: false,
      ...(args.kind === "posts" ? { parentId: null } : {}),
      ...(args.kind === "replies" ? { parentId: { not: null } } : {}),
      ...(args.kind === "media" ? { media: { some: {} } } : {}),
      ...chronological,
    }
    const found = await prisma.post.findMany({
      where,
      include: postInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: args.limit + 1,
    })
    page = buildPage(found, args.limit)
    rows = page.items
  }

  const context = await buildViewerContext(args.viewerId, { posts: rows })
  return { items: toPosts(rows, context), nextCursor: page.nextCursor, hasMore: page.hasMore }
}

export async function getFollowList(args: {
  username: string
  kind: "followers" | "following"
  viewerId?: string
  cursor?: string
  limit: number
}): Promise<Page<PublicUser>> {
  const user = await findUserByUsername(args.username)
  const cursor = parseKeysetCursor(args.cursor)

  const rows = await prisma.follow.findMany({
    where: {
      ...(args.kind === "followers" ? { followingId: user.id } : { followerId: user.id }),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    include:
      args.kind === "followers"
        ? { follower: { include: userInclude } }
        : { following: { include: userInclude } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: args.limit + 1,
  })

  const page = buildPage(rows, args.limit)
  const users = page.items.map((row) =>
    args.kind === "followers"
      ? (row as { follower: Awaited<ReturnType<typeof findUserByUsername>> }).follower
      : (row as { following: Awaited<ReturnType<typeof findUserByUsername>> }).following,
  )
  const context = await buildViewerContext(args.viewerId, { userIds: users.map((item) => item.id) })

  return {
    items: users.map((item) => toPublicUser(item, context)),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  }
}

/** "Who to follow": most followed accounts the viewer does not follow yet. */
export async function getSuggestedUsers(viewerId: string | undefined, limit: number): Promise<PublicUser[]> {
  const excluded = new Set<string>(await getHiddenAuthorIds(viewerId))
  if (viewerId) {
    excluded.add(viewerId)
    const following = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    })
    for (const row of following) excluded.add(row.followingId)
  }

  const users = await prisma.user.findMany({
    where: { isActive: true, ...(excluded.size ? { id: { notIn: [...excluded] } } : {}) },
    include: userInclude,
    orderBy: [{ profile: { followersCount: "desc" } }, { createdAt: "desc" }],
    take: limit,
  })

  const context = await buildViewerContext(viewerId, { userIds: users.map((user) => user.id) })
  return users.map((user) => toPublicUser(user, context))
}

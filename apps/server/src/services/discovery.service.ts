import type { NotificationItem, Page, Post, PublicUser, SearchResults, Trend } from "@socialapp/shared"

import { buildPage, parseKeysetCursor } from "../lib/cursor"
import { prisma } from "../lib/prisma"
import { cacheGet, cacheSet } from "../lib/redis"
import {
  buildViewerContext,
  notificationInclude,
  postInclude,
  toNotification,
  toPosts,
  toPublicUser,
  userInclude,
} from "../serializers"
import { getHiddenAuthorIds } from "./relations.service"

const TRENDS_CACHE_KEY = "trends:v1"
const TRENDS_TTL_SECONDS = 60

function chronologicalCursor(cursor: { createdAt: string; id: string } | null) {
  if (!cursor) return {}
  return {
    OR: [
      { createdAt: { lt: new Date(cursor.createdAt) } },
      { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
    ],
  }
}

export async function searchPosts(args: {
  query: string
  viewerId?: string
  cursor?: string
  limit: number
}): Promise<Page<Post>> {
  const cursor = parseKeysetCursor(args.cursor)
  const hidden = await getHiddenAuthorIds(args.viewerId)
  const term = args.query.replace(/^#/, "")

  const rows = await prisma.post.findMany({
    where: {
      isDeleted: false,
      visibility: "PUBLIC",
      ...(hidden.length ? { authorId: { notIn: hidden } } : {}),
      OR: [
        { content: { contains: term, mode: "insensitive" } },
        { hashtags: { some: { hashtag: { tag: term.toLowerCase() } } } },
      ],
      ...chronologicalCursor(cursor),
    },
    include: postInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: args.limit + 1,
  })

  const page = buildPage(rows, args.limit)
  const context = await buildViewerContext(args.viewerId, { posts: page.items })
  return { items: toPosts(page.items, context), nextCursor: page.nextCursor, hasMore: page.hasMore }
}

export async function searchUsers(args: {
  query: string
  viewerId?: string
  cursor?: string
  limit: number
}): Promise<Page<PublicUser>> {
  const cursor = parseKeysetCursor(args.cursor)
  const hidden = await getHiddenAuthorIds(args.viewerId)
  const term = args.query.replace(/^@/, "")

  const rows = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(hidden.length ? { id: { notIn: hidden } } : {}),
      OR: [
        { username: { contains: term, mode: "insensitive" } },
        { profile: { displayName: { contains: term, mode: "insensitive" } } },
      ],
      ...chronologicalCursor(cursor),
    },
    include: userInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: args.limit + 1,
  })

  const page = buildPage(rows, args.limit)
  const context = await buildViewerContext(args.viewerId, {
    userIds: page.items.map((user) => user.id),
  })
  return {
    items: page.items.map((user) => toPublicUser(user, context)),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  }
}

export async function searchHashtags(query: string, limit: number): Promise<Trend[]> {
  const term = query.replace(/^#/, "").toLowerCase()
  const hashtags = await prisma.hashtag.findMany({
    where: { tag: { contains: term } },
    orderBy: [{ postCount: "desc" }, { lastUsedAt: "desc" }],
    take: limit,
  })
  return hashtags.map((hashtag, index) => ({
    rank: index + 1,
    tag: hashtag.tag,
    postCount: hashtag.postCount,
    recentPostCount: hashtag.postCount,
  }))
}

export async function search(args: {
  query: string
  type: "all" | "posts" | "users" | "hashtags"
  viewerId?: string
  cursor?: string
  limit: number
}): Promise<SearchResults> {
  const empty = { items: [], nextCursor: null, hasMore: false }
  const [posts, users, hashtags] = await Promise.all([
    args.type === "all" || args.type === "posts"
      ? searchPosts({ query: args.query, viewerId: args.viewerId, cursor: args.cursor, limit: args.limit })
      : Promise.resolve(empty as Page<Post>),
    args.type === "all" || args.type === "users"
      ? searchUsers({ query: args.query, viewerId: args.viewerId, limit: Math.min(args.limit, 10) })
      : Promise.resolve(empty as Page<PublicUser>),
    args.type === "all" || args.type === "hashtags" ? searchHashtags(args.query, 10) : Promise.resolve([]),
  ])
  return { posts, users, hashtags }
}

export async function getTrends(limit: number): Promise<Trend[]> {
  const cached = await cacheGet(TRENDS_CACHE_KEY)
  if (cached) {
    try {
      return (JSON.parse(cached) as Trend[]).slice(0, limit)
    } catch {
      /* fall through and recompute */
    }
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recent = await prisma.postHashtag.groupBy({
    by: ["hashtagId"],
    where: { createdAt: { gte: since } },
    _count: { hashtagId: true },
    orderBy: { _count: { hashtagId: "desc" } },
    take: 20,
  })

  let trends: Trend[] = []
  if (recent.length > 0) {
    const hashtags = await prisma.hashtag.findMany({
      where: { id: { in: recent.map((row) => row.hashtagId) } },
    })
    const byId = new Map(hashtags.map((hashtag) => [hashtag.id, hashtag]))
    trends = recent
      .map((row, index) => {
        const hashtag = byId.get(row.hashtagId)
        if (!hashtag) return null
        return {
          rank: index + 1,
          tag: hashtag.tag,
          postCount: hashtag.postCount,
          recentPostCount: row._count.hashtagId,
        }
      })
      .filter((trend): trend is Trend => trend !== null)
  } else {
    const hashtags = await prisma.hashtag.findMany({
      orderBy: [{ postCount: "desc" }, { lastUsedAt: "desc" }],
      take: 20,
    })
    trends = hashtags.map((hashtag, index) => ({
      rank: index + 1,
      tag: hashtag.tag,
      postCount: hashtag.postCount,
      recentPostCount: hashtag.postCount,
    }))
  }

  await cacheSet(TRENDS_CACHE_KEY, JSON.stringify(trends), TRENDS_TTL_SECONDS)
  return trends.slice(0, limit)
}

export async function getHashtagPosts(args: {
  tag: string
  viewerId?: string
  cursor?: string
  limit: number
}): Promise<Page<Post>> {
  const cursor = parseKeysetCursor(args.cursor)
  const hidden = await getHiddenAuthorIds(args.viewerId)

  const rows = await prisma.post.findMany({
    where: {
      isDeleted: false,
      visibility: "PUBLIC",
      hashtags: { some: { hashtag: { tag: args.tag.replace(/^#/, "").toLowerCase() } } },
      ...(hidden.length ? { authorId: { notIn: hidden } } : {}),
      ...chronologicalCursor(cursor),
    },
    include: postInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: args.limit + 1,
  })

  const page = buildPage(rows, args.limit)
  const context = await buildViewerContext(args.viewerId, { posts: page.items })
  return { items: toPosts(page.items, context), nextCursor: page.nextCursor, hasMore: page.hasMore }
}

export async function listNotifications(args: {
  viewerId: string
  cursor?: string
  limit: number
  unreadOnly?: boolean
}): Promise<Page<NotificationItem>> {
  const cursor = parseKeysetCursor(args.cursor)

  const rows = await prisma.notification.findMany({
    where: {
      recipientId: args.viewerId,
      ...(args.unreadOnly ? { isRead: false } : {}),
      ...chronologicalCursor(cursor),
    },
    include: notificationInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: args.limit + 1,
  })

  const page = buildPage(rows, args.limit)
  const posts = page.items.map((row) => row.post).filter((post) => post !== null)
  const context = await buildViewerContext(args.viewerId, {
    posts,
    userIds: page.items.map((row) => row.actorId).filter((id): id is string => Boolean(id)),
  })

  return {
    items: page.items.map((row) => toNotification(row, context)),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  }
}

export async function countUnreadNotifications(viewerId: string): Promise<number> {
  return prisma.notification.count({ where: { recipientId: viewerId, isRead: false } })
}

export async function markNotificationRead(viewerId: string, notificationId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, recipientId: viewerId },
    data: { isRead: true, readAt: new Date() },
  })
}

export async function markAllNotificationsRead(viewerId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { recipientId: viewerId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })
}

export async function listBookmarks(args: {
  viewerId: string
  cursor?: string
  limit: number
}): Promise<Page<Post>> {
  const cursor = parseKeysetCursor(args.cursor)

  const rows = await prisma.bookmark.findMany({
    where: { userId: args.viewerId, ...chronologicalCursor(cursor) },
    include: { post: { include: postInclude } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: args.limit + 1,
  })

  const page = buildPage(rows, args.limit)
  const posts = page.items.map((row) => row.post).filter((post) => !post.isDeleted)
  const context = await buildViewerContext(args.viewerId, { posts })
  return { items: toPosts(posts, context), nextCursor: page.nextCursor, hasMore: page.hasMore }
}

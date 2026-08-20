/**
 * Feed strategies.
 *
 * Every strategy has the same signature, so swapping in a real recommendation
 * engine later means adding one entry to `feedStrategies` - no route, client or
 * pagination change required.
 */
import { Prisma } from "@prisma/client"
import type { FeedType, Page, Post } from "@socialapp/shared"

import { buildPage, encodeKeysetCursor, parseKeysetCursor, type KeysetCursor } from "../lib/cursor"
import { prisma } from "../lib/prisma"
import { buildViewerContext, postInclude, toPosts, type PostWithRelations } from "../serializers"
import { getFollowingIds, getHiddenAuthorIds } from "./relations.service"

export interface FeedArgs {
  viewerId?: string
  cursor?: string
  limit: number
}

interface RawFeedResult {
  rows: PostWithRelations[]
  nextCursor: string | null
  hasMore: boolean
}

type FeedStrategy = (args: {
  viewerId?: string
  cursor: KeysetCursor | null
  limit: number
  hiddenAuthorIds: string[]
}) => Promise<RawFeedResult>

function chronologicalCursorFilter(cursor: KeysetCursor | null): Prisma.PostWhereInput {
  if (!cursor) return {}
  return {
    OR: [
      { createdAt: { lt: new Date(cursor.createdAt) } },
      { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
    ],
  }
}

async function chronologicalFeed(args: {
  where: Prisma.PostWhereInput
  cursor: KeysetCursor | null
  limit: number
}): Promise<RawFeedResult> {
  const rows = await prisma.post.findMany({
    where: { ...args.where, ...chronologicalCursorFilter(args.cursor) },
    include: postInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: args.limit + 1,
  })
  const page = buildPage(rows, args.limit)
  return { rows: page.items, nextCursor: page.nextCursor, hasMore: page.hasMore }
}

const baseWhere = (hiddenAuthorIds: string[]): Prisma.PostWhereInput => ({
  isDeleted: false,
  parentId: null,
  ...(hiddenAuthorIds.length ? { authorId: { notIn: hiddenAuthorIds } } : {}),
})

/** Posts from the accounts the viewer follows, plus their own posts. */
const homeFeed: FeedStrategy = async ({ viewerId, cursor, limit, hiddenAuthorIds }) => {
  if (!viewerId) return latestFeed({ viewerId, cursor, limit, hiddenAuthorIds })

  const followingIds = await getFollowingIds(viewerId)
  const authorIds = [...new Set([...followingIds, viewerId])]

  const result = await chronologicalFeed({
    where: {
      ...baseWhere(hiddenAuthorIds),
      authorId: { in: authorIds, ...(hiddenAuthorIds.length ? { notIn: hiddenAuthorIds } : {}) },
      visibility: { in: ["PUBLIC", "FOLLOWERS"] },
    },
    cursor,
    limit,
  })

  // A brand new account follows nobody - show the popular timeline instead of
  // an empty screen.
  if (!cursor && result.rows.length === 0) {
    return popularFeed({ viewerId, cursor, limit, hiddenAuthorIds })
  }
  return result
}

/** Newest public posts from everyone. */
const latestFeed: FeedStrategy = async ({ cursor, limit, hiddenAuthorIds }) =>
  chronologicalFeed({
    where: { ...baseWhere(hiddenAuthorIds), visibility: "PUBLIC" },
    cursor,
    limit,
  })

/**
 * Hot ranking over the last 48 hours:
 *   (likes*3 + reposts*4 + replies*2 + 1) / (ageHours + 2)^1.5
 * Keyset paginated on (score, id) so pages never overlap.
 */
const popularFeed: FeedStrategy = async ({ viewerId, cursor, limit, hiddenAuthorIds }) => {
  const hiddenFilter = hiddenAuthorIds.length
    ? Prisma.sql`AND p."authorId" NOT IN (${Prisma.join(hiddenAuthorIds.map((id) => Prisma.sql`${id}::uuid`))})`
    : Prisma.empty

  const cursorFilter =
    cursor && typeof cursor.score === "number"
      ? Prisma.sql`WHERE (hot < ${cursor.score} OR (hot = ${cursor.score} AND id < ${cursor.id}::uuid))`
      : Prisma.empty

  const ranked = await prisma.$queryRaw<Array<{ id: string; hot: number }>>(Prisma.sql`
    WITH ranked AS (
      SELECT
        p."id" AS id,
        (p."likeCount" * 3 + p."repostCount" * 4 + p."replyCount" * 2 + 1)::double precision /
          POWER(GREATEST(EXTRACT(EPOCH FROM (now() - p."createdAt")) / 3600, 1) + 2, 1.5) AS hot
      FROM "Post" p
      WHERE p."isDeleted" = false
        AND p."parentId" IS NULL
        AND p."visibility" = 'PUBLIC'
        AND p."createdAt" > now() - interval '48 hours'
        ${hiddenFilter}
    )
    SELECT id, hot FROM ranked
    ${cursorFilter}
    ORDER BY hot DESC, id DESC
    LIMIT ${limit + 1}
  `)

  if (ranked.length === 0 && !cursor) {
    return latestFeed({ viewerId, cursor, limit, hiddenAuthorIds })
  }

  const hasMore = ranked.length > limit
  const page = hasMore ? ranked.slice(0, limit) : ranked
  const posts = await prisma.post.findMany({
    where: { id: { in: page.map((row) => row.id) } },
    include: postInclude,
  })
  const byId = new Map(posts.map((post) => [post.id, post]))
  const rows = page.map((row) => byId.get(row.id)).filter((post): post is PostWithRelations => Boolean(post))

  const last = page[page.length - 1]
  return {
    rows,
    hasMore,
    nextCursor:
      hasMore && last
        ? encodeKeysetCursor({
            createdAt: new Date().toISOString(),
            id: last.id,
            score: Number(last.hot),
          })
        : null,
  }
}

/**
 * Discovery: posts from accounts followed by the people the viewer follows
 * (second degree network), excluding accounts already followed.
 */
const recommendedFeed: FeedStrategy = async ({ viewerId, cursor, limit, hiddenAuthorIds }) => {
  if (!viewerId) return popularFeed({ viewerId, cursor, limit, hiddenAuthorIds })

  const followingIds = await getFollowingIds(viewerId)
  if (followingIds.length === 0) {
    return popularFeed({ viewerId, cursor, limit, hiddenAuthorIds })
  }

  const secondDegree = await prisma.follow.findMany({
    where: { followerId: { in: followingIds }, followingId: { notIn: [...followingIds, viewerId] } },
    select: { followingId: true },
    take: 500,
  })
  const candidateIds = [...new Set(secondDegree.map((row) => row.followingId))].filter(
    (id) => !hiddenAuthorIds.includes(id),
  )

  if (candidateIds.length === 0) {
    return popularFeed({ viewerId, cursor, limit, hiddenAuthorIds })
  }

  const result = await chronologicalFeed({
    where: { ...baseWhere(hiddenAuthorIds), visibility: "PUBLIC", authorId: { in: candidateIds } },
    cursor,
    limit,
  })

  if (!cursor && result.rows.length === 0) {
    return popularFeed({ viewerId, cursor, limit, hiddenAuthorIds })
  }
  return result
}

export const feedStrategies: Record<FeedType, FeedStrategy> = {
  home: homeFeed,
  latest: latestFeed,
  popular: popularFeed,
  recommended: recommendedFeed,
}

export async function getFeed(type: FeedType, args: FeedArgs): Promise<Page<Post>> {
  const strategy = feedStrategies[type] ?? homeFeed
  const cursor = parseKeysetCursor(args.cursor)
  const hiddenAuthorIds = await getHiddenAuthorIds(args.viewerId)

  const result = await strategy({ viewerId: args.viewerId, cursor, limit: args.limit, hiddenAuthorIds })
  const context = await buildViewerContext(args.viewerId, { posts: result.rows })

  return {
    items: toPosts(result.rows, context),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  }
}

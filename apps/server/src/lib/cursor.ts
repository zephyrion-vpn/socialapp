import { decodeCursor, encodeCursor } from "@socialapp/shared"

import { badRequest } from "./errors"

export interface KeysetCursor {
  /** ISO timestamp of the last item on the previous page. */
  createdAt: string
  /** Tie breaker so equal timestamps still paginate deterministically. */
  id: string
  /** Optional ranking score for the recommendation/popular feeds. */
  score?: number
}

export function encodeKeysetCursor(cursor: KeysetCursor): string {
  return encodeCursor(cursor as unknown as Record<string, unknown>)
}

export function parseKeysetCursor(cursor?: string | null): KeysetCursor | null {
  if (!cursor) return null
  const decoded = decodeCursor<KeysetCursor>(cursor)
  if (!decoded?.createdAt || !decoded?.id) throw badRequest("Invalid pagination cursor")
  if (Number.isNaN(Date.parse(decoded.createdAt))) throw badRequest("Invalid pagination cursor")
  return decoded
}

/**
 * Takes `limit + 1` rows, returns exactly `limit` items plus the next cursor.
 * Every timeline in the API uses this shape so the client can paginate with a
 * single generic hook.
 */
export function buildPage<T extends { id: string; createdAt: Date | string }>(
  rows: T[],
  limit: number,
  scoreOf?: (row: T) => number,
): { items: T[]; nextCursor: string | null; hasMore: boolean } {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeKeysetCursor({
          createdAt: new Date(last.createdAt).toISOString(),
          id: last.id,
          score: scoreOf ? scoreOf(last) : undefined,
        })
      : null
  return { items, nextCursor, hasMore }
}

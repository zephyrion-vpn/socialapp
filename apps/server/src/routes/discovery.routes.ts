import {
  notificationsQuerySchema,
  paginationSchema,
  searchQuerySchema,
  uuidSchema,
  type PaginationInput,
  type SearchQueryInput,
} from "@socialapp/shared"
import { Router } from "express"
import { z } from "zod"

import { asyncHandler, resolveLimit } from "../lib/http"
import { optionalAuth, requireAuth } from "../middleware/auth"
import { validate, validParams, validQuery } from "../middleware/validate"
import * as discovery from "../services/discovery.service"

// --- search -----------------------------------------------------------------

export const searchRouter = Router()

searchRouter.get(
  "/",
  optionalAuth,
  validate({ query: searchQuerySchema }),
  asyncHandler(async (req, res) => {
    const { q, type, cursor, limit } = validQuery<SearchQueryInput>(req)
    const results = await discovery.search({
      query: q,
      type,
      viewerId: req.auth?.userId,
      cursor,
      limit: resolveLimit(limit),
    })
    res.json(results)
  }),
)

searchRouter.get(
  "/posts",
  optionalAuth,
  validate({ query: searchQuerySchema }),
  asyncHandler(async (req, res) => {
    const { q, cursor, limit } = validQuery<SearchQueryInput>(req)
    res.json(
      await discovery.searchPosts({
        query: q,
        viewerId: req.auth?.userId,
        cursor,
        limit: resolveLimit(limit),
      }),
    )
  }),
)

searchRouter.get(
  "/users",
  optionalAuth,
  validate({ query: searchQuerySchema }),
  asyncHandler(async (req, res) => {
    const { q, cursor, limit } = validQuery<SearchQueryInput>(req)
    res.json(
      await discovery.searchUsers({
        query: q,
        viewerId: req.auth?.userId,
        cursor,
        limit: resolveLimit(limit),
      }),
    )
  }),
)

// --- trends -----------------------------------------------------------------

export const trendsRouter = Router()

trendsRouter.get(
  "/",
  optionalAuth,
  validate({ query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const { limit } = validQuery<PaginationInput>(req)
    res.json({ trends: await discovery.getTrends(resolveLimit(limit ?? 10)) })
  }),
)

const tagParams = z.object({ tag: z.string().trim().min(1).max(140) })

trendsRouter.get(
  "/:tag/posts",
  optionalAuth,
  validate({ params: tagParams, query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const { cursor, limit } = validQuery<PaginationInput>(req)
    res.json(
      await discovery.getHashtagPosts({
        tag: validParams<z.infer<typeof tagParams>>(req).tag,
        viewerId: req.auth?.userId,
        cursor,
        limit: resolveLimit(limit),
      }),
    )
  }),
)

// --- notifications ----------------------------------------------------------

export const notificationsRouter = Router()

notificationsRouter.get(
  "/",
  requireAuth,
  validate({ query: notificationsQuerySchema }),
  asyncHandler(async (req, res) => {
    const { cursor, limit, unreadOnly } = validQuery<
      PaginationInput & { unreadOnly?: boolean }
    >(req)
    res.json(
      await discovery.listNotifications({
        viewerId: req.auth!.userId,
        cursor,
        limit: resolveLimit(limit),
        unreadOnly,
      }),
    )
  }),
)

notificationsRouter.get(
  "/unread-count",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ count: await discovery.countUnreadNotifications(req.auth!.userId) })
  }),
)

notificationsRouter.post(
  "/read-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await discovery.markAllNotificationsRead(req.auth!.userId)
    res.json({ ok: true })
  }),
)

notificationsRouter.post(
  "/:id/read",
  requireAuth,
  validate({ params: z.object({ id: uuidSchema }) }),
  asyncHandler(async (req, res) => {
    await discovery.markNotificationRead(req.auth!.userId, validParams<{ id: string }>(req).id)
    res.json({ ok: true })
  }),
)

// --- bookmarks --------------------------------------------------------------

export const bookmarksRouter = Router()

bookmarksRouter.get(
  "/",
  requireAuth,
  validate({ query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const { cursor, limit } = validQuery<PaginationInput>(req)
    res.json(
      await discovery.listBookmarks({
        viewerId: req.auth!.userId,
        cursor,
        limit: resolveLimit(limit),
      }),
    )
  }),
)

import { feedQuerySchema, type FeedQueryInput } from "@socialapp/shared"
import { Router } from "express"

import { asyncHandler, resolveLimit } from "../lib/http"
import { optionalAuth } from "../middleware/auth"
import { validate, validQuery } from "../middleware/validate"
import { getFeed } from "../services/feed.service"

export const feedRouter = Router()

/**
 * GET /feed?type=home|recommended|popular|latest
 * Anonymous callers transparently get the public timeline.
 */
feedRouter.get(
  "/",
  optionalAuth,
  validate({ query: feedQuerySchema }),
  asyncHandler(async (req, res) => {
    const { type, cursor, limit } = validQuery<FeedQueryInput>(req)
    const page = await getFeed(type, {
      viewerId: req.auth?.userId,
      cursor,
      limit: resolveLimit(limit),
    })
    res.json(page)
  }),
)

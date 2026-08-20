import {
  paginationSchema,
  updateProfileSchema,
  usernameSchema,
  type PaginationInput,
  type UpdateProfileInput,
} from "@socialapp/shared"
import { Router } from "express"
import { z } from "zod"

import { asyncHandler, resolveLimit } from "../lib/http"
import { optionalAuth, requireAuth } from "../middleware/auth"
import { writeLimiter } from "../middleware/rate-limit"
import { validate, validBody, validParams, validQuery } from "../middleware/validate"
import * as engagementService from "../services/engagement.service"
import * as userService from "../services/user.service"

export const userRouter = Router()

const usernameParams = z.object({ username: usernameSchema })
type UsernameParams = z.infer<typeof usernameParams>

// --- current user (must be registered before /:username) --------------------

userRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await userService.getProfile(req.auth!.username, req.auth!.userId)
    res.json({ user })
  }),
)

userRouter.patch(
  "/me",
  requireAuth,
  writeLimiter,
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    const user = await userService.updateProfile(req.auth!.userId, validBody<UpdateProfileInput>(req))
    res.json({ user })
  }),
)

userRouter.get(
  "/suggested",
  optionalAuth,
  validate({ query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const { limit } = validQuery<PaginationInput>(req)
    const users = await userService.getSuggestedUsers(req.auth?.userId, resolveLimit(limit ?? 5))
    res.json({ users })
  }),
)

// --- public profiles --------------------------------------------------------

userRouter.get(
  "/:username",
  optionalAuth,
  validate({ params: usernameParams }),
  asyncHandler(async (req, res) => {
    const user = await userService.getProfile(
      validParams<UsernameParams>(req).username,
      req.auth?.userId,
    )
    res.json({ user })
  }),
)

const timelineKinds = ["posts", "replies", "media", "likes", "reposts"] as const

for (const kind of timelineKinds) {
  userRouter.get(
    `/:username/${kind}`,
    optionalAuth,
    validate({ params: usernameParams, query: paginationSchema }),
    asyncHandler(async (req, res) => {
      const { cursor, limit } = validQuery<PaginationInput>(req)
      const page = await userService.getUserTimeline({
        username: validParams<UsernameParams>(req).username,
        kind,
        viewerId: req.auth?.userId,
        cursor,
        limit: resolveLimit(limit),
      })
      res.json(page)
    }),
  )
}

for (const kind of ["followers", "following"] as const) {
  userRouter.get(
    `/:username/${kind}`,
    optionalAuth,
    validate({ params: usernameParams, query: paginationSchema }),
    asyncHandler(async (req, res) => {
      const { cursor, limit } = validQuery<PaginationInput>(req)
      const page = await userService.getFollowList({
        username: validParams<UsernameParams>(req).username,
        kind,
        viewerId: req.auth?.userId,
        cursor,
        limit: resolveLimit(limit),
      })
      res.json(page)
    }),
  )
}

// --- relationships ----------------------------------------------------------

userRouter.post(
  "/:username/follow",
  requireAuth,
  writeLimiter,
  validate({ params: usernameParams }),
  asyncHandler(async (req, res) => {
    res.json(await engagementService.followUser(req.auth!.userId, validParams<UsernameParams>(req).username))
  }),
)

userRouter.delete(
  "/:username/follow",
  requireAuth,
  writeLimiter,
  validate({ params: usernameParams }),
  asyncHandler(async (req, res) => {
    res.json(await engagementService.unfollowUser(req.auth!.userId, validParams<UsernameParams>(req).username))
  }),
)

userRouter.post(
  "/:username/block",
  requireAuth,
  writeLimiter,
  validate({ params: usernameParams }),
  asyncHandler(async (req, res) => {
    res.json(await engagementService.blockUser(req.auth!.userId, validParams<UsernameParams>(req).username))
  }),
)

userRouter.delete(
  "/:username/block",
  requireAuth,
  writeLimiter,
  validate({ params: usernameParams }),
  asyncHandler(async (req, res) => {
    res.json(await engagementService.unblockUser(req.auth!.userId, validParams<UsernameParams>(req).username))
  }),
)

userRouter.post(
  "/:username/mute",
  requireAuth,
  writeLimiter,
  validate({ params: usernameParams }),
  asyncHandler(async (req, res) => {
    res.json(await engagementService.muteUser(req.auth!.userId, validParams<UsernameParams>(req).username))
  }),
)

userRouter.delete(
  "/:username/mute",
  requireAuth,
  writeLimiter,
  validate({ params: usernameParams }),
  asyncHandler(async (req, res) => {
    res.json(await engagementService.unmuteUser(req.auth!.userId, validParams<UsernameParams>(req).username))
  }),
)

import {
  createPostSchema,
  paginationSchema,
  uuidSchema,
  type PaginationInput,
} from "@socialapp/shared"
import { Router } from "express"
import { z } from "zod"

import { asyncHandler, resolveLimit } from "../lib/http"
import { optionalAuth, requireAuth } from "../middleware/auth"
import { writeLimiter } from "../middleware/rate-limit"
import { validate, validBody, validParams, validQuery } from "../middleware/validate"
import * as engagementService from "../services/engagement.service"
import * as postService from "../services/post.service"

export const postRouter = Router()

const idParams = z.object({ id: uuidSchema })
type IdParams = z.infer<typeof idParams>

type CreatePostBody = z.infer<typeof createPostSchema>

postRouter.post(
  "/",
  requireAuth,
  writeLimiter,
  validate({ body: createPostSchema }),
  asyncHandler(async (req, res) => {
    const body = validBody<CreatePostBody>(req)
    const post = await postService.createPost({
      authorId: req.auth!.userId,
      content: body.content,
      visibility: body.visibility,
      parentId: body.parentId ?? null,
      quotedPostId: body.quotedPostId ?? null,
      media: body.media,
    })
    res.status(201).json({ post })
  }),
)

postRouter.get(
  "/:id",
  optionalAuth,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const post = await postService.getPost(validParams<IdParams>(req).id, req.auth?.userId)
    res.json({ post })
  }),
)

postRouter.delete(
  "/:id",
  requireAuth,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await postService.deletePost(validParams<IdParams>(req).id, req.auth!.userId)
    res.status(204).end()
  }),
)

postRouter.get(
  "/:id/thread",
  optionalAuth,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const thread = await postService.getThread(validParams<IdParams>(req).id, req.auth?.userId)
    res.json(thread)
  }),
)

postRouter.get(
  "/:id/replies",
  optionalAuth,
  validate({ params: idParams, query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const { cursor, limit } = validQuery<PaginationInput>(req)
    const page = await postService.listReplies({
      postId: validParams<IdParams>(req).id,
      viewerId: req.auth?.userId,
      cursor,
      limit: resolveLimit(limit),
    })
    res.json(page)
  }),
)

postRouter.get(
  "/:id/likes",
  optionalAuth,
  validate({ params: idParams, query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const { cursor, limit } = validQuery<PaginationInput>(req)
    const page = await postService.listLikers({
      postId: validParams<IdParams>(req).id,
      viewerId: req.auth?.userId,
      cursor,
      limit: resolveLimit(limit),
    })
    res.json(page)
  }),
)

// --- engagement -------------------------------------------------------------

postRouter.post(
  "/:id/like",
  requireAuth,
  writeLimiter,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    res.json(await engagementService.likePost(req.auth!.userId, validParams<IdParams>(req).id))
  }),
)

postRouter.delete(
  "/:id/like",
  requireAuth,
  writeLimiter,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    res.json(await engagementService.unlikePost(req.auth!.userId, validParams<IdParams>(req).id))
  }),
)

postRouter.post(
  "/:id/repost",
  requireAuth,
  writeLimiter,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    res.json(await engagementService.repostPost(req.auth!.userId, validParams<IdParams>(req).id))
  }),
)

postRouter.delete(
  "/:id/repost",
  requireAuth,
  writeLimiter,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    res.json(await engagementService.undoRepost(req.auth!.userId, validParams<IdParams>(req).id))
  }),
)

postRouter.post(
  "/:id/bookmark",
  requireAuth,
  writeLimiter,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    res.json(await engagementService.bookmarkPost(req.auth!.userId, validParams<IdParams>(req).id))
  }),
)

postRouter.delete(
  "/:id/bookmark",
  requireAuth,
  writeLimiter,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    res.json(await engagementService.removeBookmark(req.auth!.userId, validParams<IdParams>(req).id))
  }),
)

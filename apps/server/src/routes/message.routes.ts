import {
  paginationSchema,
  sendMessageSchema,
  startConversationSchema,
  uuidSchema,
  type PaginationInput,
  type SendMessageInput,
  type StartConversationInput,
} from "@socialapp/shared"
import { Router } from "express"
import { z } from "zod"

import { asyncHandler, resolveLimit } from "../lib/http"
import { requireAuth } from "../middleware/auth"
import { dmLimiter } from "../middleware/rate-limit"
import { validate, validBody, validParams, validQuery } from "../middleware/validate"
import * as messages from "../services/message.service"

const idParams = z.object({ id: uuidSchema })
type IdParams = z.infer<typeof idParams>

export const messageRouter = Router()

// Direct messages are private by definition - no optional auth anywhere here.
messageRouter.use(requireAuth)

messageRouter.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const count = await messages.getUnreadCount(req.auth!.userId)
    res.json({ count })
  }),
)

messageRouter.get(
  "/conversations",
  validate({ query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const query = validQuery<PaginationInput>(req)
    const page = await messages.listConversations({
      viewerId: req.auth!.userId,
      cursor: query.cursor,
      limit: resolveLimit(query.limit),
    })
    res.json(page)
  }),
)

messageRouter.post(
  "/conversations",
  dmLimiter,
  validate({ body: startConversationSchema }),
  asyncHandler(async (req, res) => {
    const body = validBody<StartConversationInput>(req)
    const conversation = await messages.startConversation(req.auth!.userId, body.username)
    res.status(201).json({ conversation })
  }),
)

messageRouter.get(
  "/conversations/:id",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const conversation = await messages.getConversation(
      req.auth!.userId,
      validParams<IdParams>(req).id,
    )
    res.json({ conversation })
  }),
)

messageRouter.get(
  "/conversations/:id/messages",
  validate({ params: idParams, query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const query = validQuery<PaginationInput>(req)
    const page = await messages.listMessages({
      viewerId: req.auth!.userId,
      conversationId: validParams<IdParams>(req).id,
      cursor: query.cursor,
      limit: resolveLimit(query.limit),
    })
    res.json(page)
  }),
)

messageRouter.post(
  "/conversations/:id/messages",
  dmLimiter,
  validate({ params: idParams, body: sendMessageSchema }),
  asyncHandler(async (req, res) => {
    const result = await messages.sendMessage({
      senderId: req.auth!.userId,
      conversationId: validParams<IdParams>(req).id,
      content: validBody<SendMessageInput>(req).content,
    })
    res.status(201).json(result)
  }),
)

messageRouter.post(
  "/conversations/:id/read",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const result = await messages.markConversationRead(
      req.auth!.userId,
      validParams<IdParams>(req).id,
    )
    res.json(result)
  }),
)

messageRouter.delete(
  "/:id",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await messages.deleteMessage(req.auth!.userId, validParams<IdParams>(req).id)
    res.status(204).end()
  }),
)

import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "@socialapp/shared"
import { Router } from "express"

import { env } from "../config/env"
import { asyncHandler, deviceInfo } from "../lib/http"
import { requireAuth } from "../middleware/auth"
import { authLimiter } from "../middleware/rate-limit"
import { validate, validBody } from "../middleware/validate"
import * as authService from "../services/auth.service"

export const authRouter = Router()

authRouter.post(
  "/register",
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.register(validBody<RegisterInput>(req), deviceInfo(req))
    res.status(201).json(result)
  }),
)

authRouter.post(
  "/login",
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.login(validBody<LoginInput>(req), deviceInfo(req))
    res.json(result)
  }),
)

authRouter.post(
  "/refresh",
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.refresh(validBody<RefreshInput>(req).refreshToken)
    res.json(result)
  }),
)

authRouter.post(
  "/logout",
  validate({ body: logoutSchema }),
  asyncHandler(async (req, res) => {
    const body = validBody<{ refreshToken?: string }>(req)
    await authService.logout({ refreshToken: body.refreshToken })
    res.status(204).end()
  }),
)

authRouter.post(
  "/logout-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await authService.logoutAll(req.auth!.userId)
    res.status(204).end()
  }),
)

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.getCurrentUser(req.auth!.userId)
    res.json({ user })
  }),
)

authRouter.get(
  "/sessions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessions = await authService.listSessions(req.auth!.userId, req.auth!.sessionId)
    res.json({ sessions })
  }),
)

authRouter.post(
  "/password/forgot",
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.requestPasswordReset(validBody<ForgotPasswordInput>(req).email)
    // The token is only surfaced outside production, where no mail provider is
    // wired up. In production it must be delivered by email.
    res.json({ ok: true, ...(env.isProduction ? {} : result) })
  }),
)

authRouter.post(
  "/password/reset",
  authLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    await authService.resetPassword(validBody<ResetPasswordInput>(req))
    res.json({ ok: true })
  }),
)

authRouter.post(
  "/password/change",
  requireAuth,
  authLimiter,
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    await authService.changePassword(
      req.auth!.userId,
      validBody<ChangePasswordInput>(req),
      req.auth!.sessionId,
    )
    res.json({ ok: true })
  }),
)

import rateLimit, { type Options } from "express-rate-limit"
import type { Request } from "express"

import { env } from "../config/env"
import { ERROR_CODES } from "@socialapp/shared"

const shared: Partial<Options> = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // We terminate behind Railway's proxy and set trust proxy explicitly.
  validate: { trustProxy: false, xForwardedForHeader: false },
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      error: {
        code: ERROR_CODES.RATE_LIMITED,
        message: "Too many requests. Please wait a moment and try again.",
      },
    })
  },
}

const ipKey = (req: Request): string => req.ip ?? req.socket.remoteAddress ?? "unknown"

/** Baseline limiter applied to the whole API surface. */
export const apiLimiter = rateLimit({
  ...shared,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  skip: () => env.isTest,
  keyGenerator: ipKey,
})

/** Brute force protection for credential endpoints (per IP + identifier). */
export const authLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60_000,
  limit: 20,
  skipSuccessfulRequests: true,
  skip: () => env.isTest,
  keyGenerator: (req: Request) => {
    const body = (req.body ?? {}) as { identifier?: string; email?: string }
    const identifier = (body.identifier ?? body.email ?? "").toString().toLowerCase().slice(0, 120)
    return `${ipKey(req)}:${identifier}`
  },
})

/** Anti spam limiter for content creation. */
export const writeLimiter = rateLimit({
  ...shared,
  windowMs: 5 * 60_000,
  limit: 80,
  skip: () => env.isTest,
  keyGenerator: (req: Request) => req.auth?.userId ?? ipKey(req),
})

/** Uploads are the most expensive operation - keep them tight. */
export const uploadLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60_000,
  limit: 60,
  skip: () => env.isTest,
  keyGenerator: (req: Request) => req.auth?.userId ?? ipKey(req),
})

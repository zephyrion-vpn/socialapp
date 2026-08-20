import { randomUUID } from "node:crypto"

import type { NextFunction, Request, Response } from "express"

import { env } from "../config/env"
import { logger } from "../lib/logger"

/** Assigns a request id, echoes it back and logs one line per request. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers["x-request-id"]
  req.requestId = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID()
  req.startedAt = Date.now()
  res.setHeader("X-Request-Id", req.requestId)

  res.on("finish", () => {
    if (env.isTest) return
    const durationMs = Date.now() - (req.startedAt ?? Date.now())
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"
    logger[level](
      {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl.split("?")[0],
        status: res.statusCode,
        durationMs,
        userId: req.auth?.userId,
      },
      "request",
    )
  })

  next()
}

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@socialapp/shared"
import type { NextFunction, Request, RequestHandler, Response } from "express"

/** Express 4 does not forward async rejections - this does. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next)
  }
}

export function resolveLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) return DEFAULT_PAGE_SIZE
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE)
}

export function deviceInfo(req: Request): { userAgent?: string | null; ipAddress?: string | null } {
  const userAgent = req.headers["user-agent"]
  return {
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    ipAddress: req.ip ?? null,
  }
}

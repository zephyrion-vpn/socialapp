import type { NextFunction, Request, RequestHandler, Response } from "express"

import { verifyAccessToken } from "../lib/crypto"
import { forbidden, unauthorized } from "../lib/errors"
import { prisma } from "../lib/prisma"

export interface AuthContext {
  userId: string
  username: string
  sessionId: string
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization
  if (!header || Array.isArray(header)) return null
  const [scheme, token] = header.split(" ")
  if (!token || scheme.toLowerCase() !== "bearer") return null
  return token.trim() || null
}

async function resolveAuth(req: Request): Promise<AuthContext | null> {
  const token = readBearerToken(req)
  if (!token) return null

  const payload = verifyAccessToken(token)

  // The token is signed, but the account may have been deactivated or the
  // session revoked since it was issued - never trust the client alone.
  const [user, session] = await Promise.all([
    prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, isActive: true },
    }),
    prisma.session.findUnique({
      where: { id: payload.sid },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    }),
  ])

  if (!user) throw unauthorized("Account no longer exists")
  if (!user.isActive) throw forbidden("This account has been deactivated")
  if (!session || session.userId !== user.id) throw unauthorized("Session is no longer valid")
  if (session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    throw unauthorized("Session has expired, please sign in again")
  }

  return { userId: user.id, username: user.username, sessionId: session.id }
}

/** Rejects the request unless a valid access token is present. */
export const requireAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const auth = await resolveAuth(req)
    if (!auth) throw unauthorized()
    req.auth = auth
    next()
  } catch (error) {
    next(error)
  }
}

/** Attaches the viewer when a token is present, but never fails the request. */
export const optionalAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    req.auth = (await resolveAuth(req)) ?? undefined
  } catch {
    req.auth = undefined
  }
  next()
}

export function requireViewer(req: Request): AuthContext {
  if (!req.auth) throw unauthorized()
  return req.auth
}

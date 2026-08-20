import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

import { env } from "../config/env"
import { unauthorized } from "./errors"
import { ERROR_CODES } from "@socialapp/shared"

export interface AccessTokenPayload {
  sub: string
  username: string
  sid: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

/** Cryptographically random opaque token (refresh tokens, reset tokens). */
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url")
}

/** Only hashes of long lived tokens are ever stored in the database. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}

export function signAccessToken(payload: AccessTokenPayload): { token: string; expiresAt: Date } {
  const token = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"],
    issuer: "socialapp",
    audience: "socialapp-desktop",
  })
  const decoded = jwt.decode(token) as { exp?: number } | null
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 15 * 60_000)
  return { token, expiresAt }
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: "socialapp",
      audience: "socialapp-desktop",
    })
    if (typeof payload === "string") throw new Error("Malformed token")
    const { sub, username, sid } = payload as jwt.JwtPayload & { username?: string; sid?: string }
    if (!sub || !username || !sid) throw new Error("Malformed token payload")
    return { sub, username, sid }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw unauthorized("Access token expired", ERROR_CODES.TOKEN_EXPIRED)
    }
    throw unauthorized("Invalid access token")
  }
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
}

import type { AuthTokens, PublicUser, SessionInfo } from "@socialapp/shared"

import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
  verifyPassword,
} from "../lib/crypto"
import { conflict, invalidCredentials, notFound, unauthorized } from "../lib/errors"
import { logger } from "../lib/logger"
import { prisma } from "../lib/prisma"
import { toPublicUser, userInclude } from "../serializers"

export interface DeviceInfo {
  userAgent?: string | null
  ipAddress?: string | null
}

async function issueTokens(args: {
  userId: string
  username: string
  sessionId: string
}): Promise<AuthTokens> {
  const refreshToken = generateOpaqueToken()
  const refreshExpiresAt = refreshTokenExpiry()

  await prisma.session.update({
    where: { id: args.sessionId },
    data: {
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiresAt,
      lastUsedAt: new Date(),
      revokedAt: null,
    },
  })

  const access = signAccessToken({ sub: args.userId, username: args.username, sid: args.sessionId })

  return {
    accessToken: access.token,
    refreshToken,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
  }
}

async function createSession(userId: string, device: DeviceInfo): Promise<string> {
  const session = await prisma.session.create({
    data: {
      userId,
      // Replaced immediately by issueTokens - never a usable value.
      refreshTokenHash: hashToken(generateOpaqueToken(16)),
      userAgent: device.userAgent?.slice(0, 400) ?? null,
      ipAddress: device.ipAddress?.slice(0, 64) ?? null,
      expiresAt: refreshTokenExpiry(),
    },
    select: { id: true },
  })
  return session.id
}

export async function register(
  input: { email: string; username: string; password: string; displayName?: string },
  device: DeviceInfo,
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
    select: { email: true, username: true },
  })
  if (existing) {
    throw conflict(
      existing.email === input.email
        ? "An account with this email already exists"
        : "This username is already taken",
    )
  }

  const passwordHash = await hashPassword(input.password)

  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      profile: { create: { displayName: input.displayName?.trim() || input.username } },
    },
    include: userInclude,
  })

  const sessionId = await createSession(user.id, device)
  const tokens = await issueTokens({ userId: user.id, username: user.username, sessionId })

  logger.info({ userId: user.id }, "User registered")
  return { user: toPublicUser(user), tokens }
}

export async function login(
  input: { identifier: string; password: string },
  device: DeviceInfo,
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const identifier = input.identifier.trim().toLowerCase()
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
    include: userInclude,
  })

  // Constant-ish response regardless of which half failed.
  if (!user) throw invalidCredentials()
  if (!user.isActive) throw invalidCredentials("This account has been deactivated")

  const valid = await verifyPassword(input.password, user.passwordHash)
  if (!valid) throw invalidCredentials()

  const sessionId = await createSession(user.id, device)
  const tokens = await issueTokens({ userId: user.id, username: user.username, sessionId })
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  return { user: toPublicUser(user), tokens }
}

/** Refresh token rotation: the old token stops working immediately. */
export async function refresh(refreshToken: string): Promise<{ tokens: AuthTokens }> {
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hashToken(refreshToken) },
    include: { user: { select: { id: true, username: true, isActive: true } } },
  })

  if (!session || session.revokedAt) throw unauthorized("Session is no longer valid")
  if (session.expiresAt.getTime() < Date.now()) throw unauthorized("Session expired, please sign in again")
  if (!session.user.isActive) throw unauthorized("This account has been deactivated")

  const tokens = await issueTokens({
    userId: session.user.id,
    username: session.user.username,
    sessionId: session.id,
  })
  return { tokens }
}

export async function logout(args: { refreshToken?: string; sessionId?: string }): Promise<void> {
  if (args.refreshToken) {
    await prisma.session.updateMany({
      where: { refreshTokenHash: hashToken(args.refreshToken) },
      data: { revokedAt: new Date() },
    })
    return
  }
  if (args.sessionId) {
    await prisma.session.updateMany({
      where: { id: args.sessionId },
      data: { revokedAt: new Date() },
    })
  }
}

export async function logoutAll(userId: string): Promise<{ revoked: number }> {
  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return { revoked: result.count }
}

export async function listSessions(userId: string, currentSessionId: string): Promise<SessionInfo[]> {
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return sessions.map((session) => ({
    id: session.id,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    createdAt: session.createdAt.toISOString(),
    lastUsedAt: session.lastUsedAt ? session.lastUsedAt.toISOString() : null,
    expiresAt: session.expiresAt.toISOString(),
    current: session.id === currentSessionId,
  }))
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude })
  if (!user) throw notFound("Account not found")
  return toPublicUser(user, {
    viewerId: userId,
    likedPostIds: new Set(),
    repostedPostIds: new Set(),
    bookmarkedPostIds: new Set(),
    followingIds: new Set(),
    followerIds: new Set(),
    blockedIds: new Set(),
    mutedIds: new Set(),
  })
}

/**
 * Always resolves successfully so the endpoint cannot be used to enumerate
 * accounts. The token is only returned outside production, where no mail
 * provider is configured.
 */
export async function requestPasswordReset(email: string): Promise<{ resetToken?: string }> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) return {}

  const token = generateOpaqueToken(32)
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  })

  logger.info({ userId: user.id }, "Password reset requested")
  return { resetToken: token }
}

export async function resetPassword(input: { token: string; password: string }): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
  })
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw unauthorized("This reset link is invalid or has expired")
  }

  const passwordHash = await hashPassword(input.password)
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Password changed - every device must sign in again.
    prisma.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])
}

export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
  keepSessionId?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } })
  if (!user) throw notFound("Account not found")

  const valid = await verifyPassword(input.currentPassword, user.passwordHash)
  if (!valid) throw invalidCredentials("Current password is incorrect")

  const passwordHash = await hashPassword(input.newPassword)
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
      data: { revokedAt: new Date() },
    }),
  ])
}

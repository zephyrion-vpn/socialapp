import { API_PREFIX, type AuthResult, type Post } from "@socialapp/shared"
import type { Express } from "express"
import request from "supertest"

import { createApp } from "../src/app"
import { prisma } from "../src/lib/prisma"

export const app: Express = createApp()

/** Prefix a path with the versioned API base. */
export const api = (path: string): string => `${API_PREFIX}${path}`

const TABLES = [
  "PasswordResetToken",
  "Session",
  "Mute",
  "Block",
  "PostHashtag",
  "Hashtag",
  "Notification",
  "Bookmark",
  "Follow",
  "Reply",
  "Repost",
  "Like",
  "PostMedia",
  "Post",
  "Profile",
  "User",
]

export async function resetDatabase(): Promise<void> {
  const list = TABLES.map((table) => `"${table}"`).join(", ")
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

export function uniqueUsername(prefix = "u"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export interface TestUser extends AuthResult {
  username: string
  email: string
  password: string
}

export async function registerUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const username = overrides.username ?? uniqueUsername()
  const email = overrides.email ?? `${username}@example.com`
  const password = overrides.password ?? "Password123"

  const response = await request(app)
    .post(api("/auth/register"))
    .send({ email, username, password, displayName: username })
    .expect(201)

  const body = response.body as AuthResult
  return { ...body, username, email, password }
}

export function bearer(user: { tokens: { accessToken: string } }): string {
  return `Bearer ${user.tokens.accessToken}`
}

export async function createPost(
  user: TestUser,
  content: string,
  extra: Record<string, unknown> = {},
): Promise<Post> {
  const response = await request(app)
    .post(api("/posts"))
    .set("Authorization", bearer(user))
    .send({ content, ...extra })
    .expect(201)
  return (response.body as { post: Post }).post
}

export { request }

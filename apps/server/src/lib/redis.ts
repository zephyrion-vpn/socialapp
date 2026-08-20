/**
 * Redis is entirely optional: it is used as a shared cache for trends and
 * counters when REDIS_URL points at a Railway Redis service. Without it the
 * API falls back to an in-process cache, so a single service deployment works
 * out of the box.
 */
import type Redis from "ioredis"

import { env } from "../config/env"
import { logger } from "./logger"

let client: Redis | null = null
let initialised = false

export function getRedis(): Redis | null {
  if (initialised) return client
  initialised = true
  if (!env.REDIS_URL) return null

  try {
    // Lazy require so the dependency is never loaded when Redis is unused.
    const { default: RedisClient } = require("ioredis") as { default: typeof Redis }
    client = new RedisClient(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: false,
    })
    client.on("error", (error: Error) => logger.warn({ err: error }, "Redis error"))
    client.on("connect", () => logger.info("Redis connected"))
  } catch (error) {
    logger.warn({ err: error }, "Redis unavailable, falling back to in-process cache")
    client = null
  }
  return client
}

const memoryCache = new Map<string, { value: string; expiresAt: number }>()

export async function cacheGet(key: string): Promise<string | null> {
  const redis = getRedis()
  if (redis) {
    try {
      return await redis.get(key)
    } catch {
      /* fall through to memory cache */
    }
  }
  const entry = memoryCache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key)
    return null
  }
  return entry.value
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(key, value, "EX", ttlSeconds)
      return
    } catch {
      /* fall through to memory cache */
    }
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    try {
      await redis.del(key)
    } catch {
      /* ignore */
    }
  }
  memoryCache.delete(key)
}

export async function checkRedis(): Promise<{ configured: boolean; ok: boolean; latencyMs?: number }> {
  const redis = getRedis()
  if (!redis) return { configured: false, ok: true }
  const startedAt = Date.now()
  try {
    await redis.ping()
    return { configured: true, ok: true, latencyMs: Date.now() - startedAt }
  } catch {
    return { configured: true, ok: false, latencyMs: Date.now() - startedAt }
  }
}

export async function disconnectRedis(): Promise<void> {
  if (!client) return
  try {
    await client.quit()
  } catch {
    client.disconnect()
  }
  client = null
}

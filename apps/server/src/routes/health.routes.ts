import { APP_NAME, type HealthStatus } from "@socialapp/shared"
import { Router } from "express"

import { env } from "../config/env"
import { asyncHandler } from "../lib/http"
import { checkDatabase } from "../lib/prisma"
import { checkRedis } from "../lib/redis"

export const healthRouter = Router()

/**
 * Railway healthcheck target. Always answers 200 while the process is alive so
 * a transient database blip does not take the deployment down; the payload
 * reports `degraded` instead.
 */
healthRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const [database, redis] = await Promise.all([checkDatabase(), checkRedis()])

    const payload: HealthStatus = {
      status: database.ok ? "ok" : "degraded",
      version: env.APP_VERSION,
      environment: env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: database.ok ? "ok" : "error",
          latencyMs: database.latencyMs,
          ...(database.message ? { message: database.message } : {}),
        },
        redis: redis.configured
          ? { status: redis.ok ? "ok" : "error", latencyMs: redis.latencyMs }
          : { status: "ok", message: "not configured" },
        storage: {
          status: "ok",
          message: env.storageEnabled ? env.STORAGE_PROVIDER : "not configured",
        },
      },
    }

    res.json(payload)
  }),
)

/** Liveness: the process is running. */
healthRouter.get("/health/live", (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) })
})

/** Readiness: the process can serve traffic (database reachable). */
healthRouter.get(
  "/health/ready",
  asyncHandler(async (_req, res) => {
    const database = await checkDatabase()
    res.status(database.ok ? 200 : 503).json({
      status: database.ok ? "ok" : "error",
      database: database.ok ? "ok" : "unreachable",
    })
  }),
)

healthRouter.get("/version", (_req, res) => {
  res.json({ name: APP_NAME, version: env.APP_VERSION })
})

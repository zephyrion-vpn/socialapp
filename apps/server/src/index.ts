import { createApp } from "./app"
import { env } from "./config/env"
import { logger } from "./lib/logger"
import { checkDatabase, disconnectPrisma } from "./lib/prisma"
import { disconnectRedis } from "./lib/redis"

async function bootstrap(): Promise<void> {
  const app = createApp()

  // Railway injects PORT - always bind to it and to 0.0.0.0.
  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(
      {
        port: env.PORT,
        host: env.HOST,
        environment: env.NODE_ENV,
        version: env.APP_VERSION,
        storage: env.STORAGE_PROVIDER,
        redis: env.REDIS_URL ? "configured" : "disabled",
      },
      "SocialApp API listening",
    )
  })

  // Keep-alive tuning for platforms with an HTTP proxy in front.
  server.keepAliveTimeout = 65_000
  server.headersTimeout = 70_000

  const health = await checkDatabase()
  if (!health.ok) {
    logger.warn(
      "Database is not reachable yet. The API stays up and will retry on the next request - check DATABASE_URL.",
    )
  }

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, "Shutting down")

    const forceExit = setTimeout(() => {
      logger.error("Forced shutdown after timeout")
      process.exit(1)
    }, 15_000)
    forceExit.unref()

    server.close(async () => {
      try {
        await disconnectRedis()
        await disconnectPrisma()
      } finally {
        clearTimeout(forceExit)
        process.exit(0)
      }
    })
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"))
  process.on("SIGINT", () => void shutdown("SIGINT"))
  process.on("unhandledRejection", (reason) => logger.error({ err: reason }, "Unhandled rejection"))
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception")
    void shutdown("uncaughtException")
  })
}

void bootstrap()

import { API_PREFIX } from "@socialapp/shared"
import compression from "compression"
import cors from "cors"
import express, { type Express } from "express"
import helmet from "helmet"

import { env } from "./config/env"
import { errorHandler, notFoundHandler } from "./middleware/error"
import { apiLimiter } from "./middleware/rate-limit"
import { requestContext } from "./middleware/request-context"
import { apiRouter } from "./routes"
import { healthRouter } from "./routes/health.routes"

export function createApp(): Express {
  const app = express()

  app.disable("x-powered-by")
  // Railway terminates TLS in front of the container.
  app.set("trust proxy", env.TRUST_PROXY)

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "no-referrer" },
    }),
  )
  app.use(
    cors({
      origin: env.corsOrigins === "*" ? true : env.corsOrigins,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id", "RateLimit", "RateLimit-Policy"],
      // Bearer tokens only - no cookies, so credentials are not needed.
      credentials: false,
      maxAge: 86_400,
    }),
  )
  app.use(compression())
  app.use(express.json({ limit: "256kb" }))
  app.use(express.urlencoded({ extended: false, limit: "256kb" }))
  app.use(requestContext)

  // Unprefixed operational endpoints (Railway healthcheck target).
  app.use(healthRouter)

  // Versioned API surface.
  app.use(API_PREFIX, apiLimiter, apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

import pino from "pino"

import { env } from "../config/env"

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "socialapp-api", env: env.NODE_ENV },
  redact: {
    paths: [
      "req.headers.authorization",
      "password",
      "newPassword",
      "currentPassword",
      "passwordHash",
      "refreshToken",
      "accessToken",
      "token",
    ],
    censor: "[redacted]",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
})

export type Logger = typeof logger

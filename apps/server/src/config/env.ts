import { existsSync } from "node:fs"
import path from "node:path"

import dotenv from "dotenv"
import { z } from "zod"

// Local development convenience: load the first .env that exists.
// In production (Railway) variables come from the platform environment.
const envFiles = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "apps/server/.env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../../.env"),
]
for (const file of envFiles) {
  if (existsSync(file)) dotenv.config({ path: file })
}

const optionalString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
  })

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  APP_VERSION: z.string().default("1.0.0"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: optionalString,

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  CORS_ORIGINS: z.string().default("*"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).default(300),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1),
  LOG_LEVEL: z
    .enum(["silent", "fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  PUBLIC_APP_URL: optionalString,

  STORAGE_PROVIDER: z.enum(["none", "s3", "r2"]).default("none"),
  S3_ENDPOINT: optionalString,
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_PUBLIC_BASE_URL: optionalString,
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n")
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}\n`)
  process.exit(1)
}

const raw = parsed.data

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === "production",
  isTest: raw.NODE_ENV === "test",
  isDevelopment: raw.NODE_ENV === "development",
  corsOrigins:
    raw.CORS_ORIGINS.trim() === "*"
      ? "*"
      : raw.CORS_ORIGINS.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
  storageEnabled: raw.STORAGE_PROVIDER !== "none",
}

export type Env = typeof env

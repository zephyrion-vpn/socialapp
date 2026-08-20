import { PrismaClient } from "@prisma/client"

import { env } from "../config/env"
import { logger } from "./logger"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDevelopment ? ["warn", "error"] : ["error"],
  })

if (!env.isProduction) globalForPrisma.prisma = prisma

export async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
  const startedAt = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { ok: true, latencyMs: Date.now() - startedAt }
  } catch (error) {
    logger.error({ err: error }, "Database health check failed")
    return { ok: false, latencyMs: Date.now() - startedAt, message: (error as Error).message }
  }
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect()
}

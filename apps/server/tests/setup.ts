// Vitest global setup: runs once per test file before any test.
process.env.NODE_ENV = "test"
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "silent"
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? "test-only-secret-value-0123456789abcdef"
process.env.BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS ?? "4"
process.env.STORAGE_PROVIDER = process.env.STORAGE_PROVIDER ?? "none"

import { afterAll, beforeAll } from "vitest"

import { prisma } from "../src/lib/prisma"
import { resetDatabase } from "./helpers"

beforeAll(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await prisma.$disconnect()
})

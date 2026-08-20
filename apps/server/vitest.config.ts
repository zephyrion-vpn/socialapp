import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Integration tests share one PostgreSQL database - run files sequentially.
    fileParallelism: false,
    pool: "forks",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    reporters: "default",
  },
})

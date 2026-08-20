#!/usr/bin/env node
/**
 * Container entrypoint for the SocialApp API (Railway / Docker).
 *
 * Responsibilities, in order:
 *   1. Resolve DATABASE_URL from the aliases Railway may expose.
 *   2. Fail fast, with an actionable message, when a required variable is absent.
 *   3. Apply pending Prisma migrations - retried, but never fatal.
 *   4. Start the compiled API and forward termination signals to it.
 *
 * Migrations must not gate startup: if the database is briefly unreachable the
 * API still boots, /health answers 200 with status "degraded", and the platform
 * healthcheck passes instead of killing the deployment.
 */
import { spawn, spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const serverDir = path.resolve(scriptDir, "..")
const repoRoot = path.resolve(serverDir, "..", "..")
const schemaPath = path.join(serverDir, "prisma", "schema.prisma")
const entryPoint = path.join(serverDir, "dist", "index.js")

const log = (message) => console.log(`[start] ${message}`)
const warn = (message) => console.warn(`[start] ${message}`)
const fail = (message) => {
  console.error(`[start] ${message}`)
  process.exit(1)
}

/** Railway exposes the connection string under different names per setup. */
const DATABASE_URL_ALIASES = [
  "DATABASE_URL",
  "DATABASE_PRIVATE_URL",
  "POSTGRES_URL",
  "POSTGRESQL_URL",
  "DATABASE_PUBLIC_URL",
]

function composeFromParts() {
  const { PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT } = process.env
  if (!PGHOST || !PGUSER || !PGPASSWORD) return undefined
  const auth = `${encodeURIComponent(PGUSER)}:${encodeURIComponent(PGPASSWORD)}`
  return `postgresql://${auth}@${PGHOST}:${PGPORT || "5432"}/${PGDATABASE || "railway"}`
}

function resolveDatabaseUrl() {
  for (const key of DATABASE_URL_ALIASES) {
    const value = process.env[key]?.trim()
    if (value) return { url: value, source: key }
  }
  const composed = composeFromParts()
  return composed ? { url: composed, source: "PGHOST/PGUSER/PGPASSWORD" } : undefined
}

/** Host and database name only - the connection string carries credentials. */
function describeTarget(url) {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`
  } catch {
    return "unparseable connection string"
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function runMigrations() {
  const prismaBin = path.join(repoRoot, "node_modules", ".bin", "prisma")
  const useLocalBin = existsSync(prismaBin)
  const command = useLocalBin ? prismaBin : "npx"
  const args = useLocalBin
    ? ["migrate", "deploy", "--schema", schemaPath]
    : ["prisma", "migrate", "deploy", "--schema", schemaPath]

  const attempts = Math.max(1, Number(process.env.MIGRATE_ATTEMPTS || 3))
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    log(`applying migrations (attempt ${attempt}/${attempts})`)
    const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit", env: process.env })
    if (result.status === 0) {
      log("migrations up to date")
      return
    }
    if (attempt < attempts) sleepSync(5_000)
  }
  warn(
    "migrations could not be applied - starting the API anyway. " +
      '/health will report "degraded" until the database is reachable.',
  )
}

// ---- 1. database configuration ---------------------------------------------
const database = resolveDatabaseUrl()
if (!database) {
  fail(
    [
      "DATABASE_URL is not set.",
      "On Railway: add a PostgreSQL service, then set this variable on the API service",
      "and redeploy:",
      '  DATABASE_URL=${{Postgres.DATABASE_URL}}',
    ].join("\n        "),
  )
}

process.env.DATABASE_URL = database.url
if (database.source !== "DATABASE_URL") log(`DATABASE_URL resolved from ${database.source}`)
log(`database target: ${describeTarget(database.url)}`)

// ---- 2. secrets ------------------------------------------------------------
const jwtSecret = process.env.JWT_ACCESS_SECRET?.trim()
if (!jwtSecret || jwtSecret.length < 16) {
  fail(
    [
      "JWT_ACCESS_SECRET is missing or shorter than 16 characters.",
      "Generate one and add it as a service variable:",
      '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    ].join("\n        "),
  )
}

// ---- 3. migrations ---------------------------------------------------------
if (process.env.SKIP_MIGRATIONS === "1") {
  log("SKIP_MIGRATIONS=1 - skipping prisma migrate deploy")
} else {
  runMigrations()
}

// ---- 4. API process --------------------------------------------------------
if (!existsSync(entryPoint)) {
  fail(`compiled server not found at ${entryPoint} - run "npm run build -w @socialapp/server"`)
}

log(`starting API on ${process.env.HOST || "0.0.0.0"}:${process.env.PORT || "3000"}`)

const child = spawn(process.execPath, [entryPoint], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
})

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    if (child.exitCode === null) child.kill(signal)
  })
}

child.on("error", (error) => fail(`failed to start the API: ${error.message}`))
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)))

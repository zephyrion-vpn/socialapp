#!/usr/bin/env node
/**
 * Synchronises the version across the whole monorepo.
 * The desktop application version (and therefore the produced
 * SocialApp-Setup-<version>.exe) always follows this value.
 *
 *   node scripts/set-version.mjs 1.2.3
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const raw = process.argv[2]
if (!raw) {
  console.error("usage: node scripts/set-version.mjs <version>")
  process.exit(1)
}

const version = raw.trim().replace(/^v/i, "")
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`invalid semver version: "${raw}"`)
  process.exit(1)
}

const targets = [
  "package.json",
  "packages/shared/package.json",
  "packages/api-client/package.json",
  "apps/server/package.json",
  "apps/desktop/package.json",
]

let changed = 0
for (const target of targets) {
  const file = join(root, target)
  let content
  try {
    content = readFileSync(file, "utf8")
  } catch {
    console.warn(`skip (not found): ${target}`)
    continue
  }
  const pkg = JSON.parse(content)
  const previous = pkg.version
  pkg.version = version
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log(`${target}: ${previous} -> ${version}`)
  changed += 1
}

console.log(`\nversion set to ${version} in ${changed} package(s)`)

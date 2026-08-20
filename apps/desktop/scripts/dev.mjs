// Development runner: Vite dev server for the renderer + Electron pointed at it.
// The backend is NOT started here - run it separately (npm run dev:server).
import { spawn, spawnSync } from "node:child_process"
import process from "node:process"
import { createServer } from "vite"

process.env.NODE_ENV = process.env.NODE_ENV ?? "development"

const mainBuild = spawnSync(process.execPath, ["scripts/build-main.mjs"], {
  stdio: "inherit",
  env: process.env,
})
if (mainBuild.status !== 0) process.exit(mainBuild.status ?? 1)

const server = await createServer({ configFile: "vite.config.ts" })
await server.listen()
server.printUrls()

const url = server.resolvedUrls?.local?.[0] ?? "http://localhost:5273"
const electronPath = (await import("electron")).default

const child = spawn(electronPath, ["."], {
  stdio: "inherit",
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
})

child.on("close", async (code) => {
  await server.close()
  process.exit(code ?? 0)
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill()
  })
}

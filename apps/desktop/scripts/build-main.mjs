// Bundles the Electron main process and preload script with esbuild.
// Everything is inlined, so the packaged app does not depend on node_modules
// layout (electron and electron-updater stay external by design).
import { build } from "esbuild"
import { readFileSync } from "node:fs"

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))

const isDev = process.env.NODE_ENV === "development"
const PRODUCTION_FALLBACK_API_URL = "https://socialappserver-production.up.railway.app"

const apiUrl =
  process.env.SOCIALAPP_API_URL?.trim() ||
  (isDev ? "http://localhost:3000" : PRODUCTION_FALLBACK_API_URL)

console.log(`[build-main] default API URL: ${apiUrl}`)

await build({
  entryPoints: {
    main: "electron/main.ts",
    preload: "electron/preload.ts",
  },
  outdir: "dist-electron",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  minify: !isDev,
  sourcemap: isDev ? "inline" : false,
  external: ["electron", "electron-updater"],
  define: {
    __DEFAULT_API_URL__: JSON.stringify(apiUrl),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  logLevel: "info",
})

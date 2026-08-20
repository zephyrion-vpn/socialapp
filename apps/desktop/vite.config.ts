import react from "@vitejs/plugin-react"
import path from "node:path"
import { defineConfig } from "vite"

const DEV_PORT = 5273

// Default API endpoints. Override at build time with SOCIALAPP_API_URL, or at
// runtime in the app under Settings > Server - no code changes needed.
const PRODUCTION_API_URL = "https://socialappserver-production.up.railway.app"
const DEVELOPMENT_API_URL = "http://localhost:3000"

// npm workspaces symlinks packages/* into node_modules, so Vite resolves them to
// their real path (packages/<name>/dist/...), i.e. outside node_modules. Rollup
// only applies the CommonJS -> ESM interop to ids matched by
// build.commonjsOptions.include (default: [/node_modules/]), and @socialapp/*
// is compiled to CommonJS - without the entry below, named imports such as
// `import { ApiClient } from "@socialapp/api-client"` cannot be resolved and the
// production build fails.
const LINKED_CJS_PACKAGES = /packages[\\/](api-client|shared)[\\/]/

// The renderer is a plain SPA bundle loaded from the packaged app over file://,
// so the base must be relative.
export default defineConfig(({ command }) => ({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  define: {
    __DEFAULT_API_URL__: JSON.stringify(
      process.env.SOCIALAPP_API_URL?.trim() ||
        (command === "build" ? PRODUCTION_API_URL : DEVELOPMENT_API_URL),
    ),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome128",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    commonjsOptions: {
      include: [/node_modules/, LINKED_CJS_PACKAGES],
      transformMixedEsModules: true,
    },
  },
  // Same reason, for the dev server's dependency pre-bundling step.
  optimizeDeps: {
    include: ["@socialapp/api-client", "@socialapp/shared"],
  },
  server: {
    port: DEV_PORT,
    strictPort: true,
  },
}))

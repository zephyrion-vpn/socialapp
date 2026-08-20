import react from "@vitejs/plugin-react"
import path from "node:path"
import { defineConfig } from "vite"

const DEV_PORT = 5273

// The renderer is a plain SPA bundle loaded from the packaged app over file://,
// so the base must be relative.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  define: {
    __DEFAULT_API_URL__: JSON.stringify(
      process.env.SOCIALAPP_API_URL?.trim() || "http://localhost:3000",
    ),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome128",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: DEV_PORT,
    strictPort: true,
  },
})

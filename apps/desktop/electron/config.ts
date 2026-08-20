import { isHttpUrl, normalizeUrl, readSettings } from "./settings"

/**
 * The API URL baked in at build time (SOCIALAPP_API_URL). Never contains
 * secrets - only a public HTTPS endpoint.
 */
export const BUILD_TIME_API_URL: string =
  typeof __DEFAULT_API_URL__ === "string" && __DEFAULT_API_URL__
    ? __DEFAULT_API_URL__
    : "http://localhost:3000"

export const APP_VERSION: string =
  typeof __APP_VERSION__ === "string" && __APP_VERSION__ ? __APP_VERSION__ : "0.0.0"

/**
 * Resolution order (no code changes needed to switch environments):
 *   1. SOCIALAPP_API_URL environment variable
 *   2. the URL the user typed in Settings -> Server
 *   3. the URL baked in at build time
 */
export function resolveApiUrl(): string {
  const fromEnv = process.env.SOCIALAPP_API_URL?.trim()
  if (fromEnv && isHttpUrl(fromEnv)) return normalizeUrl(fromEnv)

  const fromSettings = readSettings().apiUrl
  if (fromSettings && isHttpUrl(fromSettings)) return normalizeUrl(fromSettings)

  return normalizeUrl(BUILD_TIME_API_URL)
}

import { app } from "electron"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

export type ThemePreference = "system" | "light" | "dark"

export interface AppSettings {
  /** Overrides the API URL baked into the build. */
  apiUrl: string | null
  theme: ThemePreference
  density: "comfortable" | "compact"
  desktopNotifications: boolean
  autoCheckUpdates: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: null,
  theme: "system",
  density: "comfortable",
  desktopNotifications: true,
  autoCheckUpdates: true,
}

function settingsFile(): string {
  return path.join(app.getPath("userData"), "settings.json")
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "")
}

export function readSettings(): AppSettings {
  try {
    const file = settingsFile()
    if (!existsSync(file)) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<AppSettings>
    return {
      apiUrl:
        typeof parsed.apiUrl === "string" && isHttpUrl(parsed.apiUrl)
          ? normalizeUrl(parsed.apiUrl)
          : null,
      theme:
        parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system"
          ? parsed.theme
          : DEFAULT_SETTINGS.theme,
      density: parsed.density === "compact" ? "compact" : "comfortable",
      desktopNotifications: parsed.desktopNotifications !== false,
      autoCheckUpdates: parsed.autoCheckUpdates !== false,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function writeSettings(settings: AppSettings): AppSettings {
  const file = settingsFile()
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, "utf8")
  return settings
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const current = readSettings()
  const next: AppSettings = { ...current }

  if ("apiUrl" in patch) {
    const value = patch.apiUrl
    if (value === null || value === "") next.apiUrl = null
    else if (typeof value === "string" && isHttpUrl(value)) next.apiUrl = normalizeUrl(value)
  }
  if (patch.theme) next.theme = patch.theme
  if (patch.density) next.density = patch.density
  if (typeof patch.desktopNotifications === "boolean") {
    next.desktopNotifications = patch.desktopNotifications
  }
  if (typeof patch.autoCheckUpdates === "boolean") next.autoCheckUpdates = patch.autoCheckUpdates

  return writeSettings(next)
}

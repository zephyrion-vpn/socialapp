import { BrowserWindow, Notification, app, ipcMain, nativeTheme, shell } from "electron"

import { APP_VERSION, resolveApiUrl } from "./config"
import { clearSession, readSession, writeSession, type StoredSession } from "./secure-store"
import { readSettings, updateSettings, type AppSettings } from "./settings"
import { checkForUpdates, downloadAndInstall, getUpdateStatus } from "./updater"

export interface AppInfo {
  apiUrl: string
  version: string
  platform: string
  isPackaged: boolean
}

function appInfo(): AppInfo {
  return {
    apiUrl: resolveApiUrl(),
    version: app.getVersion() || APP_VERSION,
    platform: process.platform,
    isPackaged: app.isPackaged,
  }
}

export function registerIpcHandlers(): void {
  // Synchronous so the preload script can expose the API URL immediately.
  ipcMain.on("app:info-sync", (event) => {
    event.returnValue = appInfo()
  })
  ipcMain.handle("app:info", () => appInfo())

  // --- settings ------------------------------------------------------------
  ipcMain.handle("settings:get", () => readSettings())
  ipcMain.handle("settings:update", (_event, patch: Partial<AppSettings>) => {
    const settings = updateSettings(patch ?? {})
    if (settings.theme) nativeTheme.themeSource = settings.theme
    return { settings, apiUrl: resolveApiUrl() }
  })

  // --- session (encrypted at rest) ----------------------------------------
  ipcMain.handle("session:get", () => readSession())
  ipcMain.handle("session:set", (_event, session: StoredSession) => {
    writeSession(session)
    return true
  })
  ipcMain.handle("session:clear", () => {
    clearSession()
    return true
  })

  // --- shell / OS integration ---------------------------------------------
  ipcMain.handle("shell:openExternal", async (_event, url: string) => {
    if (typeof url !== "string") return false
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false
      await shell.openExternal(url)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle("notify:show", (_event, payload: { title: string; body?: string }) => {
    if (!readSettings().desktopNotifications) return false
    if (!Notification.isSupported()) return false
    new Notification({ title: payload?.title ?? "SocialApp", body: payload?.body ?? "" }).show()
    return true
  })

  ipcMain.handle("badge:set", (_event, count: number) => {
    if (typeof count === "number" && Number.isFinite(count)) {
      app.setBadgeCount(Math.max(0, Math.trunc(count)))
    }
    return true
  })

  ipcMain.handle("window:setTitle", (event, title: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window && typeof title === "string") window.setTitle(title)
    return true
  })

  // --- updates -------------------------------------------------------------
  ipcMain.handle("updates:status", () => getUpdateStatus())
  ipcMain.handle("updates:check", () => checkForUpdates())
  ipcMain.handle("updates:install", () => downloadAndInstall())
}

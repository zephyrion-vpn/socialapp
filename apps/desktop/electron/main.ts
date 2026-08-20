import { BrowserWindow, app, nativeTheme, session, shell } from "electron"
import { existsSync } from "node:fs"
import path from "node:path"

import { resolveApiUrl } from "./config"
import { registerIpcHandlers } from "./ipc"
import { buildApplicationMenu } from "./menu"
import { readSettings } from "./settings"
import { initAutoUpdater } from "./updater"

const isDev = !app.isPackaged
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5273"

// Required for correct taskbar grouping, shortcuts and toast notifications.
app.setAppUserModelId("com.socialapp.desktop")

let mainWindow: BrowserWindow | null = null

function iconPath(): string | undefined {
  const candidate = path.join(__dirname, "..", "build", "icon.ico")
  return existsSync(candidate) ? candidate : undefined
}

function applySecurityPolicy(): void {
  const apiUrl = resolveApiUrl()
  // Allow only what the client actually needs: its own bundle, the API and
  // images from object storage.
  const connect = ["'self'", apiUrl, "https:", ...(isDev ? ["ws:", "http://localhost:*"] : [])].join(" ")
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: https:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ")

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    })
  })

  // Nothing in this app needs camera, microphone or geolocation.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
}

function createWindow(): BrowserWindow {
  const settings = readSettings()
  nativeTheme.themeSource = settings.theme

  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 880,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0b0b10" : "#ffffff",
    title: "SocialApp",
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: true,
    },
  })

  window.once("ready-to-show", () => window.show())

  // External links open in the default browser, never inside the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) void shell.openExternal(url)
    return { action: "deny" }
  })

  window.webContents.on("will-navigate", (event, url) => {
    const allowed = isDev ? DEV_SERVER_URL : "file://"
    if (!url.startsWith(allowed)) {
      event.preventDefault()
      if (url.startsWith("http")) void shell.openExternal(url)
    }
  })

  if (isDev) {
    void window.loadURL(DEV_SERVER_URL)
  } else {
    void window.loadFile(path.join(__dirname, "..", "dist", "index.html"))
  }

  window.on("closed", () => {
    mainWindow = null
  })

  return window
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(() => {
    applySecurityPolicy()
    registerIpcHandlers()

    mainWindow = createWindow()
    buildApplicationMenu(mainWindow, isDev)
    initAutoUpdater(mainWindow, readSettings().autoCheckUpdates)

    nativeTheme.on("updated", () => {
      mainWindow?.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#0b0b10" : "#ffffff")
    })

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow()
        buildApplicationMenu(mainWindow, isDev)
      }
    })
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })

  // Defence in depth: refuse to attach a preload we did not ship.
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (event) => event.preventDefault())
  })
}

import type { BrowserWindow } from "electron"
import { app } from "electron"

export interface UpdateStatus {
  state: "disabled" | "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error"
  version?: string
  percent?: number
  message?: string
}

type AnyUpdater = {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  logger: unknown
  on: (event: string, handler: (payload: any) => void) => void
  checkForUpdates: () => Promise<any>
  downloadUpdate: () => Promise<any>
  quitAndInstall: (silent?: boolean, forceRunAfter?: boolean) => void
}

let updater: AnyUpdater | null = null
let status: UpdateStatus = { state: "idle" }
let target: BrowserWindow | null = null

function emit(next: UpdateStatus): void {
  status = next
  if (target && !target.isDestroyed()) target.webContents.send("updates:status", next)
}

/**
 * electron-updater is loaded lazily: an unpackaged dev run or a missing module
 * must never crash the app. Updates flow from GitHub Releases (see the
 * `publish` block in electron-builder.yml).
 */
function load(): AnyUpdater | null {
  if (updater) return updater
  if (!app.isPackaged) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("electron-updater") as { autoUpdater: AnyUpdater }
    updater = mod.autoUpdater
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = true
    updater.on("checking-for-update", () => emit({ state: "checking" }))
    updater.on("update-available", (info: { version?: string }) =>
      emit({ state: "available", version: info?.version }),
    )
    updater.on("update-not-available", () => emit({ state: "not-available" }))
    updater.on("download-progress", (progress: { percent?: number }) =>
      emit({ state: "downloading", percent: Math.round(progress?.percent ?? 0) }),
    )
    updater.on("update-downloaded", (info: { version?: string }) =>
      emit({ state: "downloaded", version: info?.version }),
    )
    updater.on("error", (error: Error) =>
      emit({ state: "error", message: error?.message ?? "Update failed" }),
    )
    return updater
  } catch {
    return null
  }
}

export function initAutoUpdater(window: BrowserWindow, autoCheck: boolean): void {
  target = window
  const instance = load()
  if (!instance) {
    status = { state: "disabled" }
    return
  }
  if (autoCheck) {
    // Give the window a moment before hitting the network.
    setTimeout(() => {
      void instance.checkForUpdates().catch(() => undefined)
    }, 8000)
  }
}

export function getUpdateStatus(): UpdateStatus {
  return status
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  const instance = load()
  if (!instance) return { state: "disabled", message: "Updates are only available in the installed app" }
  try {
    await instance.checkForUpdates()
  } catch (error) {
    emit({ state: "error", message: (error as Error)?.message })
  }
  return status
}

export async function downloadAndInstall(): Promise<UpdateStatus> {
  const instance = load()
  if (!instance) return { state: "disabled" }
  try {
    if (status.state !== "downloaded") await instance.downloadUpdate()
    instance.quitAndInstall(false, true)
  } catch (error) {
    emit({ state: "error", message: (error as Error)?.message })
  }
  return status
}

import { contextBridge, ipcRenderer } from "electron"

interface StoredSession {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt?: string
  refreshTokenExpiresAt?: string
}

const config = ipcRenderer.sendSync("app:info-sync") as {
  apiUrl: string
  version: string
  platform: string
  isPackaged: boolean
}

/**
 * The only bridge between the renderer and the OS. No Node APIs and no remote
 * module are exposed, and nothing here can reach the filesystem directly.
 */
const api = {
  config,

  session: {
    get: (): Promise<StoredSession | null> => ipcRenderer.invoke("session:get"),
    set: (session: StoredSession): Promise<boolean> => ipcRenderer.invoke("session:set", session),
    clear: (): Promise<boolean> => ipcRenderer.invoke("session:clear"),
  },

  settings: {
    get: (): Promise<Record<string, unknown>> => ipcRenderer.invoke("settings:get"),
    update: (patch: Record<string, unknown>): Promise<{ settings: Record<string, unknown>; apiUrl: string }> =>
      ipcRenderer.invoke("settings:update", patch),
  },

  system: {
    openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke("shell:openExternal", url),
    notify: (payload: { title: string; body?: string }): Promise<boolean> =>
      ipcRenderer.invoke("notify:show", payload),
    setBadge: (count: number): Promise<boolean> => ipcRenderer.invoke("badge:set", count),
    setTitle: (title: string): Promise<boolean> => ipcRenderer.invoke("window:setTitle", title),
  },

  updates: {
    status: (): Promise<unknown> => ipcRenderer.invoke("updates:status"),
    check: (): Promise<unknown> => ipcRenderer.invoke("updates:check"),
    install: (): Promise<unknown> => ipcRenderer.invoke("updates:install"),
    onStatus: (listener: (status: unknown) => void): (() => void) => {
      const handler = (_event: unknown, status: unknown) => listener(status)
      ipcRenderer.on("updates:status", handler)
      return () => ipcRenderer.removeListener("updates:status", handler)
    },
  },

  menu: {
    onAction: (listener: (action: string) => void): (() => void) => {
      const handler = (_event: unknown, action: string) => listener(action)
      ipcRenderer.on("menu:action", handler)
      return () => ipcRenderer.removeListener("menu:action", handler)
    },
  },
}

contextBridge.exposeInMainWorld("socialapp", api)

export type SocialAppBridge = typeof api

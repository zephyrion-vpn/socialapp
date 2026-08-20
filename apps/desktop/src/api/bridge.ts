import type {
  AppConfig,
  BridgeSession,
  DesktopSettings,
  SocialAppBridge,
  UpdateStatus,
} from "@/types"

const FALLBACK_API_URL =
  typeof __DEFAULT_API_URL__ === "string" && __DEFAULT_API_URL__
    ? __DEFAULT_API_URL__
    : "http://localhost:3000"

const FALLBACK_SETTINGS: DesktopSettings = {
  apiUrl: null,
  theme: "system",
  density: "comfortable",
  desktopNotifications: true,
  autoCheckUpdates: true,
}

/**
 * The renderer also has to run inside a plain browser during development, so
 * every bridge call degrades gracefully when Electron is not present.
 */
let memorySession: BridgeSession | null = null
let memorySettings: DesktopSettings = { ...FALLBACK_SETTINGS }

const fallbackBridge: SocialAppBridge = {
  config: {
    apiUrl: FALLBACK_API_URL,
    version: "dev",
    platform: "web",
    isPackaged: false,
  },
  session: {
    get: async () => memorySession,
    set: async (session) => {
      memorySession = session
      return true
    },
    clear: async () => {
      memorySession = null
      return true
    },
  },
  settings: {
    get: async () => memorySettings,
    update: async (patch) => {
      memorySettings = { ...memorySettings, ...patch }
      return { settings: memorySettings, apiUrl: memorySettings.apiUrl ?? FALLBACK_API_URL }
    },
  },
  system: {
    openExternal: async (url) => {
      window.open(url, "_blank", "noopener,noreferrer")
      return true
    },
    notify: async () => false,
    setBadge: async () => false,
    setTitle: async (title) => {
      document.title = title
      return true
    },
  },
  updates: {
    status: async () => ({ state: "disabled" }) as UpdateStatus,
    check: async () => ({ state: "disabled" }) as UpdateStatus,
    install: async () => ({ state: "disabled" }) as UpdateStatus,
    onStatus: () => () => undefined,
  },
  menu: {
    onAction: () => () => undefined,
  },
}

export const bridge: SocialAppBridge = window.socialapp ?? fallbackBridge

export const isDesktopApp = Boolean(window.socialapp)

export const appConfig: AppConfig = bridge.config

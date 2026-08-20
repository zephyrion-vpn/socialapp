export type ThemePreference = "system" | "light" | "dark"

export interface DesktopSettings {
  apiUrl: string | null
  theme: ThemePreference
  density: "comfortable" | "compact"
  desktopNotifications: boolean
  autoCheckUpdates: boolean
}

export interface UpdateStatus {
  state:
    | "disabled"
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error"
  version?: string
  percent?: number
  message?: string
}

export interface BridgeSession {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt?: string
  refreshTokenExpiresAt?: string
}

export interface AppConfig {
  apiUrl: string
  version: string
  platform: string
  isPackaged: boolean
}

/** Everything the preload script exposes on `window.socialapp`. */
export interface SocialAppBridge {
  config: AppConfig
  session: {
    get: () => Promise<BridgeSession | null>
    set: (session: BridgeSession) => Promise<boolean>
    clear: () => Promise<boolean>
  }
  settings: {
    get: () => Promise<DesktopSettings>
    update: (patch: Partial<DesktopSettings>) => Promise<{ settings: DesktopSettings; apiUrl: string }>
  }
  system: {
    openExternal: (url: string) => Promise<boolean>
    notify: (payload: { title: string; body?: string }) => Promise<boolean>
    setBadge: (count: number) => Promise<boolean>
    setTitle: (title: string) => Promise<boolean>
  }
  updates: {
    status: () => Promise<UpdateStatus>
    check: () => Promise<UpdateStatus>
    install: () => Promise<UpdateStatus>
    onStatus: (listener: (status: UpdateStatus) => void) => () => void
  }
  menu: {
    onAction: (listener: (action: string) => void) => () => void
  }
}

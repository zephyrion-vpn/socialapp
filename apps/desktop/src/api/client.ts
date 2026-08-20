import { ApiClient, type StoredSession, type TokenStore } from "@socialapp/api-client"

import { bridge, appConfig } from "./bridge"

/**
 * Tokens live in the Electron main process, encrypted with the OS keychain.
 * The renderer keeps an in-memory copy to avoid an IPC round trip per request
 * and writes through on every change.
 */
class DesktopTokenStore implements TokenStore {
  private cache: StoredSession | null = null
  private hydrated = false

  async get(): Promise<StoredSession | null> {
    if (!this.hydrated) {
      this.cache = (await bridge.session.get()) as StoredSession | null
      this.hydrated = true
    }
    return this.cache
  }

  async set(session: StoredSession): Promise<void> {
    this.cache = session
    this.hydrated = true
    await bridge.session.set(session)
  }

  async clear(): Promise<void> {
    this.cache = null
    this.hydrated = true
    await bridge.session.clear()
  }
}

export const tokenStore = new DesktopTokenStore()

let onSessionExpired: (() => void) | null = null

export const api = new ApiClient({
  baseUrl: appConfig.apiUrl,
  tokenStore,
  onSessionExpired: () => onSessionExpired?.(),
})

/** Registered by the session store so a dead session logs the UI out. */
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler
}

export function setApiBaseUrl(url: string): void {
  api.setBaseUrl(url)
}

export function currentApiBaseUrl(): string {
  return api.apiBaseUrl
}

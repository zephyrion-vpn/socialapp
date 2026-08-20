import type { SocialAppBridge } from "./types"

declare global {
  /** Injected by Vite at build time. */
  const __DEFAULT_API_URL__: string

  interface Window {
    socialapp?: SocialAppBridge
  }
}

export {}

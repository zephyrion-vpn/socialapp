import { ApiError } from "@socialapp/api-client"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { bridge } from "@/api/bridge"
import type { DesktopSettings, ThemePreference, UpdateStatus } from "@/types"

export interface Toast {
  id: string
  message: string
  tone: "info" | "success" | "error"
}

interface UiValue {
  settings: DesktopSettings
  updateSettings: (patch: Partial<DesktopSettings>) => Promise<DesktopSettings>
  theme: ThemePreference
  resolvedTheme: "light" | "dark"
  setTheme: (theme: ThemePreference) => Promise<void>
  toasts: Toast[]
  toast: (message: string, tone?: Toast["tone"]) => void
  toastError: (error: unknown, fallback?: string) => void
  dismissToast: (id: string) => void
  isOnline: boolean
  updateStatus: UpdateStatus
  checkForUpdates: () => Promise<void>
  installUpdate: () => Promise<void>
  shortcutsOpen: boolean
  setShortcutsOpen: (open: boolean) => void
}

const UiContext = createContext<UiValue | null>(null)

const DEFAULT_SETTINGS: DesktopSettings = {
  apiUrl: null,
  theme: "system",
  density: "comfortable",
  desktopNotifications: true,
  autoCheckUpdates: true,
}

function systemTheme(): "light" | "dark" {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function humanizeError(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof ApiError) {
    if (error.isNetworkError) return "No connection to the server. Check your network."
    const fieldError = Object.values(error.fieldErrors)[0]
    return fieldError ?? error.message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DesktopSettings>(DEFAULT_SETTINGS)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: "idle" })
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [systemPreference, setSystemPreference] = useState<"light" | "dark">(systemTheme)

  useEffect(() => {
    void bridge.settings.get().then((loaded) => setSettings({ ...DEFAULT_SETTINGS, ...loaded }))
    void bridge.updates.status().then(setUpdateStatus)
    return bridge.updates.onStatus(setUpdateStatus)
  }, [])

  useEffect(() => {
    const online = () => setIsOnline(true)
    const offline = () => setIsOnline(false)
    window.addEventListener("online", online)
    window.addEventListener("offline", offline)
    return () => {
      window.removeEventListener("online", online)
      window.removeEventListener("offline", offline)
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)")
    if (!media) return
    const listener = () => setSystemPreference(media.matches ? "dark" : "light")
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [])

  const resolvedTheme = settings.theme === "system" ? systemPreference : settings.theme

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.dataset.density = settings.density
  }, [resolvedTheme, settings.density])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, tone: Toast["tone"] = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((current) => [...current.slice(-3), { id, message, tone }])
      window.setTimeout(() => dismissToast(id), tone === "error" ? 6000 : 3500)
    },
    [dismissToast],
  )

  const toastError = useCallback(
    (error: unknown, fallback?: string) => toast(humanizeError(error, fallback), "error"),
    [toast],
  )

  const updateSettings = useCallback(async (patch: Partial<DesktopSettings>) => {
    const result = await bridge.settings.update(patch)
    const next = { ...DEFAULT_SETTINGS, ...result.settings }
    setSettings(next)
    return next
  }, [])

  const setTheme = useCallback(
    async (theme: ThemePreference) => {
      await updateSettings({ theme })
    },
    [updateSettings],
  )

  const checkForUpdates = useCallback(async () => {
    const status = await bridge.updates.check()
    setUpdateStatus(status)
    if (status.state === "not-available") toast("You are on the latest version", "success")
    if (status.state === "disabled") toast("Updates are available in the installed app only")
    if (status.state === "error") toast(status.message ?? "Update check failed", "error")
  }, [toast])

  const installUpdate = useCallback(async () => {
    const status = await bridge.updates.install()
    setUpdateStatus(status)
  }, [])

  const value = useMemo<UiValue>(
    () => ({
      settings,
      updateSettings,
      theme: settings.theme,
      resolvedTheme,
      setTheme,
      toasts,
      toast,
      toastError,
      dismissToast,
      isOnline,
      updateStatus,
      checkForUpdates,
      installUpdate,
      shortcutsOpen,
      setShortcutsOpen,
    }),
    [
      settings,
      updateSettings,
      resolvedTheme,
      setTheme,
      toasts,
      toast,
      toastError,
      dismissToast,
      isOnline,
      updateStatus,
      checkForUpdates,
      installUpdate,
      shortcutsOpen,
    ],
  )

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export function useUi(): UiValue {
  const context = useContext(UiContext)
  if (!context) throw new Error("useUi must be used inside UiProvider")
  return context
}

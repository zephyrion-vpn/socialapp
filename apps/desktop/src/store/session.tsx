import type { PublicUser } from "@socialapp/shared"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { api, setSessionExpiredHandler, tokenStore } from "@/api/client"

type SessionStatus = "restoring" | "anonymous" | "authenticated"

interface SessionValue {
  status: SessionStatus
  user: PublicUser | null
  login: (input: { identifier: string; password: string }) => Promise<void>
  register: (input: {
    email: string
    username: string
    password: string
    displayName?: string
  }) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  patchUser: (user: PublicUser) => void
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("restoring")
  const [user, setUser] = useState<PublicUser | null>(null)

  // Restore the encrypted session saved by the main process.
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const stored = await tokenStore.get()
      if (!stored?.accessToken) {
        if (!cancelled) setStatus("anonymous")
        return
      }
      try {
        const { user: me } = await api.auth.me()
        if (cancelled) return
        setUser(me)
        setStatus("authenticated")
      } catch {
        if (cancelled) return
        // Expired or revoked - start clean.
        await tokenStore.clear()
        setStatus("anonymous")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null)
      setStatus("anonymous")
    })
  }, [])

  const login = useCallback(async (input: { identifier: string; password: string }) => {
    const result = await api.auth.login(input)
    setUser(result.user)
    setStatus("authenticated")
  }, [])

  const register = useCallback(
    async (input: { email: string; username: string; password: string; displayName?: string }) => {
      const result = await api.auth.register(input)
      setUser(result.user)
      setStatus("authenticated")
    },
    [],
  )

  const logout = useCallback(async () => {
    await api.auth.logout()
    setUser(null)
    setStatus("anonymous")
  }, [])

  const refreshUser = useCallback(async () => {
    const { user: me } = await api.users.me()
    setUser(me)
  }, [])

  const value = useMemo<SessionValue>(
    () => ({ status, user, login, register, logout, refreshUser, patchUser: setUser }),
    [status, user, login, register, logout, refreshUser],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext)
  if (!context) throw new Error("useSession must be used inside SessionProvider")
  return context
}

export function useCurrentUser(): PublicUser {
  const { user } = useSession()
  if (!user) throw new Error("useCurrentUser requires an authenticated session")
  return user
}

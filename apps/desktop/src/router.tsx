import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

export type Route =
  | { name: "home" }
  | { name: "explore" }
  | { name: "notifications" }
  | { name: "bookmarks" }
  | { name: "settings" }
  | { name: "search"; query: string }
  | { name: "profile"; username: string; tab: "posts" | "replies" | "media" | "likes" }
  | { name: "post"; id: string }
  | { name: "hashtag"; tag: string }

export function matchRoute(path: string): Route {
  const [rawPath, rawQuery] = path.split("?")
  const segments = rawPath.split("/").filter(Boolean)
  const params = new URLSearchParams(rawQuery ?? "")

  if (segments.length === 0) return { name: "home" }

  switch (segments[0]) {
    case "explore":
      return { name: "explore" }
    case "notifications":
      return { name: "notifications" }
    case "bookmarks":
      return { name: "bookmarks" }
    case "settings":
      return { name: "settings" }
    case "search":
      return { name: "search", query: params.get("q") ?? "" }
    case "tag":
      return { name: "hashtag", tag: decodeURIComponent(segments[1] ?? "") }
    case "p":
      return { name: "post", id: segments[1] ?? "" }
    case "u": {
      const tab = segments[2]
      return {
        name: "profile",
        username: decodeURIComponent(segments[1] ?? ""),
        tab:
          tab === "replies" || tab === "media" || tab === "likes"
            ? tab
            : "posts",
      }
    }
    default:
      return { name: "home" }
  }
}

interface RouterValue {
  path: string
  route: Route
  navigate: (path: string, options?: { replace?: boolean }) => void
  back: () => void
  canGoBack: boolean
}

const RouterContext = createContext<RouterValue | null>(null)

export function RouterProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<string[]>(["/"])

  const navigate = useCallback((next: string, options?: { replace?: boolean }) => {
    setStack((current) => {
      const path = next.startsWith("/") ? next : `/${next}`
      if (path === current[current.length - 1]) return current
      if (options?.replace) return [...current.slice(0, -1), path]
      // Keep the history bounded - this is a desktop app, not a browser.
      return [...current, path].slice(-50)
    })
  }, [])

  const back = useCallback(() => {
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current))
  }, [])

  const path = stack[stack.length - 1]

  const value = useMemo<RouterValue>(
    () => ({ path, route: matchRoute(path), navigate, back, canGoBack: stack.length > 1 }),
    [path, navigate, back, stack.length],
  )

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter(): RouterValue {
  const context = useContext(RouterContext)
  if (!context) throw new Error("useRouter must be used inside RouterProvider")
  return context
}

export const routes = {
  home: () => "/",
  explore: () => "/explore",
  notifications: () => "/notifications",
  bookmarks: () => "/bookmarks",
  settings: () => "/settings",
  search: (query: string) => `/search?q=${encodeURIComponent(query)}`,
  profile: (username: string, tab?: "posts" | "replies" | "media" | "likes") =>
    `/u/${encodeURIComponent(username)}${tab && tab !== "posts" ? `/${tab}` : ""}`,
  post: (id: string) => `/p/${id}`,
  hashtag: (tag: string) => `/tag/${encodeURIComponent(tag)}`,
}

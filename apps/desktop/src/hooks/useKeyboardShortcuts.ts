import { useEffect, useRef } from "react"

import { routes, useRouter } from "@/router"

interface Options {
  onCompose: () => void
  onSearch: () => void
  onRefresh: () => void
  onToggleShortcuts: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable ||
    target.getAttribute("role") === "textbox"
  )
}

/**
 * Twitter-style shortcuts: n (new post), / (search), g+h/e/n/b/p/s (go to),
 * r (refresh), ? (help), Esc (dismiss).
 */
export function useKeyboardShortcuts({
  onCompose,
  onSearch,
  onRefresh,
  onToggleShortcuts,
}: Options): void {
  const { navigate } = useRouter()
  const goPending = useRef(false)
  const goTimer = useRef<number | null>(null)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return

      const key = event.key.toLowerCase()

      if (goPending.current) {
        goPending.current = false
        if (goTimer.current) window.clearTimeout(goTimer.current)
        const destination: Record<string, string | undefined> = {
          h: routes.home(),
          e: routes.explore(),
          n: routes.notifications(),
          b: routes.bookmarks(),
          s: routes.settings(),
        }
        const target = destination[key]
        if (target) {
          event.preventDefault()
          navigate(target)
          return
        }
      }

      switch (key) {
        case "g":
          goPending.current = true
          goTimer.current = window.setTimeout(() => {
            goPending.current = false
          }, 1200)
          break
        case "n":
          event.preventDefault()
          onCompose()
          break
        case "/":
          event.preventDefault()
          onSearch()
          break
        case "r":
          event.preventDefault()
          onRefresh()
          break
        case "?":
          event.preventDefault()
          onToggleShortcuts()
          break
        default:
          break
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [navigate, onCompose, onSearch, onRefresh, onToggleShortcuts])
}

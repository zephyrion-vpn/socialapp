import type { Page } from "@socialapp/shared"
import { useCallback, useEffect, useRef, useState } from "react"

export type LoadState = "loading" | "refreshing" | "loadingMore" | "ready" | "error"

export interface PaginatedResult<T> {
  items: T[]
  state: LoadState
  error: unknown
  hasMore: boolean
  loadMore: () => void
  refresh: () => Promise<void>
  setItems: (updater: (items: T[]) => T[]) => void
  removeItem: (predicate: (item: T) => boolean) => void
}

/**
 * Cursor pagination against any `Page<T>` endpoint. Requests are keyed so a
 * stale response can never overwrite a newer one.
 */
export function usePaginated<T>(
  loader: (cursor?: string) => Promise<Page<T>>,
  key: string,
): PaginatedResult<T> {
  const [items, setItems] = useState<T[]>([])
  const [state, setState] = useState<LoadState>("loading")
  const [error, setError] = useState<unknown>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const requestRef = useRef(0)
  const loadingRef = useRef(false)

  const run = useCallback(
    async (mode: "initial" | "refresh" | "more", nextCursor?: string) => {
      if (loadingRef.current && mode === "more") return
      loadingRef.current = true
      const requestId = ++requestRef.current

      setState(mode === "more" ? "loadingMore" : mode === "refresh" ? "refreshing" : "loading")
      if (mode !== "more") setError(null)

      try {
        const page = await loaderRef.current(nextCursor)
        if (requestId !== requestRef.current) return
        setItems((current) => (mode === "more" ? [...current, ...page.items] : page.items))
        setCursor(page.nextCursor)
        setHasMore(page.hasMore)
        setState("ready")
      } catch (caught) {
        if (requestId !== requestRef.current) return
        setError(caught)
        setState("error")
      } finally {
        loadingRef.current = false
      }
    },
    [],
  )

  useEffect(() => {
    setItems([])
    setCursor(null)
    setHasMore(false)
    void run("initial")
  }, [key, run])

  const loadMore = useCallback(() => {
    if (!hasMore || !cursor) return
    void run("more", cursor)
  }, [cursor, hasMore, run])

  const refresh = useCallback(async () => {
    await run("refresh")
  }, [run])

  const removeItem = useCallback((predicate: (item: T) => boolean) => {
    setItems((current) => current.filter((item) => !predicate(item)))
  }, [])

  const update = useCallback((updater: (current: T[]) => T[]) => {
    setItems((current) => updater(current))
  }, [])

  return { items, state, error, hasMore, loadMore, refresh, setItems: update, removeItem }
}

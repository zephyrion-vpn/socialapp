import { useCallback, useEffect, useRef, useState } from "react"

export interface AsyncResult<T> {
  data: T | null
  error: unknown
  loading: boolean
  reload: () => Promise<void>
  setData: (value: T) => void
}

/** Runs an async loader when `key` changes, ignoring out-of-order responses. */
export function useAsync<T>(loader: () => Promise<T>, key: string): AsyncResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)

  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const requestRef = useRef(0)

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await loaderRef.current()
      if (requestId !== requestRef.current) return
      setData(result)
    } catch (caught) {
      if (requestId !== requestRef.current) return
      setError(caught)
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [key, reload])

  return { data, error, loading, reload, setData }
}

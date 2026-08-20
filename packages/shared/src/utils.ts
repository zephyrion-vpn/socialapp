const HASHTAG_REGEX = /(^|\s)#([\p{L}\p{N}_]{1,64})/gu
const MENTION_REGEX = /(^|\s)@([a-z0-9_]{3,20})/gi

/** Extracts unique lowercase hashtags (without the leading #). */
export function extractHashtags(text: string): string[] {
  const found = new Set<string>()
  for (const match of text.matchAll(HASHTAG_REGEX)) {
    const tag = match[2]?.toLowerCase()
    if (tag && !/^\d+$/.test(tag)) found.add(tag)
  }
  return [...found].slice(0, 12)
}

/** Extracts unique lowercase @mentions (without the leading @). */
export function extractMentions(text: string): string[] {
  const found = new Set<string>()
  for (const match of text.matchAll(MENTION_REGEX)) {
    const username = match[2]?.toLowerCase()
    if (username) found.add(username)
  }
  return [...found].slice(0, 12)
}

/** Opaque base64url cursor helpers (shared so client and server agree). */
export function encodeCursor(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload)
  const base64 =
    typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, "utf8").toString("base64")
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function decodeCursor<T = Record<string, unknown>>(cursor: string): T | null {
  try {
    const base64 = cursor.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
    const json =
      typeof atob === "function"
        ? decodeURIComponent(escape(atob(padded)))
        : Buffer.from(padded, "base64").toString("utf8")
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

/** "now", "12s", "7m", "3h", "2d", "Mar 4" - X/Threads style timestamps. */
export function formatRelativeTime(
  value: string | number | Date,
  now: Date = new Date(),
): string {
  const date = value instanceof Date ? value : new Date(value)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (!Number.isFinite(seconds)) return ""
  if (seconds < 5) return "now"
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  })
}

export function formatCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return ""
  if (count < 1000) return String(count)
  if (count < 1_000_000) {
    const value = count / 1000
    return `${value < 10 ? value.toFixed(1).replace(/\.0$/, "") : Math.floor(value)}K`
  }
  const value = count / 1_000_000
  return `${value < 10 ? value.toFixed(1).replace(/\.0$/, "") : Math.floor(value)}M`
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}\u2026`
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

/** Removes a trailing slash so URLs can be concatenated safely. */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "")
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

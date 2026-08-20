export const APP_NAME = "SocialApp"
export const API_PREFIX = "/api/v1"

/** Post composer limits. */
export const MAX_POST_LENGTH = 500
export const MAX_MEDIA_PER_POST = 4
export const MAX_ALT_TEXT_LENGTH = 420

/** Direct message limits. */
export const MAX_MESSAGE_LENGTH = 2000
export const MAX_MESSAGE_PREVIEW_LENGTH = 160

/**
 * Direct message anti spam budget.
 *
 * The numbers are picked so that a real conversation never notices them: two
 * people replying to each other consume roughly one token per message and the
 * bucket refills faster than anyone types. Everything that is not a real
 * conversation - bursts, one sided threads, mass cold outreach, copy pasted
 * text - runs into a limit almost immediately.
 */
export const DM_LIMITS = {
  /** Messages that can be fired back to back inside one conversation. */
  BURST_CAPACITY: 10,
  /** Sustained rate inside one conversation, messages per second. */
  BURST_REFILL_PER_SECOND: 1,
  /** Burst across every conversation of one sender. */
  SENDER_CAPACITY: 25,
  /** Sustained rate across every conversation, messages per second. */
  SENDER_REFILL_PER_SECOND: 0.5,
  /** Messages allowed before the other person answers for the first time. */
  UNANSWERED_THREAD_MAX: 10,
  /** New conversations with people who never wrote back / do not follow you. */
  NEW_CONVERSATIONS_PER_HOUR: 5,
  NEW_CONVERSATIONS_PER_DAY: 15,
  /** Identical messages in a row before the flood guard kicks in. */
  DUPLICATE_STREAK_MAX: 3,
  DUPLICATE_WINDOW_MINUTES: 10,
} as const

/** Profile limits. */
export const MAX_BIO_LENGTH = 280
export const MAX_DISPLAY_NAME_LENGTH = 50
export const MAX_LOCATION_LENGTH = 64
export const MAX_WEBSITE_LENGTH = 200

/** Credentials. */
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128
export const MIN_USERNAME_LENGTH = 3
export const MAX_USERNAME_LENGTH = 20
export const USERNAME_PATTERN = /^[a-z0-9_]+$/

/** Media upload limits (enforced on the server, mirrored in the client UI). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const

/** Pagination. */
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 50

/** Reserved usernames that can never be registered. */
export const RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "api",
  "auth",
  "bookmarks",
  "conversations",
  "explore",
  "feed",
  "health",
  "help",
  "home",
  "login",
  "logout",
  "me",
  "messages",
  "notifications",
  "posts",
  "register",
  "root",
  "search",
  "settings",
  "socialapp",
  "support",
  "system",
  "trends",
  "users",
]

/** API error codes shared by the server and the desktop client. */
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  MESSAGE_RATE_LIMITED: "MESSAGE_RATE_LIMITED",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  MEDIA_STORAGE_NOT_CONFIGURED: "MEDIA_STORAGE_NOT_CONFIGURED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/** Keyboard shortcuts implemented by the desktop client. */
export const KEYBOARD_SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: "N", description: "New post" },
  { keys: "/", description: "Focus search" },
  { keys: "G then H", description: "Go to home" },
  { keys: "G then E", description: "Go to explore" },
  { keys: "G then N", description: "Go to notifications" },
  { keys: "G then B", description: "Go to bookmarks" },
  { keys: "G then P", description: "Go to profile" },
  { keys: "G then S", description: "Go to settings" },
  { keys: "R", description: "Refresh current timeline" },
  { keys: "T", description: "Toggle dark / light theme" },
  { keys: "?", description: "Show keyboard shortcuts" },
  { keys: "Esc", description: "Close dialog" },
]

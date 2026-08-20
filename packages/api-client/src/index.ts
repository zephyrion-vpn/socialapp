import {
  API_PREFIX,
  ERROR_CODES,
  normalizeBaseUrl,
  type AuthResult,
  type AuthTokens,
  type ChangePasswordInput,
  type Conversation,
  type CreatePostInput,
  type DirectMessage,
  type FeedType,
  type HealthStatus,
  type MessageLimitDetails,
  type NotificationItem,
  type Page,
  type Post,
  type PublicUser,
  type SearchResults,
  type SessionInfo,
  type Trend,
  type UpdateProfileInput,
  type UploadTicket,
  type UploadedMedia,
} from "@socialapp/shared"

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  readonly requestId?: string

  constructor(args: {
    status: number
    code: string
    message: string
    details?: unknown
    requestId?: string
  }) {
    super(args.message)
    this.name = "ApiError"
    this.status = args.status
    this.code = args.code
    this.details = args.details
    this.requestId = args.requestId
  }

  /** True when the request never reached the server (offline, DNS, TLS...). */
  get isNetworkError(): boolean {
    return this.code === ERROR_CODES.NETWORK_ERROR || this.code === ERROR_CODES.TIMEOUT
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }

  /**
   * Seconds to wait before retrying, when the server said so. Direct message
   * limits always include it, so the UI can show "try again in 4s" instead of a
   * generic error.
   */
  get retryAfterSeconds(): number | null {
    const details = this.details as Partial<MessageLimitDetails> | undefined
    return typeof details?.retryAfterSeconds === "number" ? details.retryAfterSeconds : null
  }

  /** Field level validation messages, if the server returned any. */
  get fieldErrors(): Record<string, string> {
    const details = this.details as { fieldErrors?: Record<string, string[]> } | undefined
    const result: Record<string, string> = {}
    if (details?.fieldErrors) {
      for (const [field, messages] of Object.entries(details.fieldErrors)) {
        if (messages?.length) result[field] = messages[0]
      }
    }
    return result
  }
}

export interface StoredSession {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt?: string
  refreshTokenExpiresAt?: string
}

/**
 * Pluggable token storage. The desktop client implements this on top of the
 * Electron main process, which encrypts tokens with the OS keychain
 * (safeStorage / DPAPI on Windows) - tokens are never written in plaintext.
 */
export interface TokenStore {
  get(): Promise<StoredSession | null>
  set(session: StoredSession): Promise<void>
  clear(): Promise<void>
}

export class MemoryTokenStore implements TokenStore {
  private session: StoredSession | null = null
  async get() {
    return this.session
  }
  async set(session: StoredSession) {
    this.session = session
  }
  async clear() {
    this.session = null
  }
}

export interface ApiClientOptions {
  baseUrl: string
  tokenStore?: TokenStore
  fetchImpl?: typeof fetch
  timeoutMs?: number
  /** Called when the session is definitively gone (refresh failed). */
  onSessionExpired?: () => void
  /** Called after a successful refresh so the UI can persist new tokens. */
  onTokensRefreshed?: (tokens: AuthTokens) => void
  userAgent?: string
}

type QueryValue = string | number | boolean | null | undefined

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  body?: unknown
  query?: Record<string, QueryValue>
  auth?: boolean
  signal?: AbortSignal
  formData?: FormData
  retryOnUnauthorized?: boolean
}

export class ApiClient {
  private baseUrl: string
  private readonly tokens: TokenStore
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly onSessionExpired?: () => void
  private readonly onTokensRefreshed?: (tokens: AuthTokens) => void
  private refreshInFlight: Promise<AuthTokens | null> | null = null

  constructor(options: ApiClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.tokens = options.tokenStore ?? new MemoryTokenStore()
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
    this.timeoutMs = options.timeoutMs ?? 20_000
    this.onSessionExpired = options.onSessionExpired
    this.onTokensRefreshed = options.onTokensRefreshed
  }

  get apiBaseUrl(): string {
    return this.baseUrl
  }

  setBaseUrl(url: string): void {
    this.baseUrl = normalizeBaseUrl(url)
  }

  get tokenStore(): TokenStore {
    return this.tokens
  }

  // ---------------------------------------------------------------- transport

  private buildUrl(path: string, query?: Record<string, QueryValue>): string {
    const prefixed = path.startsWith("/health") || path.startsWith("/version")
      ? path
      : `${API_PREFIX}${path}`
    const url = new URL(`${this.baseUrl}${prefixed}`)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === "") continue
        url.searchParams.set(key, String(value))
      }
    }
    return url.toString()
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = "GET",
      body,
      query,
      auth = true,
      formData,
      retryOnUnauthorized = true,
    } = options

    const headers: Record<string, string> = { Accept: "application/json" }
    if (body !== undefined) headers["Content-Type"] = "application/json"

    if (auth) {
      const session = await this.tokens.get()
      if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true })
    }

    let response: Response
    try {
      response = await this.fetchImpl(this.buildUrl(path, query), {
        method,
        headers,
        body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
        signal: controller.signal,
      })
    } catch (error) {
      const aborted = (error as Error)?.name === "AbortError"
      throw new ApiError({
        status: 0,
        code: aborted ? ERROR_CODES.TIMEOUT : ERROR_CODES.NETWORK_ERROR,
        message: aborted
          ? "The server took too long to respond."
          : "Cannot reach the server. Check your internet connection.",
      })
    } finally {
      clearTimeout(timer)
    }

    if (response.status === 401 && auth && retryOnUnauthorized) {
      const refreshed = await this.refreshTokens()
      if (refreshed) {
        return this.request<T>(path, { ...options, retryOnUnauthorized: false })
      }
    }

    if (response.status === 204) return undefined as T

    const text = await response.text()
    const payload = text ? safeJsonParse(text) : null

    if (!response.ok) {
      const errorBody = (payload as { error?: { code?: string; message?: string; details?: unknown; requestId?: string } } | null)?.error
      throw new ApiError({
        status: response.status,
        code: errorBody?.code ?? ERROR_CODES.INTERNAL_ERROR,
        message: errorBody?.message ?? `Request failed with status ${response.status}`,
        details: errorBody?.details,
        requestId: errorBody?.requestId,
      })
    }

    return payload as T
  }

  /** Refreshes the access token at most once concurrently. */
  private async refreshTokens(): Promise<AuthTokens | null> {
    if (this.refreshInFlight) return this.refreshInFlight

    this.refreshInFlight = (async () => {
      const session = await this.tokens.get()
      if (!session?.refreshToken) return null
      try {
        const result = await this.request<{ tokens: AuthTokens }>("/auth/refresh", {
          method: "POST",
          body: { refreshToken: session.refreshToken },
          auth: false,
          retryOnUnauthorized: false,
        })
        await this.tokens.set(result.tokens)
        this.onTokensRefreshed?.(result.tokens)
        return result.tokens
      } catch (error) {
        if (error instanceof ApiError && error.isNetworkError) return null
        await this.tokens.clear()
        this.onSessionExpired?.()
        return null
      }
    })()

    try {
      return await this.refreshInFlight
    } finally {
      this.refreshInFlight = null
    }
  }

  // -------------------------------------------------------------------- auth

  readonly auth = {
    register: async (input: {
      email: string
      username: string
      password: string
      displayName?: string
    }): Promise<AuthResult> => {
      const result = await this.request<AuthResult>("/auth/register", {
        method: "POST",
        body: input,
        auth: false,
      })
      await this.tokens.set(result.tokens)
      return result
    },

    login: async (input: { identifier: string; password: string }): Promise<AuthResult> => {
      const result = await this.request<AuthResult>("/auth/login", {
        method: "POST",
        body: input,
        auth: false,
      })
      await this.tokens.set(result.tokens)
      return result
    },

    logout: async (): Promise<void> => {
      const session = await this.tokens.get()
      try {
        await this.request<void>("/auth/logout", {
          method: "POST",
          body: { refreshToken: session?.refreshToken },
          retryOnUnauthorized: false,
        })
      } catch {
        // Logging out must always succeed locally, even while offline.
      }
      await this.tokens.clear()
    },

    logoutEverywhere: async (): Promise<void> => {
      try {
        await this.request<void>("/auth/logout-all", { method: "POST" })
      } finally {
        await this.tokens.clear()
      }
    },

    me: (): Promise<{ user: PublicUser }> => this.request("/auth/me"),

    sessions: (): Promise<{ sessions: SessionInfo[] }> => this.request("/auth/sessions"),

    forgotPassword: (email: string): Promise<{ ok: true; resetToken?: string }> =>
      this.request("/auth/password/forgot", { method: "POST", body: { email }, auth: false }),

    resetPassword: (input: { token: string; password: string }): Promise<{ ok: true }> =>
      this.request("/auth/password/reset", { method: "POST", body: input, auth: false }),

    changePassword: (input: ChangePasswordInput): Promise<{ ok: true }> =>
      this.request("/auth/password/change", { method: "POST", body: input }),
  }

  // ------------------------------------------------------------------- users

  readonly users = {
    me: (): Promise<{ user: PublicUser }> => this.request("/users/me"),

    updateMe: (input: UpdateProfileInput): Promise<{ user: PublicUser }> =>
      this.request("/users/me", { method: "PATCH", body: input }),

    byUsername: (username: string): Promise<{ user: PublicUser }> =>
      this.request(`/users/${encodeURIComponent(username)}`),

    suggested: (limit = 5): Promise<{ users: PublicUser[] }> =>
      this.request("/users/suggested", { query: { limit } }),

    posts: (username: string, query: { cursor?: string; limit?: number } = {}): Promise<Page<Post>> =>
      this.request(`/users/${encodeURIComponent(username)}/posts`, { query }),

    replies: (username: string, query: { cursor?: string; limit?: number } = {}): Promise<Page<Post>> =>
      this.request(`/users/${encodeURIComponent(username)}/replies`, { query }),

    reposts: (username: string, query: { cursor?: string; limit?: number } = {}): Promise<Page<Post>> =>
      this.request(`/users/${encodeURIComponent(username)}/reposts`, { query }),

    likes: (username: string, query: { cursor?: string; limit?: number } = {}): Promise<Page<Post>> =>
      this.request(`/users/${encodeURIComponent(username)}/likes`, { query }),

    media: (username: string, query: { cursor?: string; limit?: number } = {}): Promise<Page<Post>> =>
      this.request(`/users/${encodeURIComponent(username)}/media`, { query }),

    followers: (username: string, query: { cursor?: string; limit?: number } = {}): Promise<Page<PublicUser>> =>
      this.request(`/users/${encodeURIComponent(username)}/followers`, { query }),

    following: (username: string, query: { cursor?: string; limit?: number } = {}): Promise<Page<PublicUser>> =>
      this.request(`/users/${encodeURIComponent(username)}/following`, { query }),

    follow: (username: string): Promise<{ following: boolean; followersCount: number }> =>
      this.request(`/users/${encodeURIComponent(username)}/follow`, { method: "POST" }),

    unfollow: (username: string): Promise<{ following: boolean; followersCount: number }> =>
      this.request(`/users/${encodeURIComponent(username)}/follow`, { method: "DELETE" }),

    block: (username: string): Promise<{ blocked: boolean }> =>
      this.request(`/users/${encodeURIComponent(username)}/block`, { method: "POST" }),

    unblock: (username: string): Promise<{ blocked: boolean }> =>
      this.request(`/users/${encodeURIComponent(username)}/block`, { method: "DELETE" }),

    mute: (username: string): Promise<{ muted: boolean }> =>
      this.request(`/users/${encodeURIComponent(username)}/mute`, { method: "POST" }),

    unmute: (username: string): Promise<{ muted: boolean }> =>
      this.request(`/users/${encodeURIComponent(username)}/mute`, { method: "DELETE" }),
  }

  // ------------------------------------------------------------------- posts

  readonly posts = {
    create: (input: CreatePostInput): Promise<{ post: Post }> =>
      this.request("/posts", { method: "POST", body: input }),

    byId: (id: string): Promise<{ post: Post }> => this.request(`/posts/${id}`),

    remove: (id: string): Promise<void> => this.request(`/posts/${id}`, { method: "DELETE" }),

    thread: (id: string): Promise<{ ancestors: Post[]; post: Post; replies: Page<Post> }> =>
      this.request(`/posts/${id}/thread`),

    replies: (id: string, query: { cursor?: string; limit?: number } = {}): Promise<Page<Post>> =>
      this.request(`/posts/${id}/replies`, { query }),

    likedBy: (id: string, query: { cursor?: string; limit?: number } = {}): Promise<Page<PublicUser>> =>
      this.request(`/posts/${id}/likes`, { query }),

    like: (id: string): Promise<{ liked: boolean; likeCount: number }> =>
      this.request(`/posts/${id}/like`, { method: "POST" }),

    unlike: (id: string): Promise<{ liked: boolean; likeCount: number }> =>
      this.request(`/posts/${id}/like`, { method: "DELETE" }),

    repost: (id: string): Promise<{ reposted: boolean; repostCount: number }> =>
      this.request(`/posts/${id}/repost`, { method: "POST" }),

    unrepost: (id: string): Promise<{ reposted: boolean; repostCount: number }> =>
      this.request(`/posts/${id}/repost`, { method: "DELETE" }),

    bookmark: (id: string): Promise<{ bookmarked: boolean; bookmarkCount: number }> =>
      this.request(`/posts/${id}/bookmark`, { method: "POST" }),

    unbookmark: (id: string): Promise<{ bookmarked: boolean; bookmarkCount: number }> =>
      this.request(`/posts/${id}/bookmark`, { method: "DELETE" }),
  }

  // -------------------------------------------------------------------- feed

  readonly feed = {
    get: (type: FeedType, query: { cursor?: string; limit?: number } = {}): Promise<Page<Post>> =>
      this.request("/feed", { query: { type, ...query } }),
  }

  // --------------------------------------------------------------- discovery

  readonly search = {
    all: (q: string, query: { cursor?: string; limit?: number } = {}): Promise<SearchResults> =>
      this.request("/search", { query: { q, type: "all", ...query } }),

    posts: (q: string, query: { cursor?: string; limit?: number } = {}): Promise<Page<Post>> =>
      this.request("/search/posts", { query: { q, ...query } }),

    users: (q: string, query: { cursor?: string; limit?: number } = {}): Promise<Page<PublicUser>> =>
      this.request("/search/users", { query: { q, ...query } }),
  }

  readonly trends = {
    list: (limit = 10): Promise<{ trends: Trend[] }> => this.request("/trends", { query: { limit } }),

    posts: (tag: string, query: { cursor?: string; limit?: number } = {}): Promise<Page<Post>> =>
      this.request(`/trends/${encodeURIComponent(tag)}/posts`, { query }),
  }

  readonly notifications = {
    list: (query: { cursor?: string; limit?: number; unreadOnly?: boolean } = {}): Promise<Page<NotificationItem>> =>
      this.request("/notifications", { query }),

    unreadCount: (): Promise<{ count: number }> => this.request("/notifications/unread-count"),

    markAllRead: (): Promise<{ ok: true }> =>
      this.request("/notifications/read-all", { method: "POST" }),

    markRead: (id: string): Promise<{ ok: true }> =>
      this.request(`/notifications/${id}/read`, { method: "POST" }),
  }

  readonly bookmarks = {
    list: (query: { cursor?: string; limit?: number } = {}): Promise<Page<Post>> =>
      this.request("/bookmarks", { query }),
  }

  // ---------------------------------------------------------------- messages

  readonly messages = {
    /** Inbox, newest activity first. Threads without messages are excluded. */
    conversations: (query: { cursor?: string; limit?: number } = {}): Promise<Page<Conversation>> =>
      this.request("/messages/conversations", { query }),

    /** Opens the thread with a user, or returns the existing one. */
    start: (username: string): Promise<{ conversation: Conversation }> =>
      this.request("/messages/conversations", { method: "POST", body: { username } }),

    conversation: (id: string): Promise<{ conversation: Conversation }> =>
      this.request(`/messages/conversations/${id}`),

    /** Newest first, like every other timeline - the UI reverses the page. */
    list: (
      conversationId: string,
      query: { cursor?: string; limit?: number } = {},
    ): Promise<Page<DirectMessage>> =>
      this.request(`/messages/conversations/${conversationId}/messages`, { query }),

    send: (
      conversationId: string,
      content: string,
    ): Promise<{ message: DirectMessage; conversation: Conversation }> =>
      this.request(`/messages/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { content },
      }),

    markRead: (conversationId: string): Promise<{ unreadCount: number }> =>
      this.request(`/messages/conversations/${conversationId}/read`, { method: "POST" }),

    remove: (messageId: string): Promise<void> =>
      this.request(`/messages/${messageId}`, { method: "DELETE" }),

    unreadCount: (): Promise<{ count: number }> => this.request("/messages/unread-count"),
  }

  // ------------------------------------------------------------------- media

  readonly media = {
    createUploadTicket: (input: {
      fileName: string
      mimeType: string
      sizeBytes: number
      purpose?: "post" | "avatar" | "banner"
    }): Promise<UploadTicket> => this.request("/media/upload-url", { method: "POST", body: input }),

    /** Direct multipart upload - the server streams the file to object storage. */
    upload: async (
      file: Blob,
      options: { fileName?: string; purpose?: "post" | "avatar" | "banner" } = {},
    ): Promise<UploadedMedia> => {
      const form = new FormData()
      form.append("file", file, options.fileName ?? "upload")
      if (options.purpose) form.append("purpose", options.purpose)
      return this.request<UploadedMedia>("/media/upload", { method: "POST", formData: form })
    },
  }

  // ------------------------------------------------------------------ system

  readonly system = {
    health: (): Promise<HealthStatus> => this.request("/health", { auth: false }),
    version: (): Promise<{ name: string; version: string }> =>
      this.request("/version", { auth: false }),
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return { error: { code: ERROR_CODES.INTERNAL_ERROR, message: text.slice(0, 300) } }
  }
}

export { API_PREFIX, ERROR_CODES }
export type {
  AuthResult,
  AuthTokens,
  Conversation,
  DirectMessage,
  HealthStatus,
  MessageLimitDetails,
  NotificationItem,
  Page,
  Post,
  PublicUser,
  SearchResults,
  SessionInfo,
  Trend,
  UploadTicket,
  UploadedMedia,
}

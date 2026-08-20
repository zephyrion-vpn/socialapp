export type ISODateString = string

export type FeedType = "home" | "recommended" | "popular" | "latest"

export type MediaKind = "IMAGE" | "GIF" | "VIDEO"

export type PostVisibility = "PUBLIC" | "FOLLOWERS" | "UNLISTED"

export type NotificationKind =
  | "LIKE"
  | "REPLY"
  | "REPOST"
  | "FOLLOW"
  | "MENTION"
  | "QUOTE"
  | "SYSTEM"

/** Everything the client is allowed to know about a user. */
export interface PublicUser {
  id: string
  username: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  location: string | null
  website: string | null
  createdAt: ISODateString
  followersCount: number
  followingCount: number
  postsCount: number
  /** Viewer relationship flags - only present for authenticated requests. */
  isSelf?: boolean
  isFollowing?: boolean
  isFollowedBy?: boolean
  isBlocked?: boolean
  isMuted?: boolean
}

export interface MediaAttachment {
  id: string
  url: string
  type: MediaKind
  altText: string | null
  width: number | null
  height: number | null
  position: number
}

export interface Post {
  id: string
  content: string
  createdAt: ISODateString
  editedAt: ISODateString | null
  visibility: PostVisibility
  author: PublicUser
  media: MediaAttachment[]
  hashtags: string[]
  mentions: string[]
  parentId: string | null
  rootId: string | null
  isReply: boolean
  replyTo: { id: string; username: string } | null
  quotedPost: Post | null
  likeCount: number
  replyCount: number
  repostCount: number
  bookmarkCount: number
  viewCount: number
  /** Viewer engagement flags - only present for authenticated requests. */
  liked: boolean
  reposted: boolean
  bookmarked: boolean
}

export interface NotificationItem {
  id: string
  type: NotificationKind
  createdAt: ISODateString
  isRead: boolean
  actor: PublicUser | null
  post: Post | null
}

export interface Trend {
  rank: number
  tag: string
  postCount: number
  recentPostCount: number
}

export interface SessionInfo {
  id: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: ISODateString
  lastUsedAt: ISODateString | null
  expiresAt: ISODateString
  current: boolean
}

/** Cursor paginated collection. */
export interface Page<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: ISODateString
  refreshTokenExpiresAt: ISODateString
}

export interface AuthResult {
  user: PublicUser
  tokens: AuthTokens
}

export interface SearchResults {
  posts: Page<Post>
  users: Page<PublicUser>
  hashtags: Trend[]
}

export interface UploadTicket {
  key: string
  uploadUrl: string
  publicUrl: string
  headers: Record<string, string>
  expiresInSeconds: number
}

export interface UploadedMedia {
  key: string
  url: string
  mimeType: string
  sizeBytes: number
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
    requestId?: string
  }
}

export interface HealthStatus {
  status: "ok" | "degraded"
  version: string
  environment: string
  uptimeSeconds: number
  timestamp: ISODateString
  checks?: Record<string, { status: "ok" | "error"; latencyMs?: number; message?: string }>
}

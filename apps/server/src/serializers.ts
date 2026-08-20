import { Prisma } from "@prisma/client"
import type { MediaAttachment, NotificationItem, Post, PublicUser } from "@socialapp/shared"

import { prisma } from "./lib/prisma"

export const userInclude = { profile: true } satisfies Prisma.UserInclude

export const postInclude = {
  author: { include: { profile: true } },
  media: { orderBy: { position: "asc" } },
  hashtags: { include: { hashtag: true } },
  parent: { select: { id: true, author: { select: { username: true } } } },
  quotedPost: {
    include: {
      author: { include: { profile: true } },
      media: { orderBy: { position: "asc" } },
      hashtags: { include: { hashtag: true } },
    },
  },
} satisfies Prisma.PostInclude

export const notificationInclude = {
  actor: { include: { profile: true } },
  post: { include: postInclude },
} satisfies Prisma.NotificationInclude

export type UserWithProfile = Prisma.UserGetPayload<{ include: typeof userInclude }>
export type PostWithRelations = Prisma.PostGetPayload<{ include: typeof postInclude }>
export type NotificationWithRelations = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude
}>

/**
 * Everything the serializers need to answer "what is this viewer's
 * relationship with this row?" - resolved in a handful of batched queries
 * instead of per-row lookups.
 */
export interface ViewerContext {
  viewerId?: string
  likedPostIds: Set<string>
  repostedPostIds: Set<string>
  bookmarkedPostIds: Set<string>
  followingIds: Set<string>
  followerIds: Set<string>
  blockedIds: Set<string>
  mutedIds: Set<string>
}

export function emptyViewerContext(viewerId?: string): ViewerContext {
  return {
    viewerId,
    likedPostIds: new Set(),
    repostedPostIds: new Set(),
    bookmarkedPostIds: new Set(),
    followingIds: new Set(),
    followerIds: new Set(),
    blockedIds: new Set(),
    mutedIds: new Set(),
  }
}

function collectPostIds(posts: PostWithRelations[]): string[] {
  const ids = new Set<string>()
  for (const post of posts) {
    ids.add(post.id)
    if (post.quotedPost) ids.add(post.quotedPost.id)
  }
  return [...ids]
}

function collectUserIds(posts: PostWithRelations[], extraUserIds: string[]): string[] {
  const ids = new Set<string>(extraUserIds)
  for (const post of posts) {
    ids.add(post.authorId)
    if (post.quotedPost) ids.add(post.quotedPost.authorId)
  }
  return [...ids]
}

export async function buildViewerContext(
  viewerId: string | undefined,
  input: { posts?: PostWithRelations[]; userIds?: string[] } = {},
): Promise<ViewerContext> {
  const context = emptyViewerContext(viewerId)
  if (!viewerId) return context

  const posts = input.posts ?? []
  const postIds = collectPostIds(posts)
  const userIds = collectUserIds(posts, input.userIds ?? []).filter((id) => id !== viewerId)

  const [likes, reposts, bookmarks, following, followers, blocks, mutes] = await Promise.all([
    postIds.length
      ? prisma.like.findMany({ where: { userId: viewerId, postId: { in: postIds } }, select: { postId: true } })
      : [],
    postIds.length
      ? prisma.repost.findMany({ where: { userId: viewerId, postId: { in: postIds } }, select: { postId: true } })
      : [],
    postIds.length
      ? prisma.bookmark.findMany({ where: { userId: viewerId, postId: { in: postIds } }, select: { postId: true } })
      : [],
    userIds.length
      ? prisma.follow.findMany({
          where: { followerId: viewerId, followingId: { in: userIds } },
          select: { followingId: true },
        })
      : [],
    userIds.length
      ? prisma.follow.findMany({
          where: { followingId: viewerId, followerId: { in: userIds } },
          select: { followerId: true },
        })
      : [],
    userIds.length
      ? prisma.block.findMany({
          where: { blockerId: viewerId, blockedId: { in: userIds } },
          select: { blockedId: true },
        })
      : [],
    userIds.length
      ? prisma.mute.findMany({
          where: { muterId: viewerId, mutedId: { in: userIds } },
          select: { mutedId: true },
        })
      : [],
  ])

  for (const row of likes) context.likedPostIds.add(row.postId)
  for (const row of reposts) context.repostedPostIds.add(row.postId)
  for (const row of bookmarks) context.bookmarkedPostIds.add(row.postId)
  for (const row of following) context.followingIds.add(row.followingId)
  for (const row of followers) context.followerIds.add(row.followerId)
  for (const row of blocks) context.blockedIds.add(row.blockedId)
  for (const row of mutes) context.mutedIds.add(row.mutedId)

  return context
}

export function toPublicUser(user: UserWithProfile, context?: ViewerContext): PublicUser {
  const profile = user.profile
  const viewerId = context?.viewerId
  return {
    id: user.id,
    username: user.username,
    displayName: profile?.displayName ?? user.username,
    bio: profile?.bio ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    bannerUrl: profile?.bannerUrl ?? null,
    location: profile?.location ?? null,
    website: profile?.website ?? null,
    createdAt: user.createdAt.toISOString(),
    followersCount: profile?.followersCount ?? 0,
    followingCount: profile?.followingCount ?? 0,
    postsCount: profile?.postsCount ?? 0,
    ...(viewerId
      ? {
          isSelf: viewerId === user.id,
          isFollowing: context!.followingIds.has(user.id),
          isFollowedBy: context!.followerIds.has(user.id),
          isBlocked: context!.blockedIds.has(user.id),
          isMuted: context!.mutedIds.has(user.id),
        }
      : {}),
  }
}

function toMedia(media: PostWithRelations["media"][number]): MediaAttachment {
  return {
    id: media.id,
    url: media.url,
    type: media.type,
    altText: media.altText,
    width: media.width,
    height: media.height,
    position: media.position,
  }
}

export function toPost(post: PostWithRelations, context?: ViewerContext): Post {
  const ctx = context ?? emptyViewerContext()
  const quoted = post.quotedPost

  return {
    id: post.id,
    content: post.isDeleted ? "" : post.content,
    createdAt: post.createdAt.toISOString(),
    editedAt: post.editedAt ? post.editedAt.toISOString() : null,
    visibility: post.visibility,
    author: toPublicUser(post.author, ctx),
    media: post.isDeleted ? [] : post.media.map(toMedia),
    hashtags: post.hashtags.map((link) => link.hashtag.tag),
    mentions: [],
    parentId: post.parentId,
    rootId: post.rootId,
    isReply: Boolean(post.parentId),
    replyTo: post.parent ? { id: post.parent.id, username: post.parent.author.username } : null,
    quotedPost: quoted
      ? {
          id: quoted.id,
          content: quoted.isDeleted ? "" : quoted.content,
          createdAt: quoted.createdAt.toISOString(),
          editedAt: quoted.editedAt ? quoted.editedAt.toISOString() : null,
          visibility: quoted.visibility,
          author: toPublicUser(quoted.author, ctx),
          media: quoted.isDeleted ? [] : quoted.media.map(toMedia),
          hashtags: quoted.hashtags.map((link) => link.hashtag.tag),
          mentions: [],
          parentId: quoted.parentId,
          rootId: quoted.rootId,
          isReply: Boolean(quoted.parentId),
          replyTo: null,
          quotedPost: null,
          likeCount: quoted.likeCount,
          replyCount: quoted.replyCount,
          repostCount: quoted.repostCount,
          bookmarkCount: quoted.bookmarkCount,
          viewCount: quoted.viewCount,
          liked: ctx.likedPostIds.has(quoted.id),
          reposted: ctx.repostedPostIds.has(quoted.id),
          bookmarked: ctx.bookmarkedPostIds.has(quoted.id),
        }
      : null,
    likeCount: post.likeCount,
    replyCount: post.replyCount,
    repostCount: post.repostCount,
    bookmarkCount: post.bookmarkCount,
    viewCount: post.viewCount,
    liked: ctx.likedPostIds.has(post.id),
    reposted: ctx.repostedPostIds.has(post.id),
    bookmarked: ctx.bookmarkedPostIds.has(post.id),
  }
}

export function toPosts(posts: PostWithRelations[], context: ViewerContext): Post[] {
  return posts.map((post) => toPost(post, context))
}

export function toNotification(
  notification: NotificationWithRelations,
  context: ViewerContext,
): NotificationItem {
  return {
    id: notification.id,
    type: notification.type,
    createdAt: notification.createdAt.toISOString(),
    isRead: notification.isRead,
    actor: notification.actor ? toPublicUser(notification.actor, context) : null,
    post: notification.post ? toPost(notification.post, context) : null,
  }
}

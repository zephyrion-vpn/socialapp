import { forbidden, notFound } from "../lib/errors"
import { prisma } from "../lib/prisma"
import { isBlockedBetween } from "./relations.service"

async function loadPost(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, isDeleted: true, likeCount: true, repostCount: true, bookmarkCount: true },
  })
  if (!post || post.isDeleted) throw notFound("Post not found")
  return post
}

export async function likePost(userId: string, postId: string) {
  const post = await loadPost(postId)
  if (await isBlockedBetween(userId, post.authorId)) throw forbidden("You cannot interact with this post")

  const existing = await prisma.like.findUnique({ where: { userId_postId: { userId, postId } } })
  if (existing) return { liked: true, likeCount: post.likeCount }

  const [, updated] = await prisma.$transaction([
    prisma.like.create({ data: { userId, postId } }),
    prisma.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 }, score: { increment: 3 } },
      select: { likeCount: true },
    }),
  ])

  if (post.authorId !== userId) {
    await prisma.notification.create({
      data: { recipientId: post.authorId, actorId: userId, type: "LIKE", postId },
    })
  }

  return { liked: true, likeCount: updated.likeCount }
}

export async function unlikePost(userId: string, postId: string) {
  const post = await loadPost(postId)
  const existing = await prisma.like.findUnique({ where: { userId_postId: { userId, postId } } })
  if (!existing) return { liked: false, likeCount: post.likeCount }

  const [, updated] = await prisma.$transaction([
    prisma.like.delete({ where: { id: existing.id } }),
    prisma.post.update({
      where: { id: postId },
      data: { likeCount: { decrement: 1 }, score: { decrement: 3 } },
      select: { likeCount: true },
    }),
  ])

  await prisma.notification.deleteMany({
    where: { recipientId: post.authorId, actorId: userId, type: "LIKE", postId },
  })

  return { liked: false, likeCount: Math.max(0, updated.likeCount) }
}

export async function repostPost(userId: string, postId: string) {
  const post = await loadPost(postId)
  if (await isBlockedBetween(userId, post.authorId)) throw forbidden("You cannot interact with this post")

  const existing = await prisma.repost.findUnique({ where: { userId_postId: { userId, postId } } })
  if (existing) return { reposted: true, repostCount: post.repostCount }

  const [, updated] = await prisma.$transaction([
    prisma.repost.create({ data: { userId, postId } }),
    prisma.post.update({
      where: { id: postId },
      data: { repostCount: { increment: 1 }, score: { increment: 4 } },
      select: { repostCount: true },
    }),
  ])

  if (post.authorId !== userId) {
    await prisma.notification.create({
      data: { recipientId: post.authorId, actorId: userId, type: "REPOST", postId },
    })
  }

  return { reposted: true, repostCount: updated.repostCount }
}

export async function undoRepost(userId: string, postId: string) {
  const post = await loadPost(postId)
  const existing = await prisma.repost.findUnique({ where: { userId_postId: { userId, postId } } })
  if (!existing) return { reposted: false, repostCount: post.repostCount }

  const [, updated] = await prisma.$transaction([
    prisma.repost.delete({ where: { id: existing.id } }),
    prisma.post.update({
      where: { id: postId },
      data: { repostCount: { decrement: 1 }, score: { decrement: 4 } },
      select: { repostCount: true },
    }),
  ])

  await prisma.notification.deleteMany({
    where: { recipientId: post.authorId, actorId: userId, type: "REPOST", postId },
  })

  return { reposted: false, repostCount: Math.max(0, updated.repostCount) }
}

export async function bookmarkPost(userId: string, postId: string) {
  const post = await loadPost(postId)
  const existing = await prisma.bookmark.findUnique({ where: { userId_postId: { userId, postId } } })
  if (existing) return { bookmarked: true, bookmarkCount: post.bookmarkCount }

  const [, updated] = await prisma.$transaction([
    prisma.bookmark.create({ data: { userId, postId } }),
    prisma.post.update({
      where: { id: postId },
      data: { bookmarkCount: { increment: 1 } },
      select: { bookmarkCount: true },
    }),
  ])
  return { bookmarked: true, bookmarkCount: updated.bookmarkCount }
}

export async function removeBookmark(userId: string, postId: string) {
  const post = await loadPost(postId)
  const existing = await prisma.bookmark.findUnique({ where: { userId_postId: { userId, postId } } })
  if (!existing) return { bookmarked: false, bookmarkCount: post.bookmarkCount }

  const [, updated] = await prisma.$transaction([
    prisma.bookmark.delete({ where: { id: existing.id } }),
    prisma.post.update({
      where: { id: postId },
      data: { bookmarkCount: { decrement: 1 } },
      select: { bookmarkCount: true },
    }),
  ])
  return { bookmarked: false, bookmarkCount: Math.max(0, updated.bookmarkCount) }
}

async function resolveTargetUser(username: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, isActive: true },
  })
  if (!user || !user.isActive) throw notFound("User not found")
  return user
}

export async function followUser(followerId: string, username: string) {
  const target = await resolveTargetUser(username)
  if (target.id === followerId) throw forbidden("You cannot follow yourself")
  if (await isBlockedBetween(followerId, target.id)) throw forbidden("You cannot follow this account")

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId: target.id } },
  })
  if (existing) {
    const profile = await prisma.profile.findUnique({
      where: { userId: target.id },
      select: { followersCount: true },
    })
    return { following: true, followersCount: profile?.followersCount ?? 0 }
  }

  const [, , profile] = await prisma.$transaction([
    prisma.follow.create({ data: { followerId, followingId: target.id } }),
    prisma.profile.update({ where: { userId: followerId }, data: { followingCount: { increment: 1 } } }),
    prisma.profile.update({
      where: { userId: target.id },
      data: { followersCount: { increment: 1 } },
      select: { followersCount: true },
    }),
  ])

  await prisma.notification.create({
    data: { recipientId: target.id, actorId: followerId, type: "FOLLOW" },
  })

  return { following: true, followersCount: profile.followersCount }
}

export async function unfollowUser(followerId: string, username: string) {
  const target = await resolveTargetUser(username)
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId: target.id } },
  })
  if (!existing) {
    const profile = await prisma.profile.findUnique({
      where: { userId: target.id },
      select: { followersCount: true },
    })
    return { following: false, followersCount: profile?.followersCount ?? 0 }
  }

  const [, , profile] = await prisma.$transaction([
    prisma.follow.delete({ where: { id: existing.id } }),
    prisma.profile.update({ where: { userId: followerId }, data: { followingCount: { decrement: 1 } } }),
    prisma.profile.update({
      where: { userId: target.id },
      data: { followersCount: { decrement: 1 } },
      select: { followersCount: true },
    }),
  ])

  await prisma.notification.deleteMany({
    where: { recipientId: target.id, actorId: followerId, type: "FOLLOW" },
  })

  return { following: false, followersCount: Math.max(0, profile.followersCount) }
}

/** Blocking also removes any follow relationship in both directions. */
export async function blockUser(blockerId: string, username: string) {
  const target = await resolveTargetUser(username)
  if (target.id === blockerId) throw forbidden("You cannot block yourself")

  await prisma.$transaction(async (tx) => {
    await tx.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId: target.id } },
      create: { blockerId, blockedId: target.id },
      update: {},
    })

    const follows = await tx.follow.findMany({
      where: {
        OR: [
          { followerId: blockerId, followingId: target.id },
          { followerId: target.id, followingId: blockerId },
        ],
      },
    })
    for (const follow of follows) {
      await tx.follow.delete({ where: { id: follow.id } })
      await tx.profile.update({
        where: { userId: follow.followerId },
        data: { followingCount: { decrement: 1 } },
      })
      await tx.profile.update({
        where: { userId: follow.followingId },
        data: { followersCount: { decrement: 1 } },
      })
    }
  })

  return { blocked: true }
}

export async function unblockUser(blockerId: string, username: string) {
  const target = await resolveTargetUser(username)
  await prisma.block.deleteMany({ where: { blockerId, blockedId: target.id } })
  return { blocked: false }
}

export async function muteUser(muterId: string, username: string) {
  const target = await resolveTargetUser(username)
  if (target.id === muterId) throw forbidden("You cannot mute yourself")
  await prisma.mute.upsert({
    where: { muterId_mutedId: { muterId, mutedId: target.id } },
    create: { muterId, mutedId: target.id },
    update: {},
  })
  return { muted: true }
}

export async function unmuteUser(muterId: string, username: string) {
  const target = await resolveTargetUser(username)
  await prisma.mute.deleteMany({ where: { muterId, mutedId: target.id } })
  return { muted: false }
}

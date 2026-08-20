import { prisma } from "../lib/prisma"

/**
 * Authors the viewer should never see in a timeline:
 * people they blocked, people who blocked them, and people they muted.
 * Returned as an array so it can be dropped straight into `notIn` filters.
 */
export async function getHiddenAuthorIds(viewerId?: string): Promise<string[]> {
  if (!viewerId) return []

  const [blocking, blockedBy, muted] = await Promise.all([
    prisma.block.findMany({ where: { blockerId: viewerId }, select: { blockedId: true } }),
    prisma.block.findMany({ where: { blockedId: viewerId }, select: { blockerId: true } }),
    prisma.mute.findMany({ where: { muterId: viewerId }, select: { mutedId: true } }),
  ])

  const hidden = new Set<string>()
  for (const row of blocking) hidden.add(row.blockedId)
  for (const row of blockedBy) hidden.add(row.blockerId)
  for (const row of muted) hidden.add(row.mutedId)
  return [...hidden]
}

export async function isBlockedBetween(userA: string, userB: string): Promise<boolean> {
  if (userA === userB) return false
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
    select: { id: true },
  })
  return Boolean(block)
}

export async function getFollowingIds(viewerId: string): Promise<string[]> {
  const rows = await prisma.follow.findMany({
    where: { followerId: viewerId },
    select: { followingId: true },
  })
  return rows.map((row) => row.followingId)
}

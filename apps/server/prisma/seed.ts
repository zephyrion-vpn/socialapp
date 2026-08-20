/**
 * Idempotent development seed.
 *   npm run seed -w @socialapp/server
 *
 * Creates demo accounts (password: Password123), follows, threads with
 * hashtags, likes, reposts, bookmarks and notifications so the desktop client
 * has real content to render on first launch.
 */
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { extractHashtags } from "@socialapp/shared"

const prisma = new PrismaClient()

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "Password123"

const people = [
  {
    username: "ada",
    email: "ada@socialapp.dev",
    displayName: "Ada Lovelace",
    bio: "Writing the first algorithms. Currently shipping #typescript on the desktop.",
    location: "London",
    website: "https://example.com/ada",
  },
  {
    username: "grace",
    email: "grace@socialapp.dev",
    displayName: "Grace Hopper",
    bio: "Compilers, debugging and nanoseconds. Ship it.",
    location: "New York",
    website: null,
  },
  {
    username: "linus",
    email: "linus@socialapp.dev",
    displayName: "Linus",
    bio: "Talk is cheap. Show me the code.",
    location: "Portland",
    website: null,
  },
  {
    username: "margaret",
    email: "margaret@socialapp.dev",
    displayName: "Margaret Hamilton",
    bio: "Software engineering, on-board flight software. Errors are data.",
    location: "Cambridge",
    website: null,
  },
  {
    username: "alan",
    email: "alan@socialapp.dev",
    displayName: "Alan T.",
    bio: "Machines that think. Occasional posts about #postgres internals.",
    location: "Manchester",
    website: null,
  },
]

const threads: Array<{ author: string; content: string; replies?: Array<{ author: string; content: string }> }> = [
  {
    author: "ada",
    content:
      "Just shipped the first build of our desktop client. Real installer, Start Menu shortcut, no browser tab in sight. #electron #typescript",
    replies: [
      { author: "grace", content: "A native window beats a browser tab every single time." },
      { author: "linus", content: "Does it start a local server? Please say no." },
      { author: "ada", content: "No. The .exe is a pure client, the API lives on Railway. #railway" },
    ],
  },
  {
    author: "grace",
    content:
      "Cursor pagination is not optional at scale. Offsets get slower the deeper you scroll, keyset stays flat. #postgres",
    replies: [{ author: "alan", content: "Keyset on (createdAt, id) with a matching composite index. Chef's kiss." }],
  },
  {
    author: "linus",
    content: "Rate limiting, input validation and never trusting the client. Boring, unglamorous, absolutely required.",
  },
  {
    author: "margaret",
    content:
      "Error states are part of the product. Offline banner, retry, skeletons - that is where an app stops feeling like a website. #ux",
    replies: [{ author: "ada", content: "Added skeletons everywhere today. The perceived speed difference is wild." }],
  },
  {
    author: "alan",
    content: "The feed algorithm should be a strategy you can swap, not an if-statement you regret. #architecture",
  },
  {
    author: "ada",
    content: "Dark mode, light mode, keyboard shortcuts. Press ? in the app to see all of them.",
  },
]

async function upsertHashtags(postId: string, content: string, createdAt: Date) {
  for (const tag of extractHashtags(content)) {
    const hashtag = await prisma.hashtag.upsert({
      where: { tag },
      create: { tag, postCount: 1, lastUsedAt: createdAt },
      update: { postCount: { increment: 1 }, lastUsedAt: createdAt },
    })
    await prisma.postHashtag.upsert({
      where: { postId_hashtagId: { postId, hashtagId: hashtag.id } },
      create: { postId, hashtagId: hashtag.id, createdAt },
      update: {},
    })
  }
}

async function main() {
  console.log("Seeding SocialApp database...")
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)

  // ---------------------------------------------------------------- users
  const users = new Map<string, string>()
  for (const person of people) {
    const user = await prisma.user.upsert({
      where: { username: person.username },
      update: {},
      create: {
        email: person.email,
        username: person.username,
        passwordHash,
        isVerified: true,
        profile: {
          create: {
            displayName: person.displayName,
            bio: person.bio,
            location: person.location,
            website: person.website,
          },
        },
      },
    })
    users.set(person.username, user.id)
  }
  console.log(`  users: ${users.size}`)

  // -------------------------------------------------------------- follows
  const usernames = [...users.keys()]
  let follows = 0
  for (const follower of usernames) {
    for (const following of usernames) {
      if (follower === following) continue
      // Everyone follows ada; the rest follow each other with a simple pattern.
      if (following !== "ada" && Math.abs(usernames.indexOf(follower) - usernames.indexOf(following)) > 1) continue
      const followerId = users.get(follower)!
      const followingId = users.get(following)!
      const existing = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId, followingId } },
      })
      if (existing) continue
      await prisma.$transaction([
        prisma.follow.create({ data: { followerId, followingId } }),
        prisma.profile.update({ where: { userId: followerId }, data: { followingCount: { increment: 1 } } }),
        prisma.profile.update({ where: { userId: followingId }, data: { followersCount: { increment: 1 } } }),
      ])
      follows += 1
    }
  }
  console.log(`  follows: ${follows}`)

  // ---------------------------------------------------------------- posts
  const alreadySeeded = await prisma.post.count()
  if (alreadySeeded > 0) {
    console.log(`  posts: skipped (${alreadySeeded} already present)`)
    console.log("\nSeed finished. Demo login: ada@socialapp.dev / " + DEMO_PASSWORD)
    return
  }

  let createdAt = new Date(Date.now() - threads.length * 3 * 3600_000)
  const rootPostIds: string[] = []

  for (const thread of threads) {
    createdAt = new Date(createdAt.getTime() + 90 * 60_000)
    const authorId = users.get(thread.author)!
    const root = await prisma.post.create({
      data: { authorId, content: thread.content, createdAt, updatedAt: createdAt },
    })
    await prisma.post.update({ where: { id: root.id }, data: { rootId: root.id } })
    await prisma.profile.update({ where: { userId: authorId }, data: { postsCount: { increment: 1 } } })
    await upsertHashtags(root.id, thread.content, createdAt)
    rootPostIds.push(root.id)

    for (const reply of thread.replies ?? []) {
      createdAt = new Date(createdAt.getTime() + 7 * 60_000)
      const replyAuthorId = users.get(reply.author)!
      const created = await prisma.post.create({
        data: {
          authorId: replyAuthorId,
          content: reply.content,
          parentId: root.id,
          rootId: root.id,
          createdAt,
          updatedAt: createdAt,
        },
      })
      await prisma.reply.create({
        data: { postId: root.id, replyId: created.id, authorId: replyAuthorId, createdAt },
      })
      await prisma.post.update({
        where: { id: root.id },
        data: { replyCount: { increment: 1 }, score: { increment: 2 } },
      })
      await prisma.profile.update({ where: { userId: replyAuthorId }, data: { postsCount: { increment: 1 } } })
      await upsertHashtags(created.id, reply.content, createdAt)

      if (replyAuthorId !== authorId) {
        await prisma.notification.create({
          data: { recipientId: authorId, actorId: replyAuthorId, type: "REPLY", postId: created.id, createdAt },
        })
      }
    }
  }
  console.log(`  threads: ${threads.length}`)

  // ----------------------------------------------------------- engagement
  let likes = 0
  let reposts = 0
  for (const [index, postId] of rootPostIds.entries()) {
    const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } })
    for (const [offset, username] of usernames.entries()) {
      const userId = users.get(username)!
      if (userId === post.authorId) continue
      if ((index + offset) % 2 === 0) {
        await prisma.like.create({ data: { userId, postId } })
        await prisma.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 }, score: { increment: 3 } },
        })
        await prisma.notification.create({
          data: { recipientId: post.authorId, actorId: userId, type: "LIKE", postId },
        })
        likes += 1
      }
      if ((index + offset) % 3 === 0) {
        await prisma.repost.create({ data: { userId, postId } })
        await prisma.post.update({
          where: { id: postId },
          data: { repostCount: { increment: 1 }, score: { increment: 4 } },
        })
        await prisma.notification.create({
          data: { recipientId: post.authorId, actorId: userId, type: "REPOST", postId },
        })
        reposts += 1
      }
    }
  }

  const adaId = users.get("ada")!
  for (const postId of rootPostIds.slice(1, 3)) {
    await prisma.bookmark.create({ data: { userId: adaId, postId } })
    await prisma.post.update({ where: { id: postId }, data: { bookmarkCount: { increment: 1 } } })
  }

  console.log(`  likes: ${likes}, reposts: ${reposts}`)
  console.log(`\nSeed finished. Demo login: ada@socialapp.dev / ${DEMO_PASSWORD}`)
}

main()
  .catch((error) => {
    console.error("Seed failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

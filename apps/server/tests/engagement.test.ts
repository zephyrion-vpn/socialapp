import { beforeAll, describe, expect, it } from "vitest"

import { api, app, bearer, createPost, registerUser, request, resetDatabase } from "./helpers"
import type { TestUser } from "./helpers"

describe("engagement", () => {
  let alice: TestUser
  let bob: TestUser

  beforeAll(async () => {
    await resetDatabase()
    alice = await registerUser()
    bob = await registerUser()
  })

  it("likes and unlikes a post, keeping counters in sync", async () => {
    const post = await createPost(alice, "Like this post")

    const liked = await request(app)
      .post(api(`/posts/${post.id}/like`))
      .set("Authorization", bearer(bob))
      .expect(200)
    expect(liked.body).toEqual({ liked: true, likeCount: 1 })

    // Liking twice is idempotent.
    const again = await request(app)
      .post(api(`/posts/${post.id}/like`))
      .set("Authorization", bearer(bob))
      .expect(200)
    expect(again.body.likeCount).toBe(1)

    const viewed = await request(app)
      .get(api(`/posts/${post.id}`))
      .set("Authorization", bearer(bob))
      .expect(200)
    expect(viewed.body.post.liked).toBe(true)

    const unliked = await request(app)
      .delete(api(`/posts/${post.id}/like`))
      .set("Authorization", bearer(bob))
      .expect(200)
    expect(unliked.body).toEqual({ liked: false, likeCount: 0 })
  })

  it("notifies the author about a like", async () => {
    const post = await createPost(alice, "Notify me")
    await request(app)
      .post(api(`/posts/${post.id}/like`))
      .set("Authorization", bearer(bob))
      .expect(200)

    const unread = await request(app)
      .get(api("/notifications/unread-count"))
      .set("Authorization", bearer(alice))
      .expect(200)
    expect(unread.body.count).toBeGreaterThan(0)

    await request(app)
      .post(api("/notifications/read-all"))
      .set("Authorization", bearer(alice))
      .expect(200)

    const afterRead = await request(app)
      .get(api("/notifications/unread-count"))
      .set("Authorization", bearer(alice))
      .expect(200)
    expect(afterRead.body.count).toBe(0)
  })

  it("reposts and undoes a repost", async () => {
    const post = await createPost(alice, "Repost me")

    const reposted = await request(app)
      .post(api(`/posts/${post.id}/repost`))
      .set("Authorization", bearer(bob))
      .expect(200)
    expect(reposted.body).toEqual({ reposted: true, repostCount: 1 })

    const timeline = await request(app)
      .get(api(`/users/${bob.username}/reposts`))
      .set("Authorization", bearer(bob))
      .expect(200)
    expect(timeline.body.items.some((item: { id: string }) => item.id === post.id)).toBe(true)

    const undone = await request(app)
      .delete(api(`/posts/${post.id}/repost`))
      .set("Authorization", bearer(bob))
      .expect(200)
    expect(undone.body).toEqual({ reposted: false, repostCount: 0 })
  })

  it("bookmarks a post and lists it", async () => {
    const post = await createPost(alice, "Bookmark me")

    await request(app)
      .post(api(`/posts/${post.id}/bookmark`))
      .set("Authorization", bearer(bob))
      .expect(200)

    const bookmarks = await request(app)
      .get(api("/bookmarks"))
      .set("Authorization", bearer(bob))
      .expect(200)
    expect(bookmarks.body.items.some((item: { id: string }) => item.id === post.id)).toBe(true)

    await request(app)
      .delete(api(`/posts/${post.id}/bookmark`))
      .set("Authorization", bearer(bob))
      .expect(200)

    const empty = await request(app)
      .get(api("/bookmarks"))
      .set("Authorization", bearer(bob))
      .expect(200)
    expect(empty.body.items.some((item: { id: string }) => item.id === post.id)).toBe(false)
  })

  it("follows and unfollows an account", async () => {
    const followed = await request(app)
      .post(api(`/users/${alice.username}/follow`))
      .set("Authorization", bearer(bob))
      .expect(200)
    expect(followed.body).toEqual({ following: true, followersCount: 1 })

    const profile = await request(app)
      .get(api(`/users/${alice.username}`))
      .set("Authorization", bearer(bob))
      .expect(200)
    expect(profile.body.user.isFollowing).toBe(true)
    expect(profile.body.user.followersCount).toBe(1)

    const followers = await request(app)
      .get(api(`/users/${alice.username}/followers`))
      .expect(200)
    expect(followers.body.items.some((item: { username: string }) => item.username === bob.username)).toBe(
      true,
    )

    const unfollowed = await request(app)
      .delete(api(`/users/${alice.username}/follow`))
      .set("Authorization", bearer(bob))
      .expect(200)
    expect(unfollowed.body).toEqual({ following: false, followersCount: 0 })
  })

  it("refuses to follow yourself", async () => {
    await request(app)
      .post(api(`/users/${bob.username}/follow`))
      .set("Authorization", bearer(bob))
      .expect(403)
  })

  it("blocks an account and hides it from search", async () => {
    const charlie = await registerUser()
    await createPost(charlie, "Visible to everyone for now")

    await request(app)
      .post(api(`/users/${charlie.username}/block`))
      .set("Authorization", bearer(bob))
      .expect(200)

    const results = await request(app)
      .get(api("/search/users"))
      .query({ q: charlie.username })
      .set("Authorization", bearer(bob))
      .expect(200)
    expect(results.body.items).toHaveLength(0)

    await request(app)
      .delete(api(`/users/${charlie.username}/block`))
      .set("Authorization", bearer(bob))
      .expect(200)
  })
})

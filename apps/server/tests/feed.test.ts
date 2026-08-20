import { beforeAll, describe, expect, it } from "vitest"

import { api, app, bearer, createPost, registerUser, request, resetDatabase } from "./helpers"
import type { TestUser } from "./helpers"

describe("feed", () => {
  let viewer: TestUser
  let followed: TestUser
  let stranger: TestUser

  beforeAll(async () => {
    await resetDatabase()
    viewer = await registerUser()
    followed = await registerUser()
    stranger = await registerUser()

    await request(app)
      .post(api(`/users/${followed.username}/follow`))
      .set("Authorization", bearer(viewer))
      .expect(200)

    await createPost(followed, "First post from a followed account")
    await createPost(followed, "Second post from a followed account")
    await createPost(followed, "Third post from a followed account #news")
    await createPost(stranger, "Post from an account nobody follows")
  })

  it("returns posts from followed accounts only", async () => {
    const response = await request(app)
      .get(api("/feed"))
      .query({ type: "home" })
      .set("Authorization", bearer(viewer))
      .expect(200)

    const usernames = response.body.items.map((post: { author: { username: string } }) => post.author.username)
    expect(usernames).toContain(followed.username)
    expect(usernames).not.toContain(stranger.username)
  })

  it("paginates with a cursor without repeating items", async () => {
    const first = await request(app)
      .get(api("/feed"))
      .query({ type: "home", limit: 2 })
      .set("Authorization", bearer(viewer))
      .expect(200)

    expect(first.body.items).toHaveLength(2)
    expect(first.body.hasMore).toBe(true)
    expect(first.body.nextCursor).toBeTruthy()

    const second = await request(app)
      .get(api("/feed"))
      .query({ type: "home", limit: 2, cursor: first.body.nextCursor })
      .set("Authorization", bearer(viewer))
      .expect(200)

    const firstIds = first.body.items.map((post: { id: string }) => post.id)
    const secondIds = second.body.items.map((post: { id: string }) => post.id)
    expect(secondIds.some((id: string) => firstIds.includes(id))).toBe(false)
  })

  it("rejects an invalid cursor", async () => {
    await request(app)
      .get(api("/feed"))
      .query({ type: "home", cursor: "not-a-real-cursor" })
      .set("Authorization", bearer(viewer))
      .expect(400)
  })

  it("serves the latest, popular and recommended timelines", async () => {
    for (const type of ["latest", "popular", "recommended"]) {
      const response = await request(app)
        .get(api("/feed"))
        .query({ type })
        .set("Authorization", bearer(viewer))
        .expect(200)
      expect(Array.isArray(response.body.items)).toBe(true)
    }
  })

  it("works for anonymous callers", async () => {
    const response = await request(app).get(api("/feed")).query({ type: "latest" }).expect(200)
    expect(response.body.items.length).toBeGreaterThan(0)
    expect(response.body.items[0].liked).toBe(false)
  })

  it("finds posts and hashtags through search and trends", async () => {
    const search = await request(app)
      .get(api("/search"))
      .query({ q: "followed account" })
      .expect(200)
    expect(search.body.posts.items.length).toBeGreaterThan(0)

    const hashtag = await request(app).get(api("/search/posts")).query({ q: "#news" }).expect(200)
    expect(hashtag.body.items.length).toBeGreaterThan(0)

    const trends = await request(app).get(api("/trends")).expect(200)
    expect(Array.isArray(trends.body.trends)).toBe(true)
  })

  it("lists a user timeline and suggested accounts", async () => {
    const timeline = await request(app)
      .get(api(`/users/${followed.username}/posts`))
      .set("Authorization", bearer(viewer))
      .expect(200)
    expect(timeline.body.items).toHaveLength(3)

    const suggested = await request(app)
      .get(api("/users/suggested"))
      .set("Authorization", bearer(viewer))
      .expect(200)
    const usernames = suggested.body.users.map((user: { username: string }) => user.username)
    expect(usernames).not.toContain(viewer.username)
    expect(usernames).not.toContain(followed.username)
  })
})

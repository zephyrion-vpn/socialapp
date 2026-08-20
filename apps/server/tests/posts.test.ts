import { beforeAll, describe, expect, it } from "vitest"

import { api, app, bearer, createPost, registerUser, request, resetDatabase } from "./helpers"
import type { TestUser } from "./helpers"

describe("posts and replies", () => {
  let author: TestUser
  let reader: TestUser

  beforeAll(async () => {
    await resetDatabase()
    author = await registerUser()
    reader = await registerUser()
  })

  it("creates a post and extracts hashtags", async () => {
    const post = await createPost(author, "Shipping the desktop client today #buildinpublic")

    expect(post.id).toBeTruthy()
    expect(post.author.username).toBe(author.username)
    expect(post.content).toContain("desktop client")
    expect(post.hashtags.join(",")).toContain("buildinpublic")
    expect(post.replyCount).toBe(0)
    expect(post.likeCount).toBe(0)
  })

  it("requires authentication and valid content", async () => {
    await request(app).post(api("/posts")).send({ content: "anonymous" }).expect(401)

    const empty = await request(app)
      .post(api("/posts"))
      .set("Authorization", bearer(author))
      .send({ content: "   " })
      .expect(422)
    expect(empty.body.error.code).toBe("VALIDATION_ERROR")

    await request(app)
      .post(api("/posts"))
      .set("Authorization", bearer(author))
      .send({ content: "x".repeat(501) })
      .expect(422)
  })

  it("rejects media the caller does not own", async () => {
    await request(app)
      .post(api("/posts"))
      .set("Authorization", bearer(author))
      .send({ content: "stolen media", media: [{ key: "post/someone-else/evil.png" }] })
      .expect(403)
  })

  it("reads a single post and its thread", async () => {
    const post = await createPost(author, "Thread root")

    const single = await request(app).get(api(`/posts/${post.id}`)).expect(200)
    expect(single.body.post.id).toBe(post.id)

    const thread = await request(app).get(api(`/posts/${post.id}/thread`)).expect(200)
    expect(thread.body.post.id).toBe(post.id)
    expect(thread.body.ancestors).toEqual([])
    expect(thread.body.replies.items).toEqual([])
  })

  it("creates a reply, links the thread and notifies the author", async () => {
    const root = await createPost(author, "What are you building?")
    const reply = await createPost(reader, "A Windows client for this network", { parentId: root.id })

    expect(reply.isReply).toBe(true)
    expect(reply.parentId).toBe(root.id)
    expect(reply.rootId).toBe(root.id)
    expect(reply.replyTo?.username).toBe(author.username)

    const updatedRoot = await request(app).get(api(`/posts/${root.id}`)).expect(200)
    expect(updatedRoot.body.post.replyCount).toBe(1)

    const replies = await request(app).get(api(`/posts/${root.id}/replies`)).expect(200)
    expect(replies.body.items).toHaveLength(1)
    expect(replies.body.items[0].id).toBe(reply.id)

    const thread = await request(app).get(api(`/posts/${reply.id}/thread`)).expect(200)
    expect(thread.body.ancestors).toHaveLength(1)
    expect(thread.body.ancestors[0].id).toBe(root.id)

    const notifications = await request(app)
      .get(api("/notifications"))
      .set("Authorization", bearer(author))
      .expect(200)
    const replyNotification = notifications.body.items.find(
      (item: { type: string }) => item.type === "REPLY",
    )
    expect(replyNotification).toBeTruthy()
    expect(replyNotification.actor.username).toBe(reader.username)
  })

  it("only lets the author delete a post", async () => {
    const post = await createPost(author, "Temporary post")

    await request(app)
      .delete(api(`/posts/${post.id}`))
      .set("Authorization", bearer(reader))
      .expect(403)

    await request(app)
      .delete(api(`/posts/${post.id}`))
      .set("Authorization", bearer(author))
      .expect(204)

    await request(app).get(api(`/posts/${post.id}`)).expect(404)
  })

  it("validates post identifiers", async () => {
    await request(app).get(api("/posts/not-a-uuid")).expect(422)
  })
})

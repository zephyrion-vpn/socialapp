import { beforeAll, describe, expect, it } from "vitest"

import { api, app, bearer, registerUser, request, resetDatabase, uniqueUsername } from "./helpers"

describe("authentication", () => {
  beforeAll(async () => {
    await resetDatabase()
  })

  it("registers a new account and returns tokens", async () => {
    const username = uniqueUsername("reg")
    const response = await request(app)
      .post(api("/auth/register"))
      .send({
        email: `${username}@example.com`,
        username,
        password: "Password123",
        displayName: "New Person",
      })
      .expect(201)

    expect(response.body.user.username).toBe(username)
    expect(response.body.user.displayName).toBe("New Person")
    expect(response.body.tokens.accessToken).toBeTruthy()
    expect(response.body.tokens.refreshToken).toBeTruthy()
    // The password hash must never leave the server.
    expect(JSON.stringify(response.body)).not.toContain("Password123")
  })

  it("rejects a weak password", async () => {
    const username = uniqueUsername("weak")
    const response = await request(app)
      .post(api("/auth/register"))
      .send({ email: `${username}@example.com`, username, password: "short" })
      .expect(422)

    expect(response.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("rejects duplicate email and username", async () => {
    const user = await registerUser()

    await request(app)
      .post(api("/auth/register"))
      .send({ email: user.email, username: uniqueUsername("dup"), password: "Password123" })
      .expect(409)

    await request(app)
      .post(api("/auth/register"))
      .send({
        email: `${uniqueUsername("dup")}@example.com`,
        username: user.username,
        password: "Password123",
      })
      .expect(409)
  })

  it("logs in with email or username and rejects a wrong password", async () => {
    const user = await registerUser()

    const byEmail = await request(app)
      .post(api("/auth/login"))
      .send({ identifier: user.email, password: user.password })
      .expect(200)
    expect(byEmail.body.tokens.accessToken).toBeTruthy()

    const byUsername = await request(app)
      .post(api("/auth/login"))
      .send({ identifier: user.username, password: user.password })
      .expect(200)
    expect(byUsername.body.user.username).toBe(user.username)

    const wrong = await request(app)
      .post(api("/auth/login"))
      .send({ identifier: user.email, password: "WrongPassword123" })
      .expect(401)
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS")
  })

  it("protects endpoints that require a token", async () => {
    await request(app).get(api("/auth/me")).expect(401)
    await request(app).get(api("/auth/me")).set("Authorization", "Bearer nonsense").expect(401)

    const user = await registerUser()
    const me = await request(app).get(api("/auth/me")).set("Authorization", bearer(user)).expect(200)
    expect(me.body.user.username).toBe(user.username)
  })

  it("rotates refresh tokens and invalidates the previous one", async () => {
    const user = await registerUser()

    const refreshed = await request(app)
      .post(api("/auth/refresh"))
      .send({ refreshToken: user.tokens.refreshToken })
      .expect(200)

    expect(refreshed.body.tokens.refreshToken).not.toBe(user.tokens.refreshToken)

    // The old refresh token is no longer accepted.
    await request(app)
      .post(api("/auth/refresh"))
      .send({ refreshToken: user.tokens.refreshToken })
      .expect(401)

    // The new one still works.
    await request(app)
      .post(api("/auth/refresh"))
      .send({ refreshToken: refreshed.body.tokens.refreshToken })
      .expect(200)
  })

  it("revokes the session on logout", async () => {
    const user = await registerUser()

    await request(app)
      .post(api("/auth/logout"))
      .set("Authorization", bearer(user))
      .send({ refreshToken: user.tokens.refreshToken })
      .expect(204)

    await request(app).get(api("/auth/me")).set("Authorization", bearer(user)).expect(401)
    await request(app)
      .post(api("/auth/refresh"))
      .send({ refreshToken: user.tokens.refreshToken })
      .expect(401)
  })

  it("lists active sessions and supports password change", async () => {
    const user = await registerUser()

    const sessions = await request(app)
      .get(api("/auth/sessions"))
      .set("Authorization", bearer(user))
      .expect(200)
    expect(sessions.body.sessions.length).toBeGreaterThan(0)
    expect(sessions.body.sessions.some((session: { current: boolean }) => session.current)).toBe(true)

    await request(app)
      .post(api("/auth/password/change"))
      .set("Authorization", bearer(user))
      .send({ currentPassword: "WrongPassword123", newPassword: "BrandNewPass123" })
      .expect(401)

    await request(app)
      .post(api("/auth/password/change"))
      .set("Authorization", bearer(user))
      .send({ currentPassword: user.password, newPassword: "BrandNewPass123" })
      .expect(200)

    await request(app)
      .post(api("/auth/login"))
      .send({ identifier: user.email, password: "BrandNewPass123" })
      .expect(200)
  })

  it("exposes health and version without authentication", async () => {
    const health = await request(app).get("/health").expect(200)
    expect(health.body.status).toBe("ok")

    const version = await request(app).get("/version").expect(200)
    expect(version.body.version).toBeTruthy()
  })
})

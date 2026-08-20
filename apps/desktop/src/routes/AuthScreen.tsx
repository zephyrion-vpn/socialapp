import { useState } from "react"

import { appConfig, bridge } from "@/api/bridge"
import { api, currentApiBaseUrl, setApiBaseUrl } from "@/api/client"
import { Spinner } from "@/components/States"
import { useSession } from "@/store/session"
import { humanizeError, useUi } from "@/store/ui"

type Mode = "login" | "register" | "forgot"

export function AuthScreen() {
  const { login, register } = useSession()
  const { toast, toastError } = useUi()

  const [mode, setMode] = useState<Mode>("login")
  const [identifier, setIdentifier] = useState("")
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [serverOpen, setServerOpen] = useState(false)
  const [serverUrl, setServerUrl] = useState(currentApiBaseUrl())
  const [serverState, setServerState] = useState<"idle" | "checking" | "ok" | "fail">("idle")

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      if (mode === "login") {
        await login({ identifier: identifier.trim(), password })
      } else if (mode === "register") {
        await register({
          email: email.trim(),
          username: username.trim().toLowerCase(),
          password,
          displayName: displayName.trim() || undefined,
        })
      } else {
        const result = await api.auth.forgotPassword(email.trim())
        toast(
          result.resetToken
            ? `Development reset token: ${result.resetToken}`
            : "If that email exists, a reset link is on its way",
          "success",
        )
        setMode("login")
      }
    } catch (caught) {
      setError(humanizeError(caught))
    } finally {
      setBusy(false)
    }
  }

  async function saveServer() {
    setServerState("checking")
    try {
      const result = await bridge.settings.update({ apiUrl: serverUrl.trim() })
      setApiBaseUrl(result.apiUrl)
      await api.system.health()
      setServerState("ok")
      toast(`Connected to ${result.apiUrl}`, "success")
    } catch (caught) {
      setServerState("fail")
      toastError(caught, "Could not reach that server")
    }
  }

  return (
    <div className="auth">
      <section className="auth__hero">
        <div className="row" style={{ gap: 12 }}>
          <span className="sidebar__logo" style={{ width: 44, height: 44, fontSize: 22 }}>
            {"\uD83D\uDCAC"}
          </span>
          <strong style={{ fontSize: 20 }}>SocialApp</strong>
        </div>
        <h1>
          Conversations,
          <br />
          without the browser.
        </h1>
        <p style={{ maxWidth: 420, opacity: 0.9 }}>
          A native Windows client for a real social network: follow people, post threads, share
          images and keep up with trends. Your account lives on the server, so it follows you to
          every device.
        </p>
        <div className="col" style={{ gap: 6, opacity: 0.85, fontSize: 14 }}>
          <span>{"\u2713 Encrypted session storage via Windows DPAPI"}</span>
          <span>{"\u2713 Works against any deployment of the SocialApp API"}</span>
          <span>{"\u2713 Keyboard-first, dark and light themes"}</span>
        </div>
      </section>

      <section className="auth__panel">
        <div className="auth__switch">
          <button type="button" data-active={mode === "login"} onClick={() => setMode("login")}>
            Log in
          </button>
          <button
            type="button"
            data-active={mode === "register"}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        <form
          className="col"
          style={{ gap: 14 }}
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          {mode === "login" ? (
            <label className="field">
              <span className="field__label">Email or username</span>
              <input
                className="input"
                value={identifier}
                autoFocus
                autoComplete="username"
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </label>
          ) : (
            <label className="field">
              <span className="field__label">Email</span>
              <input
                className="input"
                type="email"
                value={email}
                autoFocus
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}

          {mode === "register" ? (
            <>
              <label className="field">
                <span className="field__label">Username</span>
                <input
                  className="input"
                  value={username}
                  placeholder="lowercase, digits, underscore"
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Display name (optional)</span>
                <input
                  className="input"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
            </>
          ) : null}

          {mode !== "forgot" ? (
            <label className="field">
              <span className="field__label">Password</span>
              <input
                className="input"
                type="password"
                value={password}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                onChange={(event) => setPassword(event.target.value)}
              />
              {mode === "register" ? (
                <span className="muted">At least 8 characters, with a letter and a digit.</span>
              ) : null}
            </label>
          ) : null}

          {error ? <div className="field__error">{error}</div> : null}

          <button type="submit" className="button" disabled={busy}>
            {busy ? (
              <Spinner />
            ) : mode === "login" ? (
              "Log in"
            ) : mode === "register" ? (
              "Create account"
            ) : (
              "Send reset instructions"
            )}
          </button>

          <button
            type="button"
            className="button"
            data-variant="ghost"
            data-size="sm"
            onClick={() => setMode(mode === "forgot" ? "login" : "forgot")}
          >
            {mode === "forgot" ? "Back to log in" : "Forgot your password?"}
          </button>
        </form>

        <div className="divider" />

        <div className="col" style={{ gap: 8 }}>
          <button
            type="button"
            className="button"
            data-variant="ghost"
            data-size="sm"
            onClick={() => setServerOpen((open) => !open)}
          >
            {`Server: ${currentApiBaseUrl()}`}
          </button>

          {serverOpen ? (
            <div className="col" style={{ gap: 8 }}>
              <input
                className="input"
                value={serverUrl}
                spellCheck={false}
                placeholder="https://your-api.up.railway.app"
                onChange={(event) => setServerUrl(event.target.value)}
              />
              <div className="row">
                <button
                  type="button"
                  className="button"
                  data-size="sm"
                  data-variant="secondary"
                  disabled={serverState === "checking"}
                  onClick={() => void saveServer()}
                >
                  {serverState === "checking" ? "Checking\u2026" : "Save and test"}
                </button>
                {serverState === "ok" ? <span className="muted">{"\u2713 reachable"}</span> : null}
                {serverState === "fail" ? (
                  <span className="field__error">unreachable</span>
                ) : null}
              </div>
              <span className="muted">
                The desktop client never runs a server of its own - it talks to your deployment over
                HTTPS. Version {appConfig.version}.
              </span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}

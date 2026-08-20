import type { SessionInfo } from "@socialapp/shared"
import { useState } from "react"

import { appConfig, isDesktopApp } from "@/api/bridge"
import { api, currentApiBaseUrl, setApiBaseUrl } from "@/api/client"
import { Page, Topbar } from "@/components/AppShell"
import { Spinner } from "@/components/States"
import { useAsync } from "@/hooks/useAsync"
import { useSession } from "@/store/session"
import { humanizeError, useUi } from "@/store/ui"

export function SettingsRoute() {
  const { settings, updateSettings, updateStatus, checkForUpdates, toast, toastError } = useUi()
  const { logout, refreshUser } = useSession()

  const [apiUrl, setApiUrl] = useState(currentApiBaseUrl())
  const [savingUrl, setSavingUrl] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [passwordBusy, setPasswordBusy] = useState(false)

  const sessions = useAsync<{ sessions: SessionInfo[] }>(() => api.auth.sessions(), "sessions")

  async function saveApiUrl() {
    setSavingUrl(true)
    try {
      const result = await updateSettings({ apiUrl: apiUrl.trim() || null })
      const nextUrl = result.apiUrl ?? appConfig.apiUrl
      setApiBaseUrl(nextUrl)
      setApiUrl(nextUrl)
      await api.system.health()
      await refreshUser()
      toast(`Connected to ${nextUrl}`, "success")
    } catch (error) {
      toastError(error, "That server did not respond")
    } finally {
      setSavingUrl(false)
    }
  }

  async function changePassword() {
    setPasswordBusy(true)
    try {
      await api.auth.changePassword({ currentPassword, newPassword })
      setCurrentPassword("")
      setNewPassword("")
      toast("Password changed. Other devices were signed out.", "success")
      void sessions.reload()
    } catch (error) {
      toast(humanizeError(error), "error")
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    <>
      <Topbar title="Settings" subtitle={`SocialApp ${appConfig.version}`} />

      <Page>
        <div className="col" style={{ gap: 18, padding: 18 }}>
          <section className="card">
            <h2 className="card__title">Server</h2>
            <div className="col" style={{ gap: 10, padding: "0 16px 16px" }}>
              <p className="muted">
                The desktop client is a pure API client. Point it at your Railway deployment - it
                never starts a backend locally.
              </p>
              <input
                className="input"
                value={apiUrl}
                spellCheck={false}
                placeholder="https://your-api.up.railway.app"
                onChange={(event) => setApiUrl(event.target.value)}
              />
              <div className="row">
                <button
                  type="button"
                  className="button"
                  data-size="sm"
                  disabled={savingUrl}
                  onClick={() => void saveApiUrl()}
                >
                  {savingUrl ? <Spinner /> : "Save and test"}
                </button>
                <button
                  type="button"
                  className="button"
                  data-variant="ghost"
                  data-size="sm"
                  onClick={() => {
                    setApiUrl(appConfig.apiUrl)
                    void updateSettings({ apiUrl: null }).then(() =>
                      setApiBaseUrl(appConfig.apiUrl),
                    )
                  }}
                >
                  Reset to build default
                </button>
              </div>
              <span className="muted">{`Build default: ${appConfig.apiUrl}`}</span>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">Appearance</h2>
            <div className="col" style={{ gap: 12, padding: "0 16px 16px" }}>
              <label className="field">
                <span className="field__label">Theme</span>
                <select
                  className="select"
                  value={settings.theme}
                  onChange={(event) =>
                    void updateSettings({
                      theme: event.target.value as "system" | "light" | "dark",
                    })
                  }
                >
                  <option value="system">Match Windows</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>

              <label className="field">
                <span className="field__label">Density</span>
                <select
                  className="select"
                  value={settings.density}
                  onChange={(event) =>
                    void updateSettings({
                      density: event.target.value as "comfortable" | "compact",
                    })
                  }
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </label>

              <label className="row">
                <input
                  type="checkbox"
                  checked={settings.desktopNotifications}
                  onChange={(event) =>
                    void updateSettings({ desktopNotifications: event.target.checked })
                  }
                />
                <span className="grow">Show Windows notifications for new activity</span>
              </label>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">Updates</h2>
            <div className="col" style={{ gap: 10, padding: "0 16px 16px" }}>
              <label className="row">
                <input
                  type="checkbox"
                  checked={settings.autoCheckUpdates}
                  onChange={(event) =>
                    void updateSettings({ autoCheckUpdates: event.target.checked })
                  }
                />
                <span className="grow">Check for updates on startup</span>
              </label>
              <div className="row">
                <button
                  type="button"
                  className="button"
                  data-variant="secondary"
                  data-size="sm"
                  onClick={() => void checkForUpdates()}
                >
                  Check now
                </button>
                <span className="muted">
                  {updateStatus.state === "disabled"
                    ? "Available in the installed build"
                    : `Status: ${updateStatus.state}`}
                </span>
              </div>
              <span className="muted">
                Updates are published as GitHub Releases and installed by the app.
              </span>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">Password</h2>
            <div className="col" style={{ gap: 10, padding: "0 16px 16px" }}>
              <input
                className="input"
                type="password"
                placeholder="Current password"
                value={currentPassword}
                autoComplete="current-password"
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <input
                className="input"
                type="password"
                placeholder="New password"
                value={newPassword}
                autoComplete="new-password"
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <button
                type="button"
                className="button"
                data-size="sm"
                disabled={passwordBusy || !currentPassword || !newPassword}
                onClick={() => void changePassword()}
              >
                {passwordBusy ? <Spinner /> : "Change password"}
              </button>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">Active sessions</h2>
            <div className="col" style={{ gap: 8, padding: "0 16px 16px" }}>
              {sessions.loading ? (
                <Spinner />
              ) : sessions.data && sessions.data.sessions.length > 0 ? (
                sessions.data.sessions.map((session) => (
                  <div key={session.id} className="row">
                    <div className="grow">
                      <div className="truncate">{session.userAgent ?? "Unknown device"}</div>
                      <div className="muted">
                        {session.lastUsedAt
                          ? `last used ${new Date(session.lastUsedAt).toLocaleString()}`
                          : `created ${new Date(session.createdAt).toLocaleString()}`}
                      </div>
                    </div>
                    {session.current ? <span className="pill">this device</span> : null}
                  </div>
                ))
              ) : (
                <span className="muted">No other sessions</span>
              )}

              <div className="row">
                <button
                  type="button"
                  className="button"
                  data-variant="secondary"
                  data-size="sm"
                  onClick={() => {
                    void api.auth
                      .logoutEverywhere()
                      .catch(() => undefined)
                      .finally(() => void logout())
                  }}
                >
                  Sign out everywhere
                </button>
                <button
                  type="button"
                  className="button"
                  data-variant="danger"
                  data-size="sm"
                  onClick={() => void logout()}
                >
                  Log out
                </button>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">About</h2>
            <div className="col" style={{ gap: 4, padding: "0 16px 16px" }} data-selectable>
              <span className="muted">{`Version ${appConfig.version}`}</span>
              <span className="muted">{`Platform ${appConfig.platform}`}</span>
              <span className="muted">{`Packaged build: ${appConfig.isPackaged ? "yes" : "no"}`}</span>
              <span className="muted">{`Native shell: ${isDesktopApp ? "Electron" : "browser (dev)"}`}</span>
              <span className="muted">{`API ${currentApiBaseUrl()}`}</span>
            </div>
          </section>
        </div>
      </Page>
    </>
  )
}

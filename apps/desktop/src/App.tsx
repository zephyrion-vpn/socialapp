import { useCallback, useEffect, useRef, useState } from "react"

import { bridge } from "@/api/bridge"
import { api } from "@/api/client"
import { AppShell } from "@/components/AppShell"
import { OfflineBanner, UpdateBanner } from "@/components/Banners"
import { Composer } from "@/components/Composer"
import { Modal } from "@/components/Modal"
import { ShortcutsDialog } from "@/components/ShortcutsDialog"
import { Spinner } from "@/components/States"
import { Toasts } from "@/components/Toasts"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { routes, useRouter, type Route } from "@/router"
import { AuthScreen } from "@/routes/AuthScreen"
import { BookmarksRoute } from "@/routes/BookmarksRoute"
import { ExploreRoute } from "@/routes/ExploreRoute"
import { HashtagRoute } from "@/routes/HashtagRoute"
import { HomeRoute } from "@/routes/HomeRoute"
import { NotificationsRoute } from "@/routes/NotificationsRoute"
import { PostRoute } from "@/routes/PostRoute"
import { ProfileRoute } from "@/routes/ProfileRoute"
import { SearchRoute } from "@/routes/SearchRoute"
import { SettingsRoute } from "@/routes/SettingsRoute"
import { useSession } from "@/store/session"
import { useUi } from "@/store/ui"

export function App() {
  const { status } = useSession()

  if (status === "restoring") {
    return (
      <div className="center">
        <div className="col" style={{ alignItems: "center", gap: 14 }}>
          <span className="sidebar__logo" style={{ width: 52, height: 52, fontSize: 26 }}>
            {"\uD83D\uDCAC"}
          </span>
          <Spinner />
          <span className="muted">Restoring your session\u2026</span>
        </div>
      </div>
    )
  }

  if (status === "anonymous") {
    return (
      <>
        <AuthScreen />
        <Toasts />
      </>
    )
  }

  return <AuthenticatedApp />
}

function RouteView({ route, onSeen }: { route: Route; onSeen: () => void }) {
  switch (route.name) {
    case "explore":
      return <ExploreRoute />
    case "notifications":
      return <NotificationsRoute onSeen={onSeen} />
    case "bookmarks":
      return <BookmarksRoute />
    case "settings":
      return <SettingsRoute />
    case "search":
      return <SearchRoute query={route.query} />
    case "profile":
      return <ProfileRoute username={route.username} tab={route.tab} />
    case "post":
      return <PostRoute id={route.id} />
    case "hashtag":
      return <HashtagRoute tag={route.tag} />
    default:
      return <HomeRoute />
  }
}

function AuthenticatedApp() {
  const { path, route, navigate } = useRouter()
  const { settings, shortcutsOpen, setShortcutsOpen, toast, checkForUpdates } = useUi()
  const [composerOpen, setComposerOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)
  const previousUnread = useRef(0)

  const loadUnread = useCallback(async () => {
    try {
      const { count } = await api.notifications.unreadCount()
      if (
        count > previousUnread.current &&
        settings.desktopNotifications &&
        !document.hasFocus()
      ) {
        void bridge.system.notify({
          title: "SocialApp",
          body: count === 1 ? "You have a new notification" : `You have ${count} new notifications`,
        })
      }
      previousUnread.current = count
      setUnread(count)
      void bridge.system.setBadge(count)
    } catch {
      // Notification polling must never interrupt the UI.
    }
  }, [settings.desktopNotifications])

  useEffect(() => {
    void loadUnread()
    const timer = window.setInterval(() => void loadUnread(), 45_000)
    return () => window.clearInterval(timer)
  }, [loadUnread])

  const refresh = useCallback(() => setRefreshTick((tick) => tick + 1), [])

  useKeyboardShortcuts({
    onCompose: () => setComposerOpen(true),
    onSearch: () => navigate(routes.search("")),
    onRefresh: refresh,
    onToggleShortcuts: () => setShortcutsOpen(!shortcutsOpen),
  })

  // Native menu actions (File / Go / View / Help).
  useEffect(
    () =>
      bridge.menu.onAction((action) => {
        if (action === "compose") setComposerOpen(true)
        else if (action === "refresh") refresh()
        else if (action === "search") navigate(routes.search(""))
        else if (action === "shortcuts") setShortcutsOpen(true)
        else if (action === "check-updates") void checkForUpdates()
        else if (action.startsWith("navigate:")) navigate(action.slice("navigate:".length))
      }),
    [checkForUpdates, navigate, refresh, setShortcutsOpen],
  )

  useEffect(() => {
    if (settings.autoCheckUpdates) void bridge.updates.check()
  }, [settings.autoCheckUpdates])

  return (
    <>
      <AppShell unread={unread} onCompose={() => setComposerOpen(true)}>
        <OfflineBanner />
        <UpdateBanner />
        <RouteView key={`${path}#${refreshTick}`} route={route} onSeen={loadUnread} />
      </AppShell>

      {composerOpen ? (
        <Modal title="New post" onClose={() => setComposerOpen(false)}>
          <Composer
            autoFocus
            onPosted={(post) => {
              setComposerOpen(false)
              toast("Post published", "success")
              if (route.name === "home") refresh()
              else navigate(routes.post(post.id))
            }}
            onCancel={() => setComposerOpen(false)}
          />
        </Modal>
      ) : null}

      {shortcutsOpen ? <ShortcutsDialog onClose={() => setShortcutsOpen(false)} /> : null}

      <Toasts />
    </>
  )
}

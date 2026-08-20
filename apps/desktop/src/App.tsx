import { useCallback, useEffect, useRef, useState } from "react"

import { bridge } from "@/api/bridge"
import { api } from "@/api/client"
import { AppShell } from "@/components/AppShell"
import { OfflineBanner, UpdateBanner } from "@/components/Banners"
import { Composer } from "@/components/Composer"
import { Icon } from "@/components/Icon"
import { Modal } from "@/components/Modal"
import { ShortcutsDialog } from "@/components/ShortcutsDialog"
import { Spinner } from "@/components/States"
import { Toasts } from "@/components/Toasts"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { routes, useRouter, type Route } from "@/router"
import { AuthScreen } from "@/routes/AuthScreen"
import { BookmarksRoute } from "@/routes/BookmarksRoute"
import { ConversationRoute } from "@/routes/ConversationRoute"
import { ExploreRoute } from "@/routes/ExploreRoute"
import { HashtagRoute } from "@/routes/HashtagRoute"
import { HomeRoute } from "@/routes/HomeRoute"
import { MessagesRoute } from "@/routes/MessagesRoute"
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
          <span className="sidebar__logo" style={{ width: 52, height: 52 }}>
            <Icon name="logo" size={28} />
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
    case "messages":
      return <MessagesRoute />
    case "conversation":
      return <ConversationRoute id={route.id} onRead={onSeen} />
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
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)
  const previousUnread = useRef(0)
  const previousMessages = useRef(0)

  const loadUnread = useCallback(async () => {
    try {
      const [notifications, messages] = await Promise.all([
        api.notifications.unreadCount(),
        // A server that predates direct messages must not break the badge.
        api.messages.unreadCount().catch(() => ({ count: 0 })),
      ])

      const notify = settings.desktopNotifications && !document.hasFocus()

      if (notifications.count > previousUnread.current && notify) {
        void bridge.system.notify({
          title: "SocialApp",
          body:
            notifications.count === 1
              ? "You have a new notification"
              : `You have ${notifications.count} new notifications`,
        })
      }

      if (messages.count > previousMessages.current && notify) {
        void bridge.system.notify({
          title: "SocialApp",
          body: messages.count === 1 ? "You have a new message" : "You have new messages",
        })
      }

      previousUnread.current = notifications.count
      previousMessages.current = messages.count
      setUnread(notifications.count)
      setUnreadMessages(messages.count)
      void bridge.system.setBadge(notifications.count + messages.count)
    } catch {
      // Polling must never interrupt the UI.
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
      <AppShell
        unread={unread}
        unreadMessages={unreadMessages}
        onCompose={() => setComposerOpen(true)}
      >
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

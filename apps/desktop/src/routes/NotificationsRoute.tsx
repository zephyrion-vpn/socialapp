import { formatRelativeTime, type NotificationItem } from "@socialapp/shared"
import { useEffect, useRef } from "react"

import { api } from "@/api/client"
import { Page, Topbar } from "@/components/AppShell"
import { Avatar } from "@/components/Avatar"
import { Icon, type IconName } from "@/components/Icon"
import { UserRowSkeleton } from "@/components/Skeletons"
import { EmptyState, ErrorState } from "@/components/States"
import { usePaginated } from "@/hooks/usePaginated"
import { routes, useRouter } from "@/router"
import { useUi } from "@/store/ui"

/** Icon + colour per notification type, so the list is scannable at a glance. */
const COPY: Record<string, { icon: IconName; text: string; color: string }> = {
  LIKE: { icon: "heart-filled", text: "liked your post", color: "var(--like)" },
  REPLY: { icon: "reply", text: "replied to your post", color: "var(--accent)" },
  REPOST: { icon: "repeat", text: "reposted your post", color: "var(--repost)" },
  FOLLOW: { icon: "user", text: "started following you", color: "var(--accent)" },
  MENTION: { icon: "megaphone", text: "mentioned you", color: "var(--bookmark)" },
  QUOTE: { icon: "quote", text: "quoted your post", color: "var(--accent)" },
  SYSTEM: { icon: "info", text: "System notification", color: "var(--text-muted)" },
}

export function NotificationsRoute({ onSeen }: { onSeen: () => void }) {
  const { navigate } = useRouter()
  const { toastError } = useUi()
  const list = usePaginated<NotificationItem>(
    (cursor) => api.notifications.list({ cursor }),
    "notifications",
  )
  const marked = useRef(false)

  // Opening the tab is an implicit "I have seen these".
  useEffect(() => {
    if (marked.current || list.state !== "ready") return
    marked.current = true
    void api.notifications
      .markAllRead()
      .then(() => onSeen())
      .catch(() => undefined)
  }, [list.state, onSeen])

  async function markAllRead() {
    try {
      await api.notifications.markAllRead()
      list.setItems((items) => items.map((item) => ({ ...item, isRead: true })))
      onSeen()
    } catch (error) {
      toastError(error)
    }
  }

  return (
    <>
      <Topbar
        title="Notifications"
        actions={
          <button
            type="button"
            className="button"
            data-variant="ghost"
            data-size="sm"
            onClick={() => void markAllRead()}
          >
            <Icon name="check" size={15} />
            Mark all read
          </button>
        }
      />

      <Page>
        {list.state === "loading" ? (
          <>
            <UserRowSkeleton />
            <UserRowSkeleton />
            <UserRowSkeleton />
          </>
        ) : list.state === "error" && list.items.length === 0 ? (
          <ErrorState error={list.error} onRetry={() => void list.refresh()} />
        ) : list.items.length === 0 ? (
          <EmptyState
            icon={<Icon name="bell" size={26} />}
            title="No notifications yet"
            body="Likes, replies, reposts and new followers will show up here."
          />
        ) : (
          <div>
            {list.items.map((item) => {
              const copy = COPY[item.type] ?? COPY.SYSTEM
              const actor = item.actor
              return (
                <div
                  key={item.id}
                  className="post"
                  data-clickable="true"
                  style={{
                    gridTemplateColumns: "28px 44px minmax(0, 1fr)",
                    background: item.isRead ? undefined : "var(--accent-soft)",
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (item.post) navigate(routes.post(item.post.id))
                    else if (actor) navigate(routes.profile(actor.username))
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return
                    if (item.post) navigate(routes.post(item.post.id))
                    else if (actor) navigate(routes.profile(actor.username))
                  }}
                >
                  <div style={{ display: "grid", placeItems: "center", width: 28, height: 28 }}>
                    <Icon name={copy.icon} size={18} style={{ color: copy.color }} />
                  </div>
                  {actor ? <Avatar user={actor} /> : <div />}
                  <div style={{ minWidth: 0 }}>
                    <div>
                      <strong>{actor ? actor.displayName : "SocialApp"}</strong>{" "}
                      <span className="muted">{copy.text}</span>{" "}
                      <span className="post__meta">{formatRelativeTime(item.createdAt)}</span>
                    </div>
                    {item.post ? (
                      <div className="muted truncate" style={{ marginTop: 2 }}>
                        {item.post.content}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}

            {list.hasMore ? (
              <div className="load-more">
                <button
                  type="button"
                  className="button"
                  data-variant="secondary"
                  data-size="sm"
                  onClick={list.loadMore}
                >
                  Load more
                </button>
              </div>
            ) : null}
          </div>
        )}
      </Page>
    </>
  )
}

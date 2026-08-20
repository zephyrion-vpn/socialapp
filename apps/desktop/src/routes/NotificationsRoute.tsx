import { formatRelativeTime, type NotificationItem } from "@socialapp/shared"
import { useEffect, useRef } from "react"

import { api } from "@/api/client"
import { Page, Topbar } from "@/components/AppShell"
import { Avatar } from "@/components/Avatar"
import { UserRowSkeleton } from "@/components/Skeletons"
import { EmptyState, ErrorState } from "@/components/States"
import { usePaginated } from "@/hooks/usePaginated"
import { routes, useRouter } from "@/router"
import { useUi } from "@/store/ui"

const COPY: Record<string, { icon: string; text: string }> = {
  LIKE: { icon: "\u2764\uFE0F", text: "liked your post" },
  REPLY: { icon: "\uD83D\uDCAC", text: "replied to your post" },
  REPOST: { icon: "\uD83D\uDD01", text: "reposted your post" },
  FOLLOW: { icon: "\uD83D\uDC64", text: "started following you" },
  MENTION: { icon: "\uD83D\uDCE3", text: "mentioned you" },
  QUOTE: { icon: "\uD83D\uDCCE", text: "quoted your post" },
  SYSTEM: { icon: "\u2699\uFE0F", text: "System notification" },
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
            icon={"\uD83D\uDD14"}
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
                  <div style={{ fontSize: 18 }}>{copy.icon}</div>
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

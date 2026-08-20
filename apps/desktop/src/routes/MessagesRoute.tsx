import { formatRelativeTime, type Conversation } from "@socialapp/shared"
import { useState } from "react"

import { api } from "@/api/client"
import { Page, Topbar } from "@/components/AppShell"
import { Avatar } from "@/components/Avatar"
import { Icon } from "@/components/Icon"
import { Modal } from "@/components/Modal"
import { UserRowSkeleton } from "@/components/Skeletons"
import { EmptyState, ErrorState, Spinner } from "@/components/States"
import { usePaginated } from "@/hooks/usePaginated"
import { routes, useRouter } from "@/router"
import { useUi } from "@/store/ui"

export function MessagesRoute() {
  const { navigate } = useRouter()
  const { toastError } = useUi()
  const list = usePaginated<Conversation>(
    (cursor) => api.messages.conversations({ cursor }),
    "conversations",
  )

  const [composeOpen, setComposeOpen] = useState(false)
  const [handle, setHandle] = useState("")
  const [starting, setStarting] = useState(false)

  async function startConversation() {
    const username = handle.trim().replace(/^@/, "").toLowerCase()
    if (!username || starting) return

    setStarting(true)
    try {
      const { conversation } = await api.messages.start(username)
      setComposeOpen(false)
      setHandle("")
      navigate(routes.conversation(conversation.id))
    } catch (error) {
      toastError(error, "Could not open that conversation")
    } finally {
      setStarting(false)
    }
  }

  return (
    <>
      <Topbar
        title="Messages"
        actions={
          <button
            type="button"
            className="button"
            data-size="sm"
            onClick={() => setComposeOpen(true)}
          >
            <Icon name="pen" size={15} />
            New message
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
            icon={<Icon name="message-circle" size={26} />}
            title="No conversations yet"
            body="Direct messages are private. Start one with anybody - and if they reply, the two of you can talk as fast as you like."
            action={
              <button type="button" className="button" onClick={() => setComposeOpen(true)}>
                <Icon name="pen" size={16} />
                New message
              </button>
            }
          />
        ) : (
          <div>
            {list.items.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className="dm-row"
                data-unread={conversation.unreadCount > 0}
                onClick={() => navigate(routes.conversation(conversation.id))}
              >
                <Avatar user={conversation.participant} />
                <div className="dm-row__body">
                  <div className="dm-row__top">
                    <span className="dm-row__name">{conversation.participant.displayName}</span>
                    <span className="post__meta">@{conversation.participant.username}</span>
                    <span className="dm-row__time">
                      {conversation.lastMessageAt
                        ? formatRelativeTime(conversation.lastMessageAt)
                        : ""}
                    </span>
                  </div>
                  <div className="dm-row__preview">
                    {conversation.lastMessageFromMe ? <Icon name="reply" size={14} /> : null}
                    <span className="grow">
                      {conversation.lastMessagePreview ?? "No messages yet"}
                    </span>
                    {conversation.unreadCount > 0 ? (
                      <span className="dm-badge">
                        {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}

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

      {composeOpen ? (
        <Modal title="New message" width={420} onClose={() => setComposeOpen(false)}>
          <div className="col" style={{ gap: 12 }}>
            <label className="field">
              <span className="field__label">Username</span>
              <input
                className="input"
                autoFocus
                spellCheck={false}
                placeholder="username"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void startConversation()
                  }
                }}
              />
            </label>
            <p className="muted">
              Opening a thread is free. Sending to somebody who has never replied to you is what the
              anti spam limits apply to.
            </p>
            <div className="row">
              <button
                type="button"
                className="button"
                disabled={starting || handle.trim().length === 0}
                onClick={() => void startConversation()}
              >
                {starting ? <Spinner /> : "Open conversation"}
              </button>
              <button
                type="button"
                className="button"
                data-variant="ghost"
                onClick={() => setComposeOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  )
}

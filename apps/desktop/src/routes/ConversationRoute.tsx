import {
  MAX_MESSAGE_LENGTH,
  formatRelativeTime,
  type Conversation,
  type DirectMessage,
} from "@socialapp/shared"
import { Fragment, useCallback, useEffect, useRef, useState } from "react"

import { api } from "@/api/client"
import { Page, Topbar } from "@/components/AppShell"
import { Icon } from "@/components/Icon"
import { CenteredSpinner, ErrorState } from "@/components/States"
import { useAsync } from "@/hooks/useAsync"
import { usePaginated } from "@/hooks/usePaginated"
import { routes, useRouter } from "@/router"
import { useUi } from "@/store/ui"

interface Props {
  id: string
  /** Lets the shell refresh the unread badge after the thread is read. */
  onRead: () => void
}

interface LimitNotice {
  message: string
  retryAfterSeconds: number | null
}

/**
 * Reads a spam limit out of a failed send.
 *
 * Deliberately duck typed instead of `error instanceof ApiError`: the api
 * client is consumed as a CommonJS build while the renderer is ESM, so the
 * class identity cannot be relied on (the same trap that turned validation
 * errors into 500s on the server - see isZodError there).
 */
function limitNoticeFrom(error: unknown): LimitNotice | null {
  const candidate = error as
    | { status?: number; message?: string; details?: { retryAfterSeconds?: number } }
    | null
    | undefined

  if (!candidate || typeof candidate !== "object" || candidate.status !== 429) return null

  const retryAfterSeconds = candidate.details?.retryAfterSeconds
  return {
    message: candidate.message ?? "You are sending messages too quickly.",
    retryAfterSeconds: typeof retryAfterSeconds === "number" ? retryAfterSeconds : null,
  }
}

function dayLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return date.toLocaleDateString([], { day: "numeric", month: "long" })
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function ConversationRoute({ id, onRead }: Props) {
  const { navigate } = useRouter()
  const { toastError } = useUi()

  const conversation = useAsync<{ conversation: Conversation }>(
    () => api.messages.conversation(id),
    `conversation:${id}`,
  )
  const list = usePaginated<DirectMessage>(
    (cursor) => api.messages.list(id, { cursor }),
    `messages:${id}`,
  )

  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<LimitNotice | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)

  const { setItems } = list
  const newestId = list.items[0]?.id
  const participant = conversation.data?.conversation.participant

  // Poll for incoming messages. Cheap: one page, only new ids are merged.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void api.messages
        .list(id, {})
        .then((page) => {
          setItems((current) => {
            const known = new Set(current.map((item) => item.id))
            const fresh = page.items.filter((item) => !known.has(item.id))
            return fresh.length > 0 ? [...fresh, ...current] : current
          })
        })
        .catch(() => undefined)
    }, 12_000)

    return () => window.clearInterval(timer)
  }, [id, setItems])

  // Reading the thread clears the unread counter on the server.
  useEffect(() => {
    if (!newestId) return
    void api.messages
      .markRead(id)
      .then(() => onRead())
      .catch(() => undefined)
  }, [id, newestId, onRead])

  useEffect(() => {
    const node = threadRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [newestId])

  // Clear the notice automatically once the server said the wait is over.
  useEffect(() => {
    if (!notice?.retryAfterSeconds) return
    const wait = Math.min(notice.retryAfterSeconds, 60) * 1000
    const timer = window.setTimeout(() => setNotice(null), wait)
    return () => window.clearTimeout(timer)
  }, [notice])

  const send = useCallback(async () => {
    const content = draft.trim()
    if (!content || sending || content.length > MAX_MESSAGE_LENGTH) return

    setSending(true)
    try {
      const { message } = await api.messages.send(id, content)
      setDraft("")
      setNotice(null)
      setItems((current) => [message, ...current.filter((item) => item.id !== message.id)])
    } catch (error) {
      const limit = limitNoticeFrom(error)
      if (limit) setNotice(limit)
      else toastError(error, "Could not send that message")
    } finally {
      setSending(false)
    }
  }, [draft, id, sending, setItems, toastError])

  async function removeMessage(messageId: string) {
    try {
      await api.messages.remove(messageId)
      setItems((current) =>
        current.map((item) =>
          item.id === messageId ? { ...item, isDeleted: true, content: "" } : item,
        ),
      )
    } catch (error) {
      toastError(error)
    }
  }

  if (conversation.error && !conversation.data) {
    return (
      <>
        <Topbar title="Conversation" showBack />
        <Page>
          <ErrorState error={conversation.error} onRetry={() => void conversation.reload()} />
        </Page>
      </>
    )
  }

  // Newest first from the API - the thread renders oldest at the top.
  const ordered = [...list.items].reverse()
  const remaining = MAX_MESSAGE_LENGTH - draft.length

  return (
    <>
      <Topbar
        showBack
        title={participant?.displayName ?? "Conversation"}
        subtitle={participant ? `@${participant.username}` : undefined}
        actions={
          participant ? (
            <button
              type="button"
              className="button"
              data-variant="secondary"
              data-size="sm"
              onClick={() => navigate(routes.profile(participant.username))}
            >
              View profile
            </button>
          ) : undefined
        }
      />

      <div className="dm-thread" ref={threadRef}>
        <div className="dm-thread__spacer" />

        {list.hasMore ? (
          <div className="load-more">
            <button
              type="button"
              className="button"
              data-variant="secondary"
              data-size="sm"
              onClick={list.loadMore}
            >
              Load older messages
            </button>
          </div>
        ) : null}

        {list.state === "loading" ? <CenteredSpinner /> : null}

        {list.state !== "loading" && ordered.length === 0 ? (
          <div className="state">
            <div className="state__icon">
              <Icon name="send" size={26} />
            </div>
            <div className="state__title">Say hello</div>
            <p>
              {participant
                ? `This is the start of your conversation with @${participant.username}.`
                : "This is the start of your conversation."}
            </p>
          </div>
        ) : null}

        {ordered.map((message, index) => {
          const previous = index > 0 ? ordered[index - 1] : null
          const newDay =
            !previous ||
            new Date(previous.createdAt).toDateString() !==
              new Date(message.createdAt).toDateString()
          const grouped =
            !newDay &&
            previous !== null &&
            previous.isMine === message.isMine &&
            new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() <
              5 * 60_000

          return (
            <Fragment key={message.id}>
              {newDay ? <div className="dm-day">{dayLabel(message.createdAt)}</div> : null}

              <div className="dm-message" data-mine={message.isMine} data-grouped={grouped}>
                <div
                  className="dm-bubble"
                  data-deleted={message.isDeleted}
                  title={new Date(message.createdAt).toLocaleString()}
                  data-selectable
                >
                  {message.isDeleted ? "Message deleted" : message.content}
                </div>

                <div className="dm-message__meta">
                  <span>{timeLabel(message.createdAt)}</span>
                  {message.isMine && message.readAt ? (
                    <Icon name="check" size={13} label="Read" />
                  ) : null}
                  {message.isMine && !message.isDeleted ? (
                    <button
                      type="button"
                      className="dm-message__delete"
                      title="Delete message"
                      onClick={() => void removeMessage(message.id)}
                    >
                      <Icon name="trash" size={13} label="Delete message" />
                    </button>
                  ) : null}
                </div>
              </div>
            </Fragment>
          )
        })}
      </div>

      {notice ? (
        <div className="dm-notice" role="status">
          <Icon name="shield" size={17} />
          <span className="grow">
            {notice.message}
            {notice.retryAfterSeconds && notice.retryAfterSeconds > 0 ? (
              <>
                {" "}
                <span className="muted">
                  {`Retry in ${formatRelativeTime(
                    new Date(Date.now() + notice.retryAfterSeconds * 1000).toISOString(),
                  )}.`}
                </span>
              </>
            ) : null}
          </span>
          <button
            type="button"
            className="icon-button"
            style={{ width: 24, height: 24 }}
            aria-label="Dismiss"
            onClick={() => setNotice(null)}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ) : null}

      <form
        className="dm-composer"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <textarea
          className="dm-composer__input"
          value={draft}
          rows={1}
          placeholder="Write a message"
          maxLength={MAX_MESSAGE_LENGTH + 40}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter adds a line - the desktop convention.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
        />

        {remaining <= 200 ? (
          <span
            className="dm-composer__counter"
            data-warn={remaining <= 200 && remaining >= 0}
            data-over={remaining < 0}
          >
            {remaining}
          </span>
        ) : null}

        <button
          type="submit"
          className="dm-send"
          disabled={sending || draft.trim().length === 0 || remaining < 0}
          title="Send (Enter)"
        >
          <Icon name="send" size={19} label="Send" />
        </button>
      </form>
    </>
  )
}

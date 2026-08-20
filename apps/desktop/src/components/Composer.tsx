import {
  MAX_MEDIA_PER_POST,
  MAX_POST_LENGTH,
  type Post,
  type UploadedMedia,
} from "@socialapp/shared"
import { useRef, useState } from "react"

import { api } from "@/api/client"
import { Avatar } from "@/components/Avatar"
import { Icon } from "@/components/Icon"
import { Spinner } from "@/components/States"
import { useSession } from "@/store/session"
import { useUi } from "@/store/ui"

interface Props {
  parent?: Post
  autoFocus?: boolean
  placeholder?: string
  onPosted: (post: Post) => void
  onCancel?: () => void
}

export function Composer({ parent, autoFocus, placeholder, onPosted, onCancel }: Props) {
  const { user } = useSession()
  const { toastError, toast } = useUi()
  const [content, setContent] = useState("")
  const [media, setMedia] = useState<UploadedMedia[]>([])
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)

  if (!user) return null

  const remaining = MAX_POST_LENGTH - content.length
  const canSubmit =
    !sending && !uploading && remaining >= 0 && (content.trim().length > 0 || media.length > 0)

  async function submit() {
    if (!canSubmit) return
    setSending(true)
    try {
      const { post } = await api.posts.create({
        content: content.trim(),
        parentId: parent?.id ?? null,
        media: media.map((item) => ({ key: item.key })),
      })
      setContent("")
      setMedia([])
      onPosted(post)
    } catch (error) {
      toastError(error)
    } finally {
      setSending(false)
    }
  }

  async function attach(files: FileList | null) {
    if (!files || files.length === 0) return
    const room = MAX_MEDIA_PER_POST - media.length
    if (room <= 0) {
      toast(`Up to ${MAX_MEDIA_PER_POST} images per post`, "error")
      return
    }

    setUploading(true)
    try {
      for (const file of Array.from(files).slice(0, room)) {
        const uploaded = await api.media.upload(file, {
          fileName: file.name,
          purpose: "post",
        })
        setMedia((current) => [...current, uploaded])
      }
    } catch (error) {
      toastError(error)
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  return (
    <div className="composer">
      <Avatar user={user} />
      <div>
        <textarea
          className="composer__input"
          value={content}
          autoFocus={autoFocus}
          placeholder={placeholder ?? (parent ? "Post your reply" : "What is happening?")}
          maxLength={MAX_POST_LENGTH + 40}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault()
              void submit()
            }
          }}
        />

        {media.length > 0 ? (
          <div className="composer__previews">
            {media.map((item) => (
              <div key={item.key} className="composer__preview">
                <img src={item.url} alt="" />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => setMedia((current) => current.filter((m) => m.key !== item.key))}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="composer__footer">
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            hidden
            onChange={(event) => void attach(event.target.files)}
          />
          <button
            type="button"
            className="icon-button"
            title="Add images"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? <Spinner /> : <Icon name="image" size={19} label="Add images" />}
          </button>

          <span
            className="composer__counter"
            data-warn={remaining <= 40 && remaining >= 0}
            data-over={remaining < 0}
          >
            {remaining}
          </span>

          {onCancel ? (
            <button
              type="button"
              className="button"
              data-variant="ghost"
              data-size="sm"
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : null}

          <button
            type="button"
            className="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {sending ? "Posting\u2026" : parent ? "Reply" : "Post"}
          </button>
        </div>
      </div>
    </div>
  )
}

import type { PublicUser } from "@socialapp/shared"
import { useRef, useState } from "react"

import { api } from "@/api/client"
import { Modal } from "@/components/Modal"
import { Spinner } from "@/components/States"
import { humanizeError, useUi } from "@/store/ui"

interface Props {
  user: PublicUser
  onClose: () => void
  onSaved: (user: PublicUser) => void
}

export function EditProfileDialog({ user, onClose, onSaved }: Props) {
  const { toast } = useUi()
  const [displayName, setDisplayName] = useState(user.displayName)
  const [bio, setBio] = useState(user.bio ?? "")
  const [location, setLocation] = useState(user.location ?? "")
  const [website, setWebsite] = useState(user.website ?? "")
  const [avatarKey, setAvatarKey] = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [bannerKey, setBannerKey] = useState<string | null>(null)
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const avatarInput = useRef<HTMLInputElement | null>(null)
  const bannerInput = useRef<HTMLInputElement | null>(null)

  async function upload(file: File, purpose: "avatar" | "banner") {
    setUploading(purpose)
    setError(null)
    try {
      const uploaded = await api.media.upload(file, { fileName: file.name, purpose })
      if (purpose === "avatar") {
        setAvatarKey(uploaded.key)
        setAvatarPreview(uploaded.url)
      } else {
        setBannerKey(uploaded.key)
      }
      toast("Image uploaded", "success")
    } catch (caught) {
      setError(humanizeError(caught))
    } finally {
      setUploading(null)
    }
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const { user: updated } = await api.users.updateMe({
        displayName: displayName.trim() || undefined,
        bio: bio.trim() ? bio.trim() : null,
        location: location.trim() ? location.trim() : null,
        website: website.trim() ? website.trim() : null,
        ...(avatarKey ? { avatarKey } : {}),
        ...(bannerKey ? { bannerKey } : {}),
      })
      onSaved(updated)
      toast("Profile updated", "success")
    } catch (caught) {
      setError(humanizeError(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <div className="col" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="avatar" data-size="lg" style={{ width: 72, height: 72 }}>
            {avatarPreview ?? user.avatarUrl ? (
              <img src={avatarPreview ?? user.avatarUrl ?? ""} alt="" />
            ) : (
              <span>{user.displayName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="col" style={{ gap: 6 }}>
            <input
              ref={avatarInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload(file, "avatar")
              }}
            />
            <input
              ref={bannerInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload(file, "banner")
              }}
            />
            <button
              type="button"
              className="button"
              data-variant="secondary"
              data-size="sm"
              disabled={uploading !== null}
              onClick={() => avatarInput.current?.click()}
            >
              {uploading === "avatar" ? <Spinner /> : "Change avatar"}
            </button>
            <button
              type="button"
              className="button"
              data-variant="secondary"
              data-size="sm"
              disabled={uploading !== null}
              onClick={() => bannerInput.current?.click()}
            >
              {uploading === "banner" ? <Spinner /> : bannerKey ? "Banner selected" : "Change banner"}
            </button>
          </div>
        </div>

        <label className="field">
          <span className="field__label">Display name</span>
          <input
            className="input"
            value={displayName}
            maxLength={50}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Bio</span>
          <textarea
            className="textarea"
            value={bio}
            maxLength={280}
            onChange={(event) => setBio(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Location</span>
          <input
            className="input"
            value={location}
            maxLength={64}
            onChange={(event) => setLocation(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Website</span>
          <input
            className="input"
            value={website}
            placeholder="https://example.com"
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>

        {error ? <div className="field__error">{error}</div> : null}

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="button" data-variant="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving\u2026" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

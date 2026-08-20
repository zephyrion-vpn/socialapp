import type { PublicUser } from "@socialapp/shared"
import { useState } from "react"

import { api } from "@/api/client"
import { useUi } from "@/store/ui"

interface Props {
  user: PublicUser
  onChange?: (user: PublicUser) => void
  size?: "sm" | "md"
}

export function FollowButton({ user, onChange, size = "sm" }: Props) {
  const { toastError } = useUi()
  const [busy, setBusy] = useState(false)
  const [hover, setHover] = useState(false)

  if (user.isSelf) return null

  const following = Boolean(user.isFollowing)

  async function toggle() {
    if (busy) return
    setBusy(true)
    try {
      const result = following
        ? await api.users.unfollow(user.username)
        : await api.users.follow(user.username)
      onChange?.({
        ...user,
        isFollowing: result.following,
        followersCount: result.followersCount,
      })
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="button"
      data-variant={following ? "secondary" : undefined}
      data-size={size}
      disabled={busy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(event) => {
        event.stopPropagation()
        void toggle()
      }}
    >
      {following ? (hover ? "Unfollow" : "Following") : "Follow"}
    </button>
  )
}

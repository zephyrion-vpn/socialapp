import { initialsOf } from "@socialapp/shared"
import type { PublicUser } from "@socialapp/shared"

type AvatarUser = Pick<PublicUser, "username" | "displayName" | "avatarUrl">

interface Props {
  user: AvatarUser
  size?: "sm" | "md" | "lg"
  onClick?: () => void
}

export function Avatar({ user, size = "md", onClick }: Props) {
  const label = user.displayName || user.username
  const content = user.avatarUrl ? (
    <img src={user.avatarUrl} alt="" draggable={false} />
  ) : (
    <span>{initialsOf(label)}</span>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className="avatar"
        data-size={size}
        title={`@${user.username}`}
        onClick={(event) => {
          event.stopPropagation()
          onClick()
        }}
      >
        {content}
      </button>
    )
  }

  return (
    <div className="avatar" data-size={size} title={`@${user.username}`}>
      {content}
    </div>
  )
}

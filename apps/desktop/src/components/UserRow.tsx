import { formatCount, type PublicUser } from "@socialapp/shared"

import { Avatar } from "@/components/Avatar"
import { FollowButton } from "@/components/FollowButton"
import { routes, useRouter } from "@/router"

interface Props {
  user: PublicUser
  onChange?: (user: PublicUser) => void
  showBio?: boolean
}

export function UserRow({ user, onChange, showBio = false }: Props) {
  const { navigate } = useRouter()

  return (
    <div
      className="card__row"
      role="button"
      tabIndex={0}
      onClick={() => navigate(routes.profile(user.username))}
      onKeyDown={(event) => {
        if (event.key === "Enter") navigate(routes.profile(user.username))
      }}
    >
      <Avatar user={user} size="sm" />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="truncate" style={{ fontWeight: 620 }}>
          {user.displayName}
        </div>
        <div className="muted truncate">
          @{user.username}
          {showBio ? "" : ` \u00B7 ${formatCount(user.followersCount)} followers`}
        </div>
        {showBio && user.bio ? (
          <div className="truncate" style={{ fontSize: 13, marginTop: 2 }}>
            {user.bio}
          </div>
        ) : null}
      </div>
      <FollowButton user={user} onChange={onChange} />
    </div>
  )
}

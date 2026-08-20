import { formatCount, type Post, type PublicUser } from "@socialapp/shared"
import { useState } from "react"

import { bridge } from "@/api/bridge"
import { api } from "@/api/client"
import { Page, Topbar } from "@/components/AppShell"
import { Avatar } from "@/components/Avatar"
import { FollowButton } from "@/components/FollowButton"
import { PostList } from "@/components/PostList"
import { ProfileSkeleton } from "@/components/Skeletons"
import { ErrorState } from "@/components/States"
import { EditProfileDialog } from "@/routes/EditProfileDialog"
import { useAsync } from "@/hooks/useAsync"
import { usePaginated } from "@/hooks/usePaginated"
import { routes, useRouter } from "@/router"
import { useSession } from "@/store/session"
import { useUi } from "@/store/ui"

type Tab = "posts" | "replies" | "media" | "likes"

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "posts", label: "Posts" },
  { id: "replies", label: "Replies" },
  { id: "media", label: "Media" },
  { id: "likes", label: "Likes" },
]

export function ProfileRoute({ username, tab }: { username: string; tab: Tab }) {
  const { navigate } = useRouter()
  const { user: me, patchUser } = useSession()
  const { toast, toastError } = useUi()
  const [editing, setEditing] = useState(false)

  const profile = useAsync<{ user: PublicUser }>(
    () => api.users.byUsername(username),
    `profile:${username}`,
  )

  const timeline = usePaginated<Post>(
    (cursor) => {
      if (tab === "replies") return api.users.replies(username, { cursor })
      if (tab === "media") return api.users.media(username, { cursor })
      if (tab === "likes") return api.users.likes(username, { cursor })
      return api.users.posts(username, { cursor })
    },
    `timeline:${username}:${tab}`,
  )

  const user = profile.data?.user ?? null
  const isSelf = Boolean(user && me && user.id === me.id)

  async function toggleMute() {
    if (!user) return
    try {
      const result = user.isMuted
        ? await api.users.unmute(user.username)
        : await api.users.mute(user.username)
      profile.setData({ user: { ...user, isMuted: result.muted } })
      toast(result.muted ? `Muted @${user.username}` : `Unmuted @${user.username}`, "success")
    } catch (error) {
      toastError(error)
    }
  }

  async function toggleBlock() {
    if (!user) return
    try {
      const result = user.isBlocked
        ? await api.users.unblock(user.username)
        : await api.users.block(user.username)
      profile.setData({ user: { ...user, isBlocked: result.blocked, isFollowing: false } })
      toast(result.blocked ? `Blocked @${user.username}` : `Unblocked @${user.username}`, "success")
    } catch (error) {
      toastError(error)
    }
  }

  if (profile.loading && !user) {
    return (
      <>
        <Topbar showBack title={`@${username}`} />
        <Page>
          <ProfileSkeleton />
        </Page>
      </>
    )
  }

  if (!user) {
    return (
      <>
        <Topbar showBack title={`@${username}`} />
        <Page>
          <ErrorState
            error={profile.error}
            title="Profile unavailable"
            onRetry={() => void profile.reload()}
          />
        </Page>
      </>
    )
  }

  return (
    <>
      <Topbar
        showBack
        title={user.displayName}
        subtitle={`${formatCount(user.postsCount)} posts`}
      />

      <Page>
        <div
          className="profile__banner"
          style={user.bannerUrl ? { backgroundImage: `url(${user.bannerUrl})` } : undefined}
        />

        <div className="profile__head">
          <div className="profile__avatar-row">
            <Avatar user={user} size="lg" />
            <div className="row">
              {isSelf ? (
                <button
                  type="button"
                  className="button"
                  data-variant="secondary"
                  data-size="sm"
                  onClick={() => setEditing(true)}
                >
                  Edit profile
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="button"
                    data-variant="ghost"
                    data-size="sm"
                    onClick={() => void toggleMute()}
                  >
                    {user.isMuted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    type="button"
                    className="button"
                    data-variant="ghost"
                    data-size="sm"
                    onClick={() => void toggleBlock()}
                  >
                    {user.isBlocked ? "Unblock" : "Block"}
                  </button>
                  <FollowButton
                    user={user}
                    size="md"
                    onChange={(next) => profile.setData({ user: next })}
                  />
                </>
              )}
            </div>
          </div>

          <h2>{user.displayName}</h2>
          <div className="muted">@{user.username}</div>
          {user.bio ? (
            <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }} data-selectable>
              {user.bio}
            </p>
          ) : null}

          <div className="row muted" style={{ gap: 14, marginTop: 8, flexWrap: "wrap" }}>
            {user.location ? <span>{`\uD83D\uDCCD ${user.location}`}</span> : null}
            {user.website ? (
              <button
                type="button"
                className="link"
                onClick={() => void bridge.system.openExternal(user.website as string)}
              >
                {user.website.replace(/^https?:\/\//, "")}
              </button>
            ) : null}
            <span>{`Joined ${new Date(user.createdAt).toLocaleDateString()}`}</span>
          </div>

          <div className="profile__stats">
            <span className="profile__stat">
              <strong>{formatCount(user.followingCount)}</strong> <span className="muted">following</span>
            </span>
            <span className="profile__stat">
              <strong>{formatCount(user.followersCount)}</strong> <span className="muted">followers</span>
            </span>
            {user.isFollowedBy ? <span className="pill">Follows you</span> : null}
          </div>
        </div>

        <div className="tabs">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="tabs__item"
              data-active={tab === item.id}
              onClick={() => navigate(routes.profile(username, item.id), { replace: true })}
            >
              {item.label}
            </button>
          ))}
        </div>

        <PostList
          result={timeline}
          emptyIcon={"\uD83D\uDCDD"}
          emptyTitle={isSelf ? "You have not posted here yet" : "Nothing here yet"}
        />
      </Page>

      {editing ? (
        <EditProfileDialog
          user={user}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            profile.setData({ user: next })
            patchUser(next)
            setEditing(false)
          }}
        />
      ) : null}
    </>
  )
}

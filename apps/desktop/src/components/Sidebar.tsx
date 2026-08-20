import { Avatar } from "@/components/Avatar"
import { routes, useRouter } from "@/router"
import { useSession } from "@/store/session"

interface Props {
  unread: number
  onCompose: () => void
}

const NAV = [
  { icon: "\uD83C\uDFE0", label: "Home", path: routes.home(), match: "home" },
  { icon: "\uD83D\uDD0D", label: "Explore", path: routes.explore(), match: "explore" },
  { icon: "\uD83D\uDD14", label: "Notifications", path: routes.notifications(), match: "notifications" },
  { icon: "\uD83D\uDD16", label: "Bookmarks", path: routes.bookmarks(), match: "bookmarks" },
] as const

export function Sidebar({ unread, onCompose }: Props) {
  const { route, navigate } = useRouter()
  const { user, logout } = useSession()

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo">{"\uD83D\uDCAC"}</span>
        <span className="sidebar__brand-text">SocialApp</span>
      </div>

      <nav className="sidebar__nav">
        {NAV.map((item) => (
          <button
            key={item.match}
            type="button"
            className="sidebar__item"
            data-active={route.name === item.match}
            title={item.label}
            onClick={() => navigate(item.path)}
          >
            <span className="sidebar__icon">{item.icon}</span>
            <span className="sidebar__label">{item.label}</span>
            {item.match === "notifications" && unread > 0 ? (
              <span className="sidebar__badge">{unread > 99 ? "99+" : unread}</span>
            ) : null}
          </button>
        ))}

        <button
          type="button"
          className="sidebar__item"
          data-active={route.name === "profile" && route.username === user?.username}
          title="Profile"
          onClick={() => user && navigate(routes.profile(user.username))}
        >
          <span className="sidebar__icon">{"\uD83D\uDC64"}</span>
          <span className="sidebar__label">Profile</span>
        </button>

        <button
          type="button"
          className="sidebar__item"
          data-active={route.name === "settings"}
          title="Settings"
          onClick={() => navigate(routes.settings())}
        >
          <span className="sidebar__icon">{"\u2699\uFE0F"}</span>
          <span className="sidebar__label">Settings</span>
        </button>
      </nav>

      <button type="button" className="sidebar__compose" onClick={onCompose} title="New post (N)">
        {"\u270E"} <span>New post</span>
      </button>

      {user ? (
        <div className="sidebar__account">
          <Avatar user={user} size="sm" onClick={() => navigate(routes.profile(user.username))} />
          <div className="sidebar__account-meta grow">
            <div className="sidebar__account-name">{user.displayName}</div>
            <div className="sidebar__account-handle">@{user.username}</div>
          </div>
          <button
            type="button"
            className="icon-button"
            title="Log out"
            onClick={() => void logout()}
          >
            {"\u23CF"}
          </button>
        </div>
      ) : null}
    </aside>
  )
}

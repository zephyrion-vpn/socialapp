import { Avatar } from "@/components/Avatar"
import { Icon, type IconName } from "@/components/Icon"
import { routes, useRouter } from "@/router"
import { useSession } from "@/store/session"

interface Props {
  unread: number
  unreadMessages?: number
  onCompose: () => void
}

interface NavItem {
  icon: IconName
  /** Used while the item is selected - solid variants read better as active. */
  activeIcon?: IconName
  label: string
  path: string
  match: string
}

const NAV: NavItem[] = [
  { icon: "home", label: "Home", path: routes.home(), match: "home" },
  { icon: "compass", label: "Explore", path: routes.explore(), match: "explore" },
  { icon: "bell", label: "Notifications", path: routes.notifications(), match: "notifications" },
  { icon: "message-circle", label: "Messages", path: routes.messages(), match: "messages" },
  {
    icon: "bookmark",
    activeIcon: "bookmark-filled",
    label: "Bookmarks",
    path: routes.bookmarks(),
    match: "bookmarks",
  },
]

export function Sidebar({ unread, unreadMessages = 0, onCompose }: Props) {
  const { route, navigate } = useRouter()
  const { user, logout } = useSession()

  // A thread is still "Messages" as far as the sidebar is concerned.
  const isActive = (match: string): boolean =>
    route.name === match || (match === "messages" && route.name === "conversation")

  const badgeFor = (match: string): number => {
    if (match === "notifications") return unread
    if (match === "messages") return unreadMessages
    return 0
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo">
          <Icon name="logo" size={20} />
        </span>
        <span className="sidebar__brand-text">SocialApp</span>
      </div>

      <nav className="sidebar__nav">
        {NAV.map((item) => {
          const active = isActive(item.match)
          const badge = badgeFor(item.match)
          return (
            <button
              key={item.match}
              type="button"
              className="sidebar__item"
              data-active={active}
              title={item.label}
              onClick={() => navigate(item.path)}
            >
              <span className="sidebar__icon">
                <Icon
                  name={active && item.activeIcon ? item.activeIcon : item.icon}
                  size={21}
                  strokeWidth={active ? 2.1 : 1.75}
                />
              </span>
              <span className="sidebar__label">{item.label}</span>
              {badge > 0 ? (
                <span className="sidebar__badge">{badge > 99 ? "99+" : badge}</span>
              ) : null}
            </button>
          )
        })}

        <button
          type="button"
          className="sidebar__item"
          data-active={route.name === "profile" && route.username === user?.username}
          title="Profile"
          onClick={() => user && navigate(routes.profile(user.username))}
        >
          <span className="sidebar__icon">
            <Icon
              name="user"
              size={21}
              strokeWidth={
                route.name === "profile" && route.username === user?.username ? 2.1 : 1.75
              }
            />
          </span>
          <span className="sidebar__label">Profile</span>
        </button>

        <button
          type="button"
          className="sidebar__item"
          data-active={route.name === "settings"}
          title="Settings"
          onClick={() => navigate(routes.settings())}
        >
          <span className="sidebar__icon">
            <Icon name="settings" size={21} strokeWidth={route.name === "settings" ? 2.1 : 1.75} />
          </span>
          <span className="sidebar__label">Settings</span>
        </button>
      </nav>

      <button type="button" className="sidebar__compose" onClick={onCompose} title="New post (N)">
        <Icon name="pen" size={18} />
        <span>New post</span>
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
            <Icon name="log-out" size={18} label="Log out" />
          </button>
        </div>
      ) : null}
    </aside>
  )
}

import { formatCount, type PublicUser, type Trend } from "@socialapp/shared"
import { useState } from "react"

import { api } from "@/api/client"
import { Icon } from "@/components/Icon"
import { UserRowSkeleton } from "@/components/Skeletons"
import { UserRow } from "@/components/UserRow"
import { useAsync } from "@/hooks/useAsync"
import { routes, useRouter } from "@/router"

export function RightRail() {
  const { navigate } = useRouter()
  const [query, setQuery] = useState("")

  const trends = useAsync<{ trends: Trend[] }>(() => api.trends.list(8), "trends")
  const suggested = useAsync<{ users: PublicUser[] }>(() => api.users.suggested(4), "suggested")

  return (
    <aside className="right-rail">
      <form
        className="search-input"
        onSubmit={(event) => {
          event.preventDefault()
          if (query.trim()) navigate(routes.search(query.trim()))
        }}
      >
        <Icon name="search" size={17} />
        <input
          value={query}
          placeholder="Search SocialApp"
          aria-label="Search"
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>

      <section className="card">
        <h2 className="card__title">Trending</h2>
        {trends.loading ? (
          <div style={{ padding: "0 16px 14px" }}>
            <div className="skeleton" style={{ height: 12, width: "60%", marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 12, width: "45%", marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 12, width: "52%" }} />
          </div>
        ) : trends.data && trends.data.trends.length > 0 ? (
          trends.data.trends.map((trend) => (
            <button
              key={trend.tag}
              type="button"
              className="card__row"
              onClick={() => navigate(routes.hashtag(trend.tag))}
            >
              <div className="grow">
                <div style={{ fontWeight: 620 }}>#{trend.tag}</div>
                <div className="muted">{`${formatCount(trend.postCount)} posts`}</div>
              </div>
              <span className="pill">{`#${trend.rank}`}</span>
            </button>
          ))
        ) : (
          <p className="muted" style={{ padding: "0 16px 16px" }}>
            Nothing is trending yet. Post something with a #hashtag.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Who to follow</h2>
        {suggested.loading ? (
          <>
            <UserRowSkeleton />
            <UserRowSkeleton />
          </>
        ) : suggested.data && suggested.data.users.length > 0 ? (
          suggested.data.users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onChange={(next) =>
                suggested.setData({
                  users: (suggested.data?.users ?? []).map((item) =>
                    item.id === next.id ? next : item,
                  ),
                })
              }
            />
          ))
        ) : (
          <p className="muted" style={{ padding: "0 16px 16px" }}>
            No suggestions right now.
          </p>
        )}
      </section>

      <p className="muted" style={{ padding: "0 4px" }}>
        SocialApp desktop {"\u00B7"} connected over HTTPS
      </p>
    </aside>
  )
}

import { formatCount, type Post, type Trend } from "@socialapp/shared"
import { useState } from "react"

import { api } from "@/api/client"
import { Page, Topbar } from "@/components/AppShell"
import { PostList } from "@/components/PostList"
import { useAsync } from "@/hooks/useAsync"
import { usePaginated } from "@/hooks/usePaginated"
import { routes, useRouter } from "@/router"

export function ExploreRoute() {
  const { navigate } = useRouter()
  const [query, setQuery] = useState("")
  const trends = useAsync<{ trends: Trend[] }>(() => api.trends.list(12), "explore-trends")
  const popular = usePaginated<Post>(
    (cursor) => api.feed.get("popular", { cursor }),
    "explore-popular",
  )

  return (
    <>
      <Topbar title="Explore" subtitle="What people are talking about" />

      <Page>
        <div style={{ padding: 16 }}>
          <form
            className="search-input"
            onSubmit={(event) => {
              event.preventDefault()
              if (query.trim()) navigate(routes.search(query.trim()))
            }}
          >
            <span>{"\uD83D\uDD0D"}</span>
            <input
              value={query}
              placeholder="Search posts and people"
              aria-label="Search"
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
        </div>

        {trends.data && trends.data.trends.length > 0 ? (
          <div style={{ padding: "0 16px 16px" }}>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {trends.data.trends.map((trend) => (
                <button
                  key={trend.tag}
                  type="button"
                  className="button"
                  data-variant="secondary"
                  data-size="sm"
                  onClick={() => navigate(routes.hashtag(trend.tag))}
                >
                  #{trend.tag}
                  <span className="muted">{formatCount(trend.postCount)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card__title">Popular right now</div>
        <PostList
          result={popular}
          emptyIcon={"\uD83D\uDD0D"}
          emptyTitle="No popular posts yet"
          emptyBody="Popularity is computed from likes, reposts and replies in the last 48 hours."
        />
      </Page>
    </>
  )
}

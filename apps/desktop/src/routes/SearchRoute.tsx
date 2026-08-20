import type { Post, PublicUser } from "@socialapp/shared"
import { useEffect, useState } from "react"

import { api } from "@/api/client"
import { Page, Topbar } from "@/components/AppShell"
import { PostList } from "@/components/PostList"
import { UserRowSkeleton } from "@/components/Skeletons"
import { EmptyState, ErrorState } from "@/components/States"
import { UserRow } from "@/components/UserRow"
import { usePaginated } from "@/hooks/usePaginated"
import { routes, useRouter } from "@/router"

export function SearchRoute({ query }: { query: string }) {
  const { navigate } = useRouter()
  const [draft, setDraft] = useState(query)
  const [tab, setTab] = useState<"posts" | "people">("posts")

  useEffect(() => setDraft(query), [query])

  const posts = usePaginated<Post>(
    (cursor) => api.search.posts(query, { cursor }),
    `search-posts:${query}`,
  )
  const people = usePaginated<PublicUser>(
    (cursor) => api.search.users(query, { cursor }),
    `search-users:${query}`,
  )

  return (
    <>
      <Topbar
        showBack
        title={query ? `Results for "${query}"` : "Search"}
        actions={
          <form
            className="search-input"
            style={{ minWidth: 220 }}
            onSubmit={(event) => {
              event.preventDefault()
              if (draft.trim()) navigate(routes.search(draft.trim()), { replace: true })
            }}
          >
            <span>{"\uD83D\uDD0D"}</span>
            <input
              value={draft}
              autoFocus={!query}
              placeholder="Search"
              aria-label="Search"
              onChange={(event) => setDraft(event.target.value)}
            />
          </form>
        }
      />

      <div className="tabs">
        <button
          type="button"
          className="tabs__item"
          data-active={tab === "posts"}
          onClick={() => setTab("posts")}
        >
          Posts
        </button>
        <button
          type="button"
          className="tabs__item"
          data-active={tab === "people"}
          onClick={() => setTab("people")}
        >
          People
        </button>
      </div>

      <Page>
        {!query ? (
          <EmptyState
            icon={"\uD83D\uDD0D"}
            title="Search SocialApp"
            body="Find posts, hashtags and people. Press / anywhere to jump here."
          />
        ) : tab === "posts" ? (
          <PostList
            result={posts}
            emptyIcon={"\uD83D\uDD0E"}
            emptyTitle="No posts matched"
            emptyBody="Try a different word, or search for people instead."
          />
        ) : people.state === "loading" ? (
          <>
            <UserRowSkeleton />
            <UserRowSkeleton />
            <UserRowSkeleton />
          </>
        ) : people.state === "error" && people.items.length === 0 ? (
          <ErrorState error={people.error} onRetry={() => void people.refresh()} />
        ) : people.items.length === 0 ? (
          <EmptyState icon={"\uD83D\uDC64"} title="No people matched" />
        ) : (
          <div>
            {people.items.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                showBio
                onChange={(next) =>
                  people.setItems((items) =>
                    items.map((item) => (item.id === next.id ? next : item)),
                  )
                }
              />
            ))}
            {people.hasMore ? (
              <div className="load-more">
                <button
                  type="button"
                  className="button"
                  data-variant="secondary"
                  data-size="sm"
                  onClick={people.loadMore}
                >
                  Load more
                </button>
              </div>
            ) : null}
          </div>
        )}
      </Page>
    </>
  )
}

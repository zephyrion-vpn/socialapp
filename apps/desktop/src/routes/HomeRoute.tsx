import type { FeedType, Post } from "@socialapp/shared"
import { useState } from "react"

import { api } from "@/api/client"
import { Page, Topbar } from "@/components/AppShell"
import { Composer } from "@/components/Composer"
import { Icon } from "@/components/Icon"
import { PostList } from "@/components/PostList"
import { usePaginated } from "@/hooks/usePaginated"

const TABS: Array<{ id: FeedType; label: string }> = [
  { id: "home", label: "Following" },
  { id: "recommended", label: "For you" },
  { id: "popular", label: "Popular" },
  { id: "latest", label: "Latest" },
]

export function HomeRoute() {
  const [tab, setTab] = useState<FeedType>("home")
  const feed = usePaginated<Post>((cursor) => api.feed.get(tab, { cursor }), `feed:${tab}`)

  return (
    <>
      <Topbar
        title="Home"
        actions={
          <button
            type="button"
            className="icon-button"
            title="Refresh (R)"
            onClick={() => void feed.refresh()}
          >
            <Icon name="refresh" size={18} label="Refresh" />
          </button>
        }
      />

      <div className="tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="tabs__item"
            data-active={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Page>
        <Composer onPosted={(post) => feed.setItems((items) => [post, ...items])} />
        <PostList
          result={feed}
          emptyIcon={<Icon name="sprout" size={26} />}
          emptyTitle={tab === "home" ? "Your timeline is quiet" : "Nothing to show yet"}
          emptyBody={
            tab === "home"
              ? "Follow a few people, or switch to For you to discover posts."
              : "Be the first to post something."
          }
        />
      </Page>
    </>
  )
}

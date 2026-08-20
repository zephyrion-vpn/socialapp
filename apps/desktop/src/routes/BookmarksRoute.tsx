import type { Post } from "@socialapp/shared"

import { api } from "@/api/client"
import { Page, Topbar } from "@/components/AppShell"
import { PostList } from "@/components/PostList"
import { usePaginated } from "@/hooks/usePaginated"

export function BookmarksRoute() {
  const bookmarks = usePaginated<Post>(
    (cursor) => api.bookmarks.list({ cursor }),
    "bookmarks",
  )

  return (
    <>
      <Topbar title="Bookmarks" subtitle="Only you can see these" />
      <Page>
        <PostList
          result={bookmarks}
          emptyIcon={"\uD83D\uDD16"}
          emptyTitle="Nothing saved yet"
          emptyBody="Tap the bookmark icon on any post to keep it here."
        />
      </Page>
    </>
  )
}

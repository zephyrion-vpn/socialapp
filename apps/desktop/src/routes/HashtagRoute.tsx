import type { Post } from "@socialapp/shared"

import { api } from "@/api/client"
import { Page, Topbar } from "@/components/AppShell"
import { PostList } from "@/components/PostList"
import { usePaginated } from "@/hooks/usePaginated"

export function HashtagRoute({ tag }: { tag: string }) {
  const posts = usePaginated<Post>(
    (cursor) => api.trends.posts(tag, { cursor }),
    `hashtag:${tag}`,
  )

  return (
    <>
      <Topbar showBack title={`#${tag}`} subtitle="Hashtag" />
      <Page>
        <PostList
          result={posts}
          emptyIcon={"\uD83C\uDFF7\uFE0F"}
          emptyTitle="No posts with this hashtag"
        />
      </Page>
    </>
  )
}

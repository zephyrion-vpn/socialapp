import type { Post } from "@socialapp/shared"
import { useState } from "react"

import { api } from "@/api/client"
import { Page, Topbar } from "@/components/AppShell"
import { Composer } from "@/components/Composer"
import { PostCard } from "@/components/PostCard"
import { PostListSkeleton } from "@/components/Skeletons"
import { ErrorState } from "@/components/States"
import { useAsync } from "@/hooks/useAsync"
import { usePaginated } from "@/hooks/usePaginated"
import { routes, useRouter } from "@/router"

// Derived from the client rather than hand-written: the local copy declared
// `replies.nextCursor?: string` while the API contract (shared Page<T>) is
// `string | null`, which is exactly how the two drifted apart.
type ThreadResponse = Awaited<ReturnType<typeof api.posts.thread>>

export function PostRoute({ id }: { id: string }) {
  const { navigate } = useRouter()
  const thread = useAsync<ThreadResponse>(() => api.posts.thread(id), `thread:${id}`)
  const replies = usePaginated<Post>(
    (cursor) => api.posts.replies(id, { cursor }),
    `replies:${id}`,
  )
  const [detail, setDetail] = useState<Post | null>(null)

  const post = detail ?? thread.data?.post ?? null

  return (
    <>
      <Topbar showBack title="Post" subtitle={post ? `@${post.author.username}` : undefined} />

      <Page>
        {thread.loading && !post ? (
          <PostListSkeleton count={3} />
        ) : thread.error && !post ? (
          <ErrorState error={thread.error} onRetry={() => void thread.reload()} />
        ) : post ? (
          <>
            {(thread.data?.ancestors ?? []).map((ancestor) => (
              <PostCard
                key={ancestor.id}
                post={ancestor}
                onChange={() => undefined}
                onDeleted={() => void thread.reload()}
              />
            ))}

            <PostCard
              post={post}
              variant="detail"
              onChange={setDetail}
              onDeleted={() => navigate(routes.home())}
            />

            <Composer
              parent={post}
              placeholder={`Reply to @${post.author.username}`}
              onPosted={(reply) => {
                replies.setItems((items) => [reply, ...items])
                setDetail({ ...post, replyCount: post.replyCount + 1 })
              }}
            />

            {replies.state === "loading" ? (
              <PostListSkeleton count={2} />
            ) : replies.items.length === 0 ? (
              <div className="load-more muted">No replies yet</div>
            ) : (
              <>
                {replies.items.map((reply) => (
                  <PostCard
                    key={reply.id}
                    post={reply}
                    onChange={(next) =>
                      replies.setItems((items) =>
                        items.map((item) => (item.id === next.id ? next : item)),
                      )
                    }
                    onDeleted={(deleted) =>
                      replies.removeItem((item) => item.id === deleted.id)
                    }
                  />
                ))}
                {replies.hasMore ? (
                  <div className="load-more">
                    <button
                      type="button"
                      className="button"
                      data-variant="secondary"
                      data-size="sm"
                      onClick={replies.loadMore}
                    >
                      Load more replies
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </Page>
    </>
  )
}

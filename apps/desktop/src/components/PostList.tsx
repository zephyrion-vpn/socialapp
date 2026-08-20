import type { Post } from "@socialapp/shared"
import { useEffect, useRef } from "react"

import { PostCard } from "@/components/PostCard"
import { PostListSkeleton } from "@/components/Skeletons"
import { CenteredSpinner, EmptyState, ErrorState } from "@/components/States"
import type { PaginatedResult } from "@/hooks/usePaginated"

interface Props {
  result: PaginatedResult<Post>
  emptyTitle?: string
  emptyBody?: string
  emptyIcon?: string
}

export function PostList({
  result,
  emptyTitle = "Nothing here yet",
  emptyBody,
  emptyIcon,
}: Props) {
  const { items, state, error, hasMore, loadMore, refresh, setItems, removeItem } = result
  const sentinel = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore()
      },
      { rootMargin: "320px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  if (state === "loading") return <PostListSkeleton />

  if (state === "error" && items.length === 0) {
    return <ErrorState error={error} onRetry={() => void refresh()} />
  }

  if (items.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} body={emptyBody} />
  }

  return (
    <div>
      {items.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onChange={(next) =>
            setItems((current) => current.map((item) => (item.id === next.id ? next : item)))
          }
          onDeleted={(deleted) => removeItem((item) => item.id === deleted.id)}
        />
      ))}

      {hasMore ? (
        <div ref={sentinel}>
          <CenteredSpinner />
        </div>
      ) : (
        <div className="load-more muted">{"You have reached the end"}</div>
      )}
    </div>
  )
}

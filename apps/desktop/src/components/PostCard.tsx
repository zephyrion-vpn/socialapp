import { formatCount, formatRelativeTime, type Post } from "@socialapp/shared"
import { useState } from "react"

import { api } from "@/api/client"
import { Avatar } from "@/components/Avatar"
import { Icon } from "@/components/Icon"
import { MediaGrid } from "@/components/MediaGrid"
import { RichText } from "@/components/RichText"
import { routes, useRouter } from "@/router"
import { useSession } from "@/store/session"
import { useUi } from "@/store/ui"

interface Props {
  post: Post
  onChange?: (post: Post) => void
  onDeleted?: (post: Post) => void
  variant?: "feed" | "detail" | "quote"
}

export function PostCard({ post, onChange, onDeleted, variant = "feed" }: Props) {
  const { navigate } = useRouter()
  const { user } = useSession()
  const { toast, toastError } = useUi()
  const [busy, setBusy] = useState(false)

  const isOwn = user?.id === post.author.id
  const openPost = () => navigate(routes.post(post.id))

  async function toggleLike() {
    if (busy) return
    setBusy(true)
    onChange?.({
      ...post,
      liked: !post.liked,
      likeCount: post.likeCount + (post.liked ? -1 : 1),
    })
    try {
      const result = post.liked
        ? await api.posts.unlike(post.id)
        : await api.posts.like(post.id)
      onChange?.({ ...post, liked: result.liked, likeCount: result.likeCount })
    } catch (error) {
      onChange?.(post)
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  async function toggleRepost() {
    if (busy) return
    setBusy(true)
    onChange?.({
      ...post,
      reposted: !post.reposted,
      repostCount: post.repostCount + (post.reposted ? -1 : 1),
    })
    try {
      const result = post.reposted
        ? await api.posts.unrepost(post.id)
        : await api.posts.repost(post.id)
      onChange?.({ ...post, reposted: result.reposted, repostCount: result.repostCount })
    } catch (error) {
      onChange?.(post)
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  async function toggleBookmark() {
    if (busy) return
    setBusy(true)
    try {
      const result = post.bookmarked
        ? await api.posts.unbookmark(post.id)
        : await api.posts.bookmark(post.id)
      onChange?.({
        ...post,
        bookmarked: result.bookmarked,
        bookmarkCount: result.bookmarkCount,
      })
      toast(result.bookmarked ? "Saved to bookmarks" : "Removed from bookmarks", "success")
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (busy) return
    setBusy(true)
    try {
      await api.posts.remove(post.id)
      onDeleted?.(post)
      toast("Post deleted", "success")
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  if (variant === "quote") {
    return (
      <div
        className="post__quote"
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation()
          openPost()
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") openPost()
        }}
      >
        <div className="row" style={{ gap: 8 }}>
          <Avatar user={post.author} size="sm" />
          <span style={{ fontWeight: 620 }}>{post.author.displayName}</span>
          <span className="post__meta">@{post.author.username}</span>
        </div>
        <div className="post__body" data-selectable>
          {post.content}
        </div>
        {post.media.length > 0 ? <MediaGrid media={post.media} /> : null}
      </div>
    )
  }

  return (
    <article
      className="post"
      data-clickable={variant === "feed"}
      onClick={variant === "feed" ? openPost : undefined}
    >
      <Avatar
        user={post.author}
        onClick={() => navigate(routes.profile(post.author.username))}
      />

      <div style={{ minWidth: 0 }}>
        <div className="post__header">
          <button
            type="button"
            className="post__author"
            onClick={(event) => {
              event.stopPropagation()
              navigate(routes.profile(post.author.username))
            }}
          >
            {post.author.displayName}
          </button>
          <span className="post__meta">@{post.author.username}</span>
          <span className="post__meta">{"\u00B7"}</span>
          <span className="post__meta" title={new Date(post.createdAt).toLocaleString()}>
            {formatRelativeTime(post.createdAt)}
          </span>
          {post.editedAt ? <span className="post__meta">{"\u00B7 edited"}</span> : null}

          {isOwn ? (
            <button
              type="button"
              className="icon-button"
              style={{ marginLeft: "auto", width: 28, height: 28 }}
              title="Delete post"
              onClick={(event) => {
                event.stopPropagation()
                void remove()
              }}
            >
              <Icon name="trash" size={16} label="Delete post" />
            </button>
          ) : null}
        </div>

        {post.replyTo ? (
          <div className="post__reply-to">
            Replying to{" "}
            <button
              type="button"
              className="link"
              onClick={(event) => {
                event.stopPropagation()
                navigate(routes.profile(post.replyTo!.username))
              }}
            >
              @{post.replyTo.username}
            </button>
          </div>
        ) : null}

        {post.content ? (
          <div className="post__body" data-selectable>
            <RichText text={post.content} />
          </div>
        ) : null}

        <MediaGrid media={post.media} />

        {post.quotedPost ? <PostCard post={post.quotedPost} variant="quote" /> : null}

        <div className="post__actions">
          <button
            type="button"
            className="post-action"
            title="Reply"
            onClick={(event) => {
              event.stopPropagation()
              openPost()
            }}
          >
            <Icon name="reply" size={17} />
            <span>{post.replyCount > 0 ? formatCount(post.replyCount) : ""}</span>
          </button>

          <button
            type="button"
            className="post-action"
            data-tone="repost"
            data-on={post.reposted}
            title="Repost"
            onClick={(event) => {
              event.stopPropagation()
              void toggleRepost()
            }}
          >
            <Icon name="repeat" size={17} strokeWidth={post.reposted ? 2.1 : 1.75} />
            <span>{post.repostCount > 0 ? formatCount(post.repostCount) : ""}</span>
          </button>

          <button
            type="button"
            className="post-action"
            data-tone="like"
            data-on={post.liked}
            title="Like"
            onClick={(event) => {
              event.stopPropagation()
              void toggleLike()
            }}
          >
            <Icon name={post.liked ? "heart-filled" : "heart"} size={17} />
            <span>{post.likeCount > 0 ? formatCount(post.likeCount) : ""}</span>
          </button>

          <button
            type="button"
            className="post-action"
            data-tone="bookmark"
            data-on={post.bookmarked}
            title="Bookmark"
            onClick={(event) => {
              event.stopPropagation()
              void toggleBookmark()
            }}
          >
            <Icon name={post.bookmarked ? "bookmark-filled" : "bookmark"} size={17} />
          </button>

          {variant === "detail" && post.viewCount > 0 ? (
            <span className="post-action" style={{ cursor: "default" }}>
              {`${formatCount(post.viewCount)} views`}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}

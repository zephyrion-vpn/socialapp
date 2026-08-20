import type { MediaAttachment } from "@socialapp/shared"

import { bridge } from "@/api/bridge"

export function MediaGrid({ media }: { media: MediaAttachment[] }) {
  if (media.length === 0) return null

  return (
    <div className="media-grid" data-count={Math.min(media.length, 4)}>
      {media.slice(0, 4).map((item) => (
        <img
          key={item.id}
          src={item.url}
          alt={item.altText ?? ""}
          loading="lazy"
          draggable={false}
          onClick={(event) => {
            event.stopPropagation()
            void bridge.system.openExternal(item.url)
          }}
        />
      ))}
    </div>
  )
}

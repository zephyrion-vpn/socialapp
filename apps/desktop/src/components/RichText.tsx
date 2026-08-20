import { bridge } from "@/api/bridge"
import { routes, useRouter } from "@/router"

const TOKEN = /(https?:\/\/\S+|[@#][A-Za-z0-9_]{1,32})/g

/** Renders post text with clickable mentions, hashtags and links. */
export function RichText({ text }: { text: string }) {
  const { navigate } = useRouter()
  if (!text) return null

  const parts = text.split(TOKEN)

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null

        if (part.startsWith("http://") || part.startsWith("https://")) {
          return (
            <a
              key={index}
              href={part}
              className="link"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void bridge.system.openExternal(part)
              }}
            >
              {part.replace(/^https?:\/\//, "")}
            </a>
          )
        }

        if (part.startsWith("@") || part.startsWith("#")) {
          const value = part.slice(1)
          return (
            <button
              key={index}
              type="button"
              className="link"
              onClick={(event) => {
                event.stopPropagation()
                navigate(
                  part.startsWith("@")
                    ? routes.profile(value.toLowerCase())
                    : routes.hashtag(value.toLowerCase()),
                )
              }}
            >
              {part}
            </button>
          )
        }

        return <span key={index}>{part}</span>
      })}
    </>
  )
}

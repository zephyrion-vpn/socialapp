import { currentApiBaseUrl } from "@/api/client"
import { useUi } from "@/store/ui"

export function OfflineBanner() {
  const { isOnline } = useUi()
  if (isOnline) return null

  return (
    <div className="banner" data-tone="warn">
      <span>{"\u26A0\uFE0F"}</span>
      <span className="grow">
        You are offline. SocialApp will reconnect to {currentApiBaseUrl()} automatically.
      </span>
    </div>
  )
}

export function UpdateBanner() {
  const { updateStatus, installUpdate } = useUi()

  if (updateStatus.state === "available") {
    return (
      <div className="banner" data-tone="accent">
        <span>{"\u2B06\uFE0F"}</span>
        <span className="grow">
          Version {updateStatus.version} is available.
        </span>
        <button
          type="button"
          className="button"
          data-size="sm"
          onClick={() => void installUpdate()}
        >
          Download
        </button>
      </div>
    )
  }

  if (updateStatus.state === "downloading") {
    return (
      <div className="banner" data-tone="accent">
        <span className="grow">{`Downloading update\u2026 ${updateStatus.percent ?? 0}%`}</span>
      </div>
    )
  }

  if (updateStatus.state === "downloaded") {
    return (
      <div className="banner" data-tone="accent">
        <span className="grow">Update ready. Restart to install it.</span>
        <button
          type="button"
          className="button"
          data-size="sm"
          onClick={() => void installUpdate()}
        >
          Restart now
        </button>
      </div>
    )
  }

  return null
}

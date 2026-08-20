import { Icon } from "@/components/Icon"
import { useUi } from "@/store/ui"

export function Toasts() {
  const { toasts, dismissToast } = useUi()
  if (toasts.length === 0) return null

  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" data-tone={toast.tone} role="status">
          <span className="grow" data-selectable>
            {toast.message}
          </span>
          <button
            type="button"
            className="icon-button"
            style={{ width: 24, height: 24 }}
            aria-label="Dismiss"
            onClick={() => dismissToast(toast.id)}
          >
            <Icon name="x" size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}

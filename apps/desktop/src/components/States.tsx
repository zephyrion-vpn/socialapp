import type { ReactNode } from "react"

import { Icon } from "@/components/Icon"
import { humanizeError } from "@/store/ui"

interface EmptyStateProps {
  /** Any node - callers pass an <Icon />. */
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="state">
      <div className="state__icon">{icon ?? <Icon name="sparkles" size={26} />}</div>
      <div className="state__title">{title}</div>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
  title = "Could not load this",
}: {
  error: unknown
  onRetry?: () => void
  title?: string
}) {
  return (
    <div className="state" data-tone="error">
      <div className="state__icon">
        <Icon name="alert-triangle" size={26} />
      </div>
      <div className="state__title">{title}</div>
      <p data-selectable>{humanizeError(error)}</p>
      {onRetry ? (
        <button type="button" className="button" data-variant="secondary" onClick={onRetry}>
          <Icon name="refresh" size={16} />
          Try again
        </button>
      ) : null}
    </div>
  )
}

export function Spinner() {
  return <div className="spinner" role="progressbar" aria-label="Loading" />
}

export function CenteredSpinner() {
  return (
    <div className="load-more">
      <Spinner />
    </div>
  )
}

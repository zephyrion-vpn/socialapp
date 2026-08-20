import type { ReactNode } from "react"

import { humanizeError } from "@/store/ui"

interface EmptyStateProps {
  icon?: string
  title: string
  body?: string
  action?: ReactNode
}

export function EmptyState({ icon = "\u2728", title, body, action }: EmptyStateProps) {
  return (
    <div className="state">
      <div className="state__icon">{icon}</div>
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
    <div className="state">
      <div className="state__icon">{"\u26A0\uFE0F"}</div>
      <div className="state__title">{title}</div>
      <p data-selectable>{humanizeError(error)}</p>
      {onRetry ? (
        <button type="button" className="button" data-variant="secondary" onClick={onRetry}>
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

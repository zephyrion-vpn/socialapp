import { useEffect, type ReactNode } from "react"

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}

export function Modal({ title, onClose, children, width }: Props) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal" style={width ? { width } : undefined} role="dialog" aria-label={title}>
        <div className="modal__header">
          <span className="grow">{title}</span>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            {"\u00D7"}
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}

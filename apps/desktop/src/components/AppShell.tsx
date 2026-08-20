import type { ReactNode } from "react"

import { RightRail } from "@/components/RightRail"
import { Sidebar } from "@/components/Sidebar"
import { useRouter } from "@/router"

interface ShellProps {
  unread: number
  onCompose: () => void
  children: ReactNode
}

export function AppShell({ unread, onCompose, children }: ShellProps) {
  return (
    <div className="app">
      <Sidebar unread={unread} onCompose={onCompose} />
      <main className="main">{children}</main>
      <RightRail />
    </div>
  )
}

interface TopbarProps {
  title: string
  subtitle?: string
  showBack?: boolean
  actions?: ReactNode
}

export function Topbar({ title, subtitle, showBack, actions }: TopbarProps) {
  const { back, canGoBack } = useRouter()

  return (
    <header className="topbar">
      {showBack && canGoBack ? (
        <button type="button" className="icon-button" title="Back" onClick={back}>
          {"\u2190"}
        </button>
      ) : null}
      <div>
        <div className="topbar__title">{title}</div>
        {subtitle ? <div className="muted">{subtitle}</div> : null}
      </div>
      {actions ? <div className="topbar__actions">{actions}</div> : null}
    </header>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="scroll-area">{children}</div>
}

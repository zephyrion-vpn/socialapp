import { Modal } from "@/components/Modal"

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: "N", description: "New post" },
  { keys: "Ctrl + Enter", description: "Send the post you are writing" },
  { keys: "/", description: "Search" },
  { keys: "R", description: "Refresh the current view" },
  { keys: "G then H", description: "Go to Home" },
  { keys: "G then E", description: "Go to Explore" },
  { keys: "G then N", description: "Go to Notifications" },
  { keys: "G then B", description: "Go to Bookmarks" },
  { keys: "G then S", description: "Go to Settings" },
  { keys: "?", description: "Show this dialog" },
  { keys: "Esc", description: "Close dialogs" },
]

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} width={520}>
      <div className="col" style={{ gap: 8 }}>
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.keys} className="row">
            <span className="pill" style={{ minWidth: 104, textAlign: "center" }}>
              {shortcut.keys}
            </span>
            <span className="grow">{shortcut.description}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

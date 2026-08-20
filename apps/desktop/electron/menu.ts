import { BrowserWindow, Menu, app, shell, type MenuItemConstructorOptions } from "electron"

const REPO_URL = "https://github.com/zephyrion-vpn/socialapp"

function send(window: BrowserWindow | null, action: string): void {
  if (window && !window.isDestroyed()) window.webContents.send("menu:action", action)
}

/** Native menu, mirroring the in-app keyboard shortcuts. */
export function buildApplicationMenu(window: BrowserWindow, isDev: boolean): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "New post",
          accelerator: "CmdOrCtrl+N",
          click: () => send(window, "compose"),
        },
        { type: "separator" },
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => send(window, "navigate:/settings"),
        },
        { type: "separator" },
        { role: "quit", label: "Exit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Go",
      submenu: [
        { label: "Home", accelerator: "CmdOrCtrl+1", click: () => send(window, "navigate:/") },
        {
          label: "Explore",
          accelerator: "CmdOrCtrl+2",
          click: () => send(window, "navigate:/explore"),
        },
        {
          label: "Notifications",
          accelerator: "CmdOrCtrl+3",
          click: () => send(window, "navigate:/notifications"),
        },
        {
          label: "Bookmarks",
          accelerator: "CmdOrCtrl+4",
          click: () => send(window, "navigate:/bookmarks"),
        },
        { type: "separator" },
        { label: "Refresh feed", accelerator: "CmdOrCtrl+R", click: () => send(window, "refresh") },
        { label: "Search", accelerator: "CmdOrCtrl+F", click: () => send(window, "search") },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(isDev
          ? ([{ type: "separator" }, { role: "reload" }, { role: "toggleDevTools" }] as MenuItemConstructorOptions[])
          : []),
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Keyboard shortcuts",
          accelerator: "CmdOrCtrl+/",
          click: () => send(window, "shortcuts"),
        },
        {
          label: "Check for updates",
          click: () => send(window, "check-updates"),
        },
        { type: "separator" },
        { label: "Source code", click: () => void shell.openExternal(REPO_URL) },
        { label: `Version ${app.getVersion()}`, enabled: false },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

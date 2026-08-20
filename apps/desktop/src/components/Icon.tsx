import type { CSSProperties, ReactNode } from "react"

/**
 * The application icon set.
 *
 * Every icon is drawn on the same 24x24 grid with a 1.75 stroke, round caps and
 * round joins, and paints itself with `currentColor` - so an icon always picks
 * up the colour of the control it sits in (muted in a toolbar, accent when
 * active, white on the accent gradient). Filled variants exist only where a
 * state needs to read instantly, like a liked post.
 *
 * This replaces the emoji the UI used before: emoji are rendered by the OS font,
 * so their weight, size and colour were inconsistent across Windows, macOS and
 * Linux and could not follow the theme.
 */
export type IconName =
  | "logo"
  | "home"
  | "compass"
  | "bell"
  | "bookmark"
  | "bookmark-filled"
  | "user"
  | "users"
  | "settings"
  | "message-circle"
  | "send"
  | "pen"
  | "log-out"
  | "arrow-left"
  | "search"
  | "refresh"
  | "image"
  | "x"
  | "heart"
  | "heart-filled"
  | "repeat"
  | "reply"
  | "quote"
  | "more-horizontal"
  | "alert-triangle"
  | "arrow-up-circle"
  | "check"
  | "sparkles"
  | "hash"
  | "map-pin"
  | "shield"
  | "clock"
  | "sprout"
  | "trash"
  | "megaphone"
  | "lock"
  | "server"
  | "sun"
  | "info"
  | "chevron-right"

interface IconDefinition {
  body: ReactNode
  /** Solid icons drop the stroke and paint the path instead. */
  solid?: boolean
}

const ICONS: Record<IconName, IconDefinition> = {
  logo: {
    solid: true,
    body: (
      <path d="M12 3.6c-4.7 0-8.5 3-8.5 6.8 0 2.1 1.2 4 3.1 5.2-.2 1.2-.8 2.4-1.7 3.4-.3.3 0 .9.4.8 2-.4 3.5-1.2 4.5-2 .7.1 1.5.2 2.2.2 4.7 0 8.5-3 8.5-6.8S16.7 3.6 12 3.6Z" />
    ),
  },
  home: {
    body: (
      <>
        <path d="M3.4 10.6 12 3.8l8.6 6.8" />
        <path d="M5.6 9.4V19a1.8 1.8 0 0 0 1.8 1.8h9.2A1.8 1.8 0 0 0 18.4 19V9.4" />
        <path d="M9.6 20.8v-5.4a2.4 2.4 0 0 1 4.8 0v5.4" />
      </>
    ),
  },
  compass: {
    body: (
      <>
        <circle cx="12" cy="12" r="8.4" />
        <path d="M16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9Z" />
      </>
    ),
  },
  bell: {
    body: (
      <>
        <path d="M18.2 9.6a6.2 6.2 0 1 0-12.4 0c0 4.1-1.7 5.4-1.7 5.4h15.8s-1.7-1.3-1.7-5.4Z" />
        <path d="M10.2 18.6a2.2 2.2 0 0 0 3.6 0" />
      </>
    ),
  },
  bookmark: {
    body: (
      <path d="M6.6 3.8h10.8a1.2 1.2 0 0 1 1.2 1.2v15.4L12 16.6 5.4 20.4V5a1.2 1.2 0 0 1 1.2-1.2Z" />
    ),
  },
  "bookmark-filled": {
    solid: true,
    body: (
      <path d="M6.6 3.8h10.8a1.2 1.2 0 0 1 1.2 1.2v15.4L12 16.6 5.4 20.4V5a1.2 1.2 0 0 1 1.2-1.2Z" />
    ),
  },
  user: {
    body: (
      <>
        <circle cx="12" cy="8.2" r="3.8" />
        <path d="M4.8 20.4a7.2 7.2 0 0 1 14.4 0" />
      </>
    ),
  },
  users: {
    body: (
      <>
        <circle cx="9.4" cy="8.6" r="3.4" />
        <path d="M3.4 20.2a6 6 0 0 1 12 0" />
        <path d="M16.4 5.6a3.4 3.4 0 0 1 0 6.6" />
        <path d="M17.8 14.8a6 6 0 0 1 2.8 5.4" />
      </>
    ),
  },
  settings: {
    body: (
      <>
        <path d="M4 7.2h8.4" />
        <path d="M16.8 7.2H20" />
        <circle cx="14.6" cy="7.2" r="2.2" />
        <path d="M4 16.8h3.2" />
        <path d="M11.6 16.8H20" />
        <circle cx="9.4" cy="16.8" r="2.2" />
      </>
    ),
  },
  "message-circle": {
    body: (
      <path d="M20.4 11.6a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.5-.8L3.6 20.4l1.4-4.2a8.4 8.4 0 0 1-.8-3.6 8.4 8.4 0 0 1 8.4-8.4h.5a8.4 8.4 0 0 1 7.3 7.4Z" />
    ),
  },
  send: {
    body: (
      <>
        <path d="M20.6 3.4 3.6 10.2l7 2.8 2.8 7Z" />
        <path d="M20.6 3.4 10.6 13" />
      </>
    ),
  },
  pen: {
    body: (
      <>
        <path d="M16.4 3.6a2.2 2.2 0 0 1 3.1 3.1L8.2 18.1 3.9 19.5l1.4-4.3Z" />
        <path d="M14.6 5.4 17.7 8.5" />
      </>
    ),
  },
  "log-out": {
    body: (
      <>
        <path d="M9.4 20.4H6.2a2.2 2.2 0 0 1-2.2-2.2V5.8a2.2 2.2 0 0 1 2.2-2.2h3.2" />
        <path d="M15.6 8.2 19.4 12l-3.8 3.8" />
        <path d="M19.4 12H9.6" />
      </>
    ),
  },
  "arrow-left": {
    body: (
      <>
        <path d="M19.2 12H4.8" />
        <path d="M11.4 5.4 4.8 12l6.6 6.6" />
      </>
    ),
  },
  search: {
    body: (
      <>
        <circle cx="10.8" cy="10.8" r="6.6" />
        <path d="M15.6 15.6 20.4 20.4" />
      </>
    ),
  },
  refresh: {
    body: (
      <>
        <path d="M4.2 11.2A7.8 7.8 0 0 1 18.5 8.4" />
        <path d="M18.9 3.9v4.8h-4.8" />
        <path d="M19.8 12.8A7.8 7.8 0 0 1 5.5 15.6" />
        <path d="M5.1 20.1v-4.8h4.8" />
      </>
    ),
  },
  image: {
    body: (
      <>
        <path d="M4.4 6.6a2.2 2.2 0 0 1 2.2-2.2h10.8a2.2 2.2 0 0 1 2.2 2.2v10.8a2.2 2.2 0 0 1-2.2 2.2H6.6a2.2 2.2 0 0 1-2.2-2.2Z" />
        <circle cx="9.2" cy="9.2" r="1.5" />
        <path d="M4.6 16.4 8.8 12.2a2 2 0 0 1 2.8 0l6.8 6.8" />
      </>
    ),
  },
  x: {
    body: (
      <>
        <path d="M6.6 6.6 17.4 17.4" />
        <path d="M17.4 6.6 6.6 17.4" />
      </>
    ),
  },
  heart: {
    body: (
      <path d="M12 19.8C9.7 18.4 3.9 14.6 3.9 9.9 3.9 7.2 6 5.1 8.7 5.1c1.4 0 2.6.6 3.3 1.6.7-1 1.9-1.6 3.3-1.6 2.7 0 4.8 2.1 4.8 4.8 0 4.7-5.8 8.5-8.1 9.9Z" />
    ),
  },
  "heart-filled": {
    solid: true,
    body: (
      <path d="M12 19.8C9.7 18.4 3.9 14.6 3.9 9.9 3.9 7.2 6 5.1 8.7 5.1c1.4 0 2.6.6 3.3 1.6.7-1 1.9-1.6 3.3-1.6 2.7 0 4.8 2.1 4.8 4.8 0 4.7-5.8 8.5-8.1 9.9Z" />
    ),
  },
  repeat: {
    body: (
      <>
        <path d="M4.6 8.8h10.6a3.4 3.4 0 0 1 3.4 3.4v1.2" />
        <path d="M7.8 5.6 4.6 8.8l3.2 3.2" />
        <path d="M19.4 15.2H8.8a3.4 3.4 0 0 1-3.4-3.4v-1.2" />
        <path d="M16.2 18.4 19.4 15.2 16.2 12" />
      </>
    ),
  },
  reply: {
    body: (
      <path d="M20.4 13.8a2.4 2.4 0 0 1-2.4 2.4H8.6L4 20.4V6.4A2.4 2.4 0 0 1 6.4 4h11.6a2.4 2.4 0 0 1 2.4 2.4Z" />
    ),
  },
  quote: {
    body: (
      <>
        <path d="M9.8 7.4H6.6A2.6 2.6 0 0 0 4 10v2a2.6 2.6 0 0 0 2.6 2.6h1.4c0 1.7-1 2.8-2.6 3.4" />
        <path d="M19.8 7.4h-3.2A2.6 2.6 0 0 0 14 10v2a2.6 2.6 0 0 0 2.6 2.6H18c0 1.7-1 2.8-2.6 3.4" />
      </>
    ),
  },
  "more-horizontal": {
    solid: true,
    body: (
      <>
        <circle cx="5.6" cy="12" r="1.35" />
        <circle cx="12" cy="12" r="1.35" />
        <circle cx="18.4" cy="12" r="1.35" />
      </>
    ),
  },
  "alert-triangle": {
    body: (
      <>
        <path d="M10.4 4.4 3.2 17.3A1.8 1.8 0 0 0 4.8 20h14.4a1.8 1.8 0 0 0 1.6-2.7L13.6 4.4a1.8 1.8 0 0 0-3.2 0Z" />
        <path d="M12 9.6v4" />
        <path d="M12 16.6h.01" />
      </>
    ),
  },
  "arrow-up-circle": {
    body: (
      <>
        <circle cx="12" cy="12" r="8.4" />
        <path d="M12 15.8V8.4" />
        <path d="M8.6 11.8 12 8.4l3.4 3.4" />
      </>
    ),
  },
  check: {
    body: <path d="M4.8 12.4 9.4 17 19.2 7.2" />,
  },
  sparkles: {
    body: (
      <>
        <path d="M12 3.8l1.7 4.5 4.5 1.7-4.5 1.7L12 16.2l-1.7-4.5L5.8 10l4.5-1.7Z" />
        <path d="M18.6 15.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" />
      </>
    ),
  },
  hash: {
    body: (
      <>
        <path d="M9.6 4.2 7.8 19.8" />
        <path d="M16.2 4.2 14.4 19.8" />
        <path d="M4.6 9.2h14.6" />
        <path d="M3.8 14.8h14.6" />
      </>
    ),
  },
  "map-pin": {
    body: (
      <>
        <path d="M19.2 10.8c0 5.2-7.2 9.6-7.2 9.6s-7.2-4.4-7.2-9.6a7.2 7.2 0 0 1 14.4 0Z" />
        <circle cx="12" cy="10.6" r="2.6" />
      </>
    ),
  },
  shield: {
    body: (
      <>
        <path d="M12 3.4 5.2 6.2v5.4c0 4.3 2.9 7.7 6.8 9.2 3.9-1.5 6.8-4.9 6.8-9.2V6.2Z" />
        <path d="M9.2 12.2l2 2 3.6-3.8" />
      </>
    ),
  },
  clock: {
    body: (
      <>
        <circle cx="12" cy="12" r="8.4" />
        <path d="M12 7.4V12l3.2 1.9" />
      </>
    ),
  },
  sprout: {
    body: (
      <>
        <path d="M12 20.6v-6.8" />
        <path d="M12 13.8c0-4.1 3.3-7.4 7.4-7.4 0 4.1-3.3 7.4-7.4 7.4Z" />
        <path d="M12 13.8c-4.1 0-7.4-3.3-7.4-7.4 4.1 0 7.4 3.3 7.4 7.4Z" />
      </>
    ),
  },
  trash: {
    body: (
      <>
        <path d="M4.8 7.4h14.4" />
        <path d="M9.4 7.4V5.8a1.6 1.6 0 0 1 1.6-1.6h2a1.6 1.6 0 0 1 1.6 1.6v1.6" />
        <path d="M6.8 7.4l.9 11.2A1.8 1.8 0 0 0 9.5 20.2h5a1.8 1.8 0 0 0 1.8-1.6l.9-11.2" />
      </>
    ),
  },
  megaphone: {
    body: (
      <>
        <path d="M6.4 9.8 17.2 5.2v13.6L6.4 14.2Z" />
        <path d="M6.4 9.8H4.8A1.8 1.8 0 0 0 3 11.6v.8a1.8 1.8 0 0 0 1.8 1.8h1.6" />
        <path d="M19.8 9.6a3.6 3.6 0 0 1 0 4.8" />
      </>
    ),
  },
  lock: {
    body: (
      <>
        <rect x="4.6" y="10.4" width="14.8" height="9.8" rx="2.4" />
        <path d="M8.4 10.4V8a3.6 3.6 0 0 1 7.2 0v2.4" />
      </>
    ),
  },
  server: {
    body: (
      <>
        <rect x="3.6" y="4.4" width="16.8" height="6" rx="2" />
        <rect x="3.6" y="13.6" width="16.8" height="6" rx="2" />
        <path d="M7.4 7.4h.01" />
        <path d="M7.4 16.6h.01" />
      </>
    ),
  },
  sun: {
    body: (
      <>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.8v2.2" />
        <path d="M12 19v2.2" />
        <path d="M2.8 12h2.2" />
        <path d="M19 12h2.2" />
        <path d="M5.5 5.5 7.1 7.1" />
        <path d="M16.9 16.9 18.5 18.5" />
        <path d="M18.5 5.5 16.9 7.1" />
        <path d="M7.1 16.9 5.5 18.5" />
      </>
    ),
  },
  info: {
    body: (
      <>
        <circle cx="12" cy="12" r="8.4" />
        <path d="M12 11.2v5" />
        <path d="M12 8h.01" />
      </>
    ),
  },
  "chevron-right": {
    body: <path d="M9.6 5.4 16.2 12l-6.6 6.6" />,
  },
}

export interface IconProps {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
  /** Accessible name. Without it the icon is hidden from screen readers. */
  label?: string
}

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  className,
  style,
  label,
}: IconProps) {
  const icon = ICONS[name]
  const solid = icon.solid === true

  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={solid ? "currentColor" : "none"}
      stroke={solid ? "none" : "currentColor"}
      strokeWidth={solid ? undefined : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {icon.body}
    </svg>
  )
}

type Name =
  | 'radio' | 'heart'
  | 'play' | 'pause' | 'plus' | 'check' | 'search' | 'close'
  | 'chevronLeft' | 'chevronRight' | 'chevronDown' | 'arrowLeft'
  | 'volume' | 'mute' | 'expand' | 'collapse'
  | 'quality' | 'subtitles' | 'info' | 'menu' | 'user'
  | 'replay' | 'back10' | 'forward10' | 'trash' | 'warning'
  | 'together' | 'send' | 'link' | 'pip' | 'next' | 'calendar'

/** Filled glyphs — everything else is stroked. */
const FILLED = new Set<Name>(['play'])

const PATHS: Record<Name, string> = {
  radio: 'M5 8.5 18 3M4.5 8.5h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1ZM8.5 17a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM15 12h3M15 16h3',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  play: 'M8 5.5v13a.8.8 0 0 0 1.22.68l10.5-6.5a.8.8 0 0 0 0-1.36L9.22 4.82A.8.8 0 0 0 8 5.5Z',
  pause: 'M9 5v14M15 5v14',
  plus: 'M12 5v14M5 12h14',
  check: 'M4.5 12.5 9.5 17.5 19.5 6.5',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35',
  close: 'M6 6l12 12M18 6 6 18',
  chevronLeft: 'M15 5 8 12l7 7',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  volume: 'M4 9.5v5a1 1 0 0 0 1 1h3l4 3.5V5L8 8.5H5a1 1 0 0 0-1 1ZM16 9a4.5 4.5 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11',
  mute: 'M4 9.5v5a1 1 0 0 0 1 1h3l4 3.5V5L8 8.5H5a1 1 0 0 0-1 1ZM17 10l4 4M21 10l-4 4',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  collapse: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  quality: 'M5 7h14M5 12h14M5 17h14M9 5v4M15 10v4M11 15v4',
  subtitles: 'M3.5 5.5h17a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1ZM7 11.5h3.5M7 14.5h6M15.5 14.5H17',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.6v.5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  replay: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4',
  back10: 'M4 12a8 8 0 1 0 2.6-5.9M4 4v4h4',
  forward10: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4',
  trash: 'M4.5 7h15M9.5 7V5h5v2M7 7l.8 12.1a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L17 7',
  warning: 'M12 4.5 2.8 19.5h18.4L12 4.5ZM12 10v4.2M12 17v.5',
  together: 'M9 11.5a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8ZM2.5 19.5a6.5 6.5 0 0 1 13 0M16.5 5.2a3.4 3.4 0 0 1 0 6.6M18 14.2a6.5 6.5 0 0 1 3.5 5.3',
  send: 'M4.5 12 20 5l-7 15-2.2-6.3L4.5 12Z',
  link: 'M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.4 1.4M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.4-1.4',
  pip: 'M3.5 5.5h17a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1ZM12 12.5h7v4.5h-7Z',
  calendar: 'M4.5 6.5h15a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1ZM8 4v5M16 4v5M3.5 11.5h17',
  next: 'M7 6.2v11.6a.7.7 0 0 0 1.07.6l9.1-5.8a.7.7 0 0 0 0-1.2L8.07 5.6A.7.7 0 0 0 7 6.2ZM19.8 6v12',
}

interface Props {
  name: Name
  size?: number
  className?: string
}

export function Icon({ name, size = 20, className }: Props) {
  const filled = FILLED.has(name)
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

export type IconName = Name

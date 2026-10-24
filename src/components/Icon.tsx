import type { SVGProps } from 'react'

const P: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.6-4.6',
  grid: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  back: 'M15 18l-6-6 6-6',
  chevron: 'M9 6l6 6-6 6',
  close: 'M18 6L6 18M6 6l12 12',
  share: 'M12 3v12M7.5 7.5L12 3l4.5 4.5M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13',
  edit: 'M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4zM13.5 6.5l4 4',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M10 11v6M14 11v6',
  camera: 'M3.5 8.5A1.5 1.5 0 0 1 5 7h2.5l1.8-2.5h5.4L16.5 7H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5zM12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5V12l3 2',
  bowl: 'M3 11.5h18a9 9 0 0 1-18 0zM8.5 3.5c-.8 1-.8 2 0 3M12 3c-.8 1-.8 2 0 3M15.5 3.5c-.8 1-.8 2 0 3',
  send: 'M21 3L10.2 13.8M21 3l-6.8 18-4-7.2L3 9.8z',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  sync: 'M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4',
  flame: 'M12 3c.9 3.4 5 5.3 5 9.8a5 5 0 0 1-10 0c0-2 1-3.6 2.2-4.6 0 1.9.8 3 1.8 3.1C11 8.6 10.4 6.5 12 3z',
  copy: 'M9 9h10.5v11H9zM15 9V4.5H4.5V15H9',
  image: 'M4 5h16v14H4zM8.5 9a1.25 1.25 0 1 0 0 .01M20 15.5l-4.5-4.5L7 19.5',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z',
  sort: 'M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5',
  book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3',
  key: 'M8 11a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM10.9 12.1L19 4M15.5 7.5l2.5 2.5M13.5 9.5l1.8 1.8',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14',
  logout: 'M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M9.5 8L5.5 12l4 4M5.5 12H15',
  inbox: 'M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5M6 5h12l2.5 8.5V19H3.5v-5.5z',
  users: 'M9 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M21.5 20a6.5 6.5 0 0 0-3.8-5.9',
  phone: 'M8 2.5h8A1.5 1.5 0 0 1 17.5 4v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM11 18.5h2',
  lock: 'M6 10.5h12V20H6zM8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3',
  more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
}

export type IconName = keyof typeof P

export function Icon({ name, size = 20, stroke = 2, ...rest }: { name: IconName; size?: number; stroke?: number } & Omit<SVGProps<SVGSVGElement>, 'stroke' | 'size' | 'name'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={P[name]} />
    </svg>
  )
}

/** iOS share glyph, for the "Add to Home Screen" instructions. */
export function IosShareGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" />
    </svg>
  )
}

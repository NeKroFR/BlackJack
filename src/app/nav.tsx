// Shared navigation model: the single source of truth for routes, labels, and
// icons used by both the desktop side-nav and the mobile bottom bar.
import type { ReactNode } from 'react'

export interface NavItem {
  to: string
  /** Full label for the side-nav. */
  label: string
  /** Compact label for the mobile bottom bar. */
  short: string
  icon: ReactNode
  /** Exact-match (only the index route). */
  end?: boolean
}

export interface NavGroup {
  heading: string
  items: NavItem[]
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const HomeIcon = (
  <svg {...iconProps}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
  </svg>
)
const BookIcon = (
  <svg {...iconProps}>
    <path d="M4 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2V5Z" />
    <path d="M8 7h6M8 11h6" />
  </svg>
)
const FlashIcon = (
  <svg {...iconProps}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
)
const GridIcon = (
  <svg {...iconProps}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 3v18" />
  </svg>
)
const TargetIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
  </svg>
)
const CardsIcon = (
  <svg {...iconProps}>
    <rect x="3" y="6" width="12" height="15" rx="2" />
    <path d="M8 6V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1" />
  </svg>
)
const CoinsIcon = (
  <svg {...iconProps}>
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
    <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
  </svg>
)
const ChartIcon = (
  <svg {...iconProps}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V8M16 16v-6M20 16v-2" />
  </svg>
)
const CogIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
  </svg>
)

/** Grouped navigation for the desktop side-nav. */
export const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', short: 'Home', icon: HomeIcon, end: true },
      { to: '/learn', label: 'Learn', short: 'Learn', icon: BookIcon },
    ],
  },
  {
    heading: 'Drills',
    items: [
      { to: '/drill/count', label: 'Count drill', short: 'Count', icon: FlashIcon },
      { to: '/drill/strategy', label: 'Strategy trainer', short: 'Strategy', icon: GridIcon },
      { to: '/drill/deviations', label: 'Deviations', short: 'Deviate', icon: TargetIcon },
    ],
  },
  {
    heading: 'Play',
    items: [
      { to: '/play', label: 'Live game', short: 'Play', icon: CardsIcon },
      { to: '/betting', label: 'Betting sim', short: 'Betting', icon: CoinsIcon },
    ],
  },
  {
    heading: 'More',
    items: [
      { to: '/reference', label: 'Reference', short: 'Charts', icon: ChartIcon },
      { to: '/stats', label: 'Stats', short: 'Stats', icon: ChartIcon },
      { to: '/settings', label: 'Settings', short: 'Settings', icon: CogIcon },
    ],
  },
]

/** Flat list of every nav item, in order. Used by the mobile bottom bar. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

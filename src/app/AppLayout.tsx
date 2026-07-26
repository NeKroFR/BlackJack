import { NavLink, Outlet } from 'react-router-dom'
import { IconButton, Inline, Text, Badge, cn, focusRing } from '../ui'
import { useStore } from '../store'
import { Onboarding } from '../onboarding'
import { NAV_GROUPS, NAV_ITEMS, type NavItem } from './nav'

/** Cycle order for the theme toggle. */
const THEME_ORDER = ['system', 'light', 'dark'] as const

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z" />
    </svg>
  )
}
function AutoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  )
}
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function ThemeControls() {
  const themeMode = useStore((s) => s.themeMode)
  const setThemeMode = useStore((s) => s.setThemeMode)
  const colorblind = useStore((s) => s.colorblind)
  const setColorblind = useStore((s) => s.setColorblind)

  const nextTheme = () => {
    const i = THEME_ORDER.indexOf(themeMode as (typeof THEME_ORDER)[number])
    setThemeMode(THEME_ORDER[(i + 1) % THEME_ORDER.length])
  }
  const themeIcon = themeMode === 'light' ? <SunIcon /> : themeMode === 'dark' ? <MoonIcon /> : <AutoIcon />
  const themeLabel = `Theme: ${themeMode} (click to change)`

  return (
    <Inline gap={1}>
      <IconButton label="Colorblind-safe palette" aria-pressed={colorblind} onClick={() => setColorblind(!colorblind)}
        className={cn(colorblind && 'text-[var(--accent)]')}>
        <EyeIcon />
      </IconButton>
      <IconButton label={themeLabel} onClick={nextTheme}>
        {themeIcon}
      </IconButton>
    </Inline>
  )
}

function StatusReadout() {
  const bankroll = useStore((s) => s.bankroll)
  const trueCount = useStore((s) => s.trueCount)
  const runningCount = useStore((s) => s.runningCount)
  const countTone = runningCount > 0 ? 'good' : runningCount < 0 ? 'bad' : 'muted'
  return (
    <Inline gap={3} className="hidden sm:flex">
      <Inline gap={1}>
        <Text size="xs" tone="muted">RC</Text>
        <Text size="sm" weight="semibold" numeric tone={countTone as 'good' | 'bad' | 'muted'}>
          {runningCount > 0 ? `+${runningCount}` : runningCount}
        </Text>
      </Inline>
      <Inline gap={1}>
        <Text size="xs" tone="muted">TC</Text>
        <Text size="sm" weight="semibold" numeric tone={countTone as 'good' | 'bad' | 'muted'}>
          {trueCount > 0 ? `+${trueCount.toFixed(1)}` : trueCount.toFixed(1)}
        </Text>
      </Inline>
      <Inline gap={1}>
        <Text size="xs" tone="muted">Bank</Text>
        <Text size="sm" weight="semibold" numeric>${bankroll.toLocaleString()}</Text>
      </Inline>
    </Inline>
  )
}

const linkBase =
  'flex items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-[0.925rem] transition-colors duration-150'

function SideNavLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          linkBase,
          focusRing,
          isActive
            ? 'bg-[var(--surface-2)] text-[var(--ink)] font-medium shadow-[inset_2px_0_0_0_var(--accent)]'
            : 'text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
        )
      }
    >
      <span className="shrink-0" aria-hidden="true">{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  )
}

function BottomTab({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex shrink-0 basis-0 grow flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] px-2 py-1.5 min-w-[64px]',
          focusRing,
          isActive ? 'text-[var(--accent)]' : 'text-[var(--ink-muted)]',
        )
      }
    >
      <span aria-hidden="true">{item.icon}</span>
      <span className="text-[0.65rem] font-medium leading-none">{item.short}</span>
    </NavLink>
  )
}

export default function AppLayout() {
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--ink)]">
      {/* Top bar */}
      <header
        className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
          <NavLink to="/" className={cn('flex items-center gap-2 font-semibold tracking-tight', focusRing, 'rounded-[var(--radius-md)]')}>
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-[var(--radius-md)] bg-[var(--felt)] text-[var(--felt-ink)] text-sm font-bold"
            >
              21
            </span>
            <span className="hidden xs:inline sm:inline">Blackjack Trainer</span>
          </NavLink>
          <div className="flex-1" />
          <StatusReadout />
          <ThemeControls />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Desktop side-nav */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-[var(--border)] px-3 py-4 md:block">
          <nav aria-label="Primary">
            {NAV_GROUPS.map((group) => (
              <div key={group.heading} className="mb-4">
                <Text as="h2" size="xs" tone="muted" weight="semibold" className="px-3 pb-1 uppercase tracking-wide">
                  {group.heading}
                </Text>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <SideNavLink item={item} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="px-3 pt-2">
            <Badge variant="outline" size="sm">Offline · private</Badge>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 px-4 py-5 pb-24 md:px-8 md:py-8 md:pb-8">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex gap-1 overflow-x-auto px-2 py-1.5">
          {NAV_ITEMS.map((item) => (
            <BottomTab key={item.to} item={item} />
          ))}
        </div>
      </nav>

      <Onboarding />
    </div>
  )
}

import { Link, useNavigate } from 'react-router-dom'
import { Panel, Text, Heading, Stack, Inline, Button, Badge, cn, focusRing } from '../ui'
import { StatTile } from '../ui/charts'
import { useStore, accuracyPct, STAT_CATEGORIES, XP_PER_LEVEL } from '../store'
import { PageHeader } from './PageHeader'

interface QuickLink {
  to: string
  title: string
  blurb: string
}

const QUICK_LINKS: QuickLink[] = [
  { to: '/drill/strategy', title: 'Strategy trainer', blurb: 'Sharpen basic strategy, hand by hand.' },
  { to: '/drill/count', title: 'Count drill', blurb: 'Build raw counting speed and accuracy.' },
  { to: '/drill/deviations', title: 'Deviations', blurb: 'Learn count-based index plays.' },
  { to: '/play', title: 'Live game', blurb: 'Put it together at the felt table.' },
]

export default function Dashboard() {
  const level = useStore((s) => s.level)
  const xp = useStore((s) => s.xp)
  const dailyStreak = useStore((s) => s.dailyStreak)
  const streak = useStore((s) => s.streak)
  const bankroll = useStore((s) => s.bankroll)
  const sessionPnl = useStore((s) => s.sessionPnl)
  const accuracy = useStore((s) => s.accuracy)
  const navigate = useNavigate()

  const totalAnswered = STAT_CATEGORIES.reduce((sum, c) => sum + accuracy[c].total, 0)
  const totalCorrect = STAT_CATEGORIES.reduce((sum, c) => sum + accuracy[c].correct, 0)
  const overall = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  const worst = STAT_CATEGORIES.filter((c) => accuracy[c].total >= 5).sort(
    (a, b) => accuracyPct(accuracy[a]) - accuracyPct(accuracy[b]),
  )[0]

  const xpIntoLevel = xp % XP_PER_LEVEL
  const xpPct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100)

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your training at a glance. Pick up where you left off, or start a focused drill."
        actions={
          <Button variant="primary" size="lg" onClick={() => navigate('/drill/strategy')}>
            Start training
          </Button>
        }
      />

      <Stack gap={5}>
        {/* Hero progress panel */}
        <Panel padding="lg" elevation="raised" className="bg-[var(--felt)] text-[var(--felt-ink)]">
          <Inline justify="between" align="center" wrap className="gap-4">
            <Stack gap={2}>
              <Inline gap={2}>
                <Badge variant="accent" size="md">Level {level}</Badge>
                <Text size="sm" style={{ color: 'var(--felt-ink)', opacity: 0.85 }}>
                  {dailyStreak > 0 ? `${dailyStreak}-day streak` : 'Start a daily streak today'}
                </Text>
              </Inline>
              <Heading level={2} style={{ color: 'var(--felt-ink)' }}>
                {overall > 0 ? `${overall}% accuracy so far` : 'Ready when you are'}
              </Heading>
              <div className="w-64 max-w-full">
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/25">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${xpPct}%` }} />
                </div>
                <Text size="xs" style={{ color: 'var(--felt-ink)', opacity: 0.8 }} className="mt-1">
                  {xpIntoLevel} / {XP_PER_LEVEL} XP to level {level + 1}
                </Text>
              </div>
            </Stack>
          </Inline>
        </Panel>

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Overall accuracy" value={overall > 0 ? `${overall}%` : '—'} hint={`${totalAnswered} answered`} />
          <StatTile label="Current streak" value={streak} hint="correct in a row" />
          <StatTile label="Bankroll" value={`$${bankroll.toLocaleString()}`} />
          <StatTile
            label="Session P/L"
            value={`${sessionPnl >= 0 ? '+' : '−'}$${Math.abs(sessionPnl).toLocaleString()}`}
            delta={sessionPnl}
          />
        </div>

        {worst && (
          <Panel padding="md" inset>
            <Inline justify="between" align="center" wrap className="gap-3">
              <Text size="sm">
                Your weakest area right now is{' '}
                <Text as="span" weight="semibold" tone="accent">
                  {worst}
                </Text>
                . A few focused reps will help.
              </Text>
              <Button variant="secondary" size="sm" onClick={() => navigate('/drill/strategy')}>
                Drill it
              </Button>
            </Inline>
          </Panel>
        )}

        {/* Quick links */}
        <Stack gap={3}>
          <Text weight="semibold">Jump into a mode</Text>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {QUICK_LINKS.map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className={cn(
                  'block rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4 transition-shadow duration-150 hover:shadow-[var(--shadow-md)]',
                  focusRing,
                )}
              >
                <Text weight="semibold">{q.title}</Text>
                <Text size="sm" tone="muted">{q.blurb}</Text>
              </Link>
            ))}
          </div>
        </Stack>
      </Stack>
    </>
  )
}

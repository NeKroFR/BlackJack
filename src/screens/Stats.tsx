import { Panel, Text, Stack, Badge } from '../ui'
import { StatTile } from '../ui/charts'
import { useStore, accuracyPct, STAT_CATEGORIES, type StatCategory } from '../store'
import { PageHeader } from './PageHeader'

const CATEGORY_LABELS: Record<StatCategory, string> = {
  basicSplit: 'Splits',
  basicSoft: 'Soft hands',
  basicStiff: 'Stiffs',
  counting: 'Counting',
  deviations: 'Deviations',
  betting: 'Betting',
}

export default function Stats() {
  const accuracy = useStore((s) => s.accuracy)
  const streak = useStore((s) => s.streak)
  const bestStreak = useStore((s) => s.bestStreak)
  const cpm = useStore((s) => s.cpm)
  const mistakeLog = useStore((s) => s.mistakeLog)

  const totalAnswered = STAT_CATEGORIES.reduce((sum, c) => sum + accuracy[c].total, 0)
  const totalCorrect = STAT_CATEGORIES.reduce((sum, c) => sum + accuracy[c].correct, 0)
  const overall = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  return (
    <>
      <PageHeader
        title="Stats"
        description="Your accuracy trends, streaks, counting speed, and a reviewable log of every mistake. Trend charts and drill-down land here next."
      />
      <Stack gap={5}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Overall accuracy" value={`${overall}%`} hint={`${totalAnswered} answered`} />
          <StatTile label="Current streak" value={streak} hint="correct in a row" />
          <StatTile label="Best streak" value={bestStreak} />
          <StatTile label="Counting speed" value={`${Math.round(cpm)}`} hint="cards / min" />
        </div>

        <Panel padding="md">
          <Stack gap={3}>
            <Text weight="semibold">Accuracy by category</Text>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {STAT_CATEGORIES.map((c) => {
                const counter = accuracy[c]
                const pct = counter.total > 0 ? Math.round(accuracyPct(counter) * 100) : null
                return (
                  <StatTile
                    key={c}
                    label={CATEGORY_LABELS[c]}
                    value={pct === null ? '—' : `${pct}%`}
                    hint={counter.total > 0 ? `${counter.correct}/${counter.total}` : 'no data yet'}
                  />
                )
              })}
            </div>
          </Stack>
        </Panel>

        <Panel padding="md">
          <Stack gap={3}>
            <Text weight="semibold">Recent mistakes</Text>
            {mistakeLog.length === 0 ? (
              <Text tone="muted" size="sm">No mistakes logged yet — start a drill to build your review deck.</Text>
            ) : (
              <ul className="space-y-2">
                {mistakeLog.slice(0, 8).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2 last:border-0">
                    <Text size="sm">{CATEGORY_LABELS[m.category]}</Text>
                    <div className="flex items-center gap-2">
                      <Badge variant="bad" size="sm">{m.chosen}</Badge>
                      <Text size="xs" tone="muted">should be</Text>
                      <Badge variant="good" size="sm">{m.correct}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Stack>
        </Panel>
      </Stack>
    </>
  )
}

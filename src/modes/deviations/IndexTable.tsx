import { Panel, Text, Stack, Badge } from '../../ui'
import { ILLUSTRIOUS_18, FAB_4, type IndexPlay } from '../../engine/deviations'
import { actionLabel, handLabel, signed, upLabel } from './data'
import type { Action } from '../../engine/types'

function playLabel(p: IndexPlay): string {
  if (p.action === 'insurance') return 'Take insurance'
  return actionLabel(p.action as Action)
}

function matchup(p: IndexPlay): string {
  if (p.hand === 'insurance') return 'Any v A'
  return `${handLabel(p.hand)} v ${upLabel(p.dealerUpValue)}`
}

function Table({ title, plays }: { title: string; plays: IndexPlay[] }) {
  return (
    <Stack gap={2}>
      <Text size="sm" weight="semibold" tone="muted" className="uppercase tracking-wide">
        {title}
      </Text>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th scope="col" className="pr-4 font-medium">
                Hand
              </th>
              <th scope="col" className="pr-4 font-medium">
                Play
              </th>
              <th scope="col" className="pr-2 text-right font-medium">
                Index (TC)
              </th>
            </tr>
          </thead>
          <tbody>
            {plays.map((p) => (
              <tr key={`${p.hand}-${p.dealerUpValue}`} className="align-middle">
                <th
                  scope="row"
                  className="pr-4 text-left font-semibold text-ink tabular-nums whitespace-nowrap"
                >
                  {matchup(p)}
                </th>
                <td className="pr-4 text-ink">{playLabel(p)}</td>
                <td className="pr-2 text-right">
                  <Badge variant="accent" size="sm" className="tabular-nums">
                    {signed(p.index)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Stack>
  )
}

/** The canonical Hi-Lo index tables, revealed for study. */
export function IndexTable() {
  return (
    <Panel padding="md" elevation="raised">
      <Stack gap={4}>
        <Text size="sm" tone="muted">
          Canonical Hi-Lo indices. Deviate to the listed play at or above the true count shown;
          revert to basic strategy below it (negative indices flip: play the listed action at/above
          the negative index, and the opposite below).
        </Text>
        <div className="grid gap-6 md:grid-cols-2">
          <Table title="Illustrious 18" plays={ILLUSTRIOUS_18} />
          <Table title="Fab 4 — late surrender" plays={FAB_4} />
        </div>
      </Stack>
    </Panel>
  )
}

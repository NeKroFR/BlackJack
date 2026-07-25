import { useMemo } from 'react'
import { basicStrategyChart } from '../../engine/ev'
import type { ChartGrid, StrategyChart as StrategyChartData } from '../../engine/ev'
import type { Action, Rules } from '../../engine/types'
import { cn } from '../cn'
import { ACTION_ORDER, ACTION_STYLE, tint } from './palette'

export interface StrategyChartProps {
  /** Table rules. The chart recomputes whenever this reference changes. */
  rules: Rules
  /** Pre-computed chart to render instead of solving from `rules` (e.g. tests). */
  chart?: StrategyChartData
  /** Called when a cell is hovered/focused, for an external EV-rationale panel. */
  onCellHover?: (info: StrategyCellInfo | null) => void
  className?: string
}

export interface StrategyCellInfo {
  section: 'hard' | 'soft' | 'pairs'
  /** Row hand label, e.g. "16", "A,7", "8,8". */
  hand: string
  /** Dealer upcard label, e.g. "6" or "A". */
  upcard: string
  action: Action
}

/** Dealer upcards in column order, Ace last (bucket 1). Matches ev.ts. */
const UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]
const upLabel = (u: number) => (u === 1 ? 'A' : String(u))

function pairLabel(v: number): string {
  if (v === 1) return 'A,A'
  if (v === 10) return 'T,T'
  return `${v},${v}`
}

function rowKeys(grid: ChartGrid): number[] {
  return Object.keys(grid)
    .map(Number)
    .sort((a, b) => a - b)
}

function Cell({
  action,
  section,
  hand,
  upcard,
  onCellHover,
}: {
  action: Action
  section: StrategyCellInfo['section']
  hand: string
  upcard: string
  onCellHover?: (info: StrategyCellInfo | null) => void
}) {
  const style = ACTION_STYLE[action]
  const info: StrategyCellInfo = { section, hand, upcard, action }
  return (
    <td className="p-0">
      <div
        className={cn(
          'flex h-7 min-w-7 items-center justify-center rounded-[4px] text-xs font-semibold text-ink',
          'transition-transform duration-150 hover:scale-105',
        )}
        style={{ background: tint(style.token, 62) }}
        title={`${hand} vs ${upcard}: ${style.label}`}
        onMouseEnter={onCellHover ? () => onCellHover(info) : undefined}
        onMouseLeave={onCellHover ? () => onCellHover(null) : undefined}
      >
        {style.glyph}
      </div>
    </td>
  )
}

function Section({
  title,
  section,
  grid,
  label,
  onCellHover,
}: {
  title: string
  section: StrategyCellInfo['section']
  grid: ChartGrid
  label: (row: number) => string
  onCellHover?: (info: StrategyCellInfo | null) => void
}) {
  const rows = rowKeys(grid)
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-max border-separate border-spacing-[2px]">
        <thead>
          <tr>
            <th className="w-9" aria-label="Hand" />
            {UPCARDS.map((u) => (
              <th
                key={u}
                scope="col"
                className="min-w-7 pb-1 text-center text-xs font-medium text-ink-muted"
              >
                {upLabel(u)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rlabel = label(r)
            return (
              <tr key={r}>
                <th
                  scope="row"
                  className="pr-1.5 text-right text-xs font-medium text-ink tabular-nums"
                >
                  {rlabel}
                </th>
                {UPCARDS.map((u) => (
                  <Cell
                    key={u}
                    action={grid[r][u]}
                    section={section}
                    hand={rlabel}
                    upcard={upLabel(u)}
                    onCellHover={onCellHover}
                  />
                ))}
              </tr>
            )
          })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Legend of the five action colors. */
export function StrategyLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-x-4 gap-y-1.5', className)}>
      {ACTION_ORDER.map((a) => {
        const s = ACTION_STYLE[a]
        return (
          <span key={a} className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <span
              aria-hidden
              className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] text-[10px] font-semibold text-ink"
              style={{ background: tint(s.token, 62) }}
            >
              {s.glyph}
            </span>
            {s.label}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Rule-aware color-coded basic-strategy grid. Solves the chart for the given
 * rules via {@link basicStrategyChart} (memoised on the `rules` reference) and
 * renders hard-total, soft-total and pair tables with one color per action.
 */
export function StrategyChart({ rules, chart, onCellHover, className }: StrategyChartProps) {
  const data = useMemo(() => chart ?? basicStrategyChart(rules), [chart, rules])

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-col gap-6 overflow-x-auto xl:flex-row xl:gap-8">
        <Section
          title="Hard totals"
          section="hard"
          grid={data.hard}
          label={(r) => String(r)}
          onCellHover={onCellHover}
        />
        <Section
          title="Soft totals"
          section="soft"
          grid={data.soft}
          label={(r) => `A,${r - 11}`}
          onCellHover={onCellHover}
        />
        <Section
          title="Pairs"
          section="pairs"
          grid={data.pairs}
          label={pairLabel}
          onCellHover={onCellHover}
        />
      </div>
      <StrategyLegend />
    </div>
  )
}

import { forwardRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../cn'
import { Sparkline } from './Sparkline'

export type StatTileTrend = 'up' | 'down' | 'flat'
export type StatDeltaTone = 'good' | 'bad' | 'neutral'

export interface StatTileProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Small caption above the value. */
  label: string
  /** The headline metric (pre-formatted). */
  value: ReactNode
  /** Optional secondary caption below the value. */
  hint?: ReactNode
  /** Change chip shown next to the value (e.g. "+12%"). Numbers get a sign. */
  delta?: ReactNode
  /** Chip tone. Defaults to good/bad from a numeric `delta`'s sign, else neutral. */
  deltaTone?: StatDeltaTone
  /** Trend arrow direction. Defaults from a numeric `delta`'s sign. */
  trend?: StatTileTrend
  /** Optional inline sparkline drawn along the tile's foot. */
  sparkline?: number[]
  /** Sparkline stroke color token. */
  sparklineColor?: string
}

const arrow: Record<StatTileTrend, string> = { up: '↑', down: '↓', flat: '→' }

const toneText: Record<StatDeltaTone, string> = {
  good: 'text-good',
  bad: 'text-bad',
  neutral: 'text-ink-muted',
}

const toneBg: Record<StatDeltaTone, string> = {
  good: 'bg-good/12 text-good',
  bad: 'bg-bad/12 text-bad',
  neutral: 'bg-surface-2 text-ink-muted',
}

function deriveTone(delta: ReactNode): StatDeltaTone {
  if (typeof delta === 'number') return delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral'
  return 'neutral'
}

function deriveTrend(delta: ReactNode): StatTileTrend {
  if (typeof delta === 'number') return delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  return 'flat'
}

function fmtDelta(delta: ReactNode): ReactNode {
  if (typeof delta === 'number') return `${delta > 0 ? '+' : ''}${delta}`
  return delta
}

/** Labelled metric tile with optional delta chip, trend arrow and sparkline. */
export const StatTile = forwardRef<HTMLDivElement, StatTileProps>(function StatTile(
  {
    label,
    value,
    hint,
    delta,
    deltaTone,
    trend,
    sparkline,
    sparklineColor = 'var(--accent)',
    className,
    ...rest
  },
  ref,
) {
  const hasDelta = delta !== undefined && delta !== null
  const tone = deltaTone ?? deriveTone(delta)
  const dir = trend ?? deriveTrend(delta)

  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col rounded-xl border border-border bg-panel p-4',
        'transition-shadow duration-150',
        className,
      )}
      {...rest}
    >
      <span className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</span>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-ink tabular-nums [font-variant-numeric:tabular-nums]">
          {value}
        </span>
        {hasDelta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
              toneBg[tone],
            )}
          >
            <span aria-hidden className={toneText[tone]}>
              {arrow[dir]}
            </span>
            {fmtDelta(delta)}
          </span>
        )}
      </div>
      {hint != null && <span className="mt-0.5 text-xs text-ink-muted">{hint}</span>}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-3">
          <Sparkline data={sparkline} color={sparklineColor} height={28} area />
        </div>
      )}
    </div>
  )
})

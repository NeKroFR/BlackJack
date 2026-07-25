import { useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '../cn'
import { chartColor } from './palette'

export interface LineSeries {
  name: string
  /** y-values aligned to the shared x index (and to `labels` when present). */
  values: number[]
  /** Override color token, defaults to the categorical palette. */
  color?: string
}

export interface LineChartProps {
  series: LineSeries[]
  /** x-axis tick labels, one per index. */
  labels?: string[]
  /** Rendered aspect via the internal viewBox. Width is fluid. Default 200. */
  height?: number
  /** Format y readouts in the tooltip and axis. */
  yFormat?: (n: number) => string
  /** Draw horizontal gridlines (default true). */
  grid?: boolean
  /** Draw a dot at each data point (default false). */
  dots?: boolean
  ariaLabel?: string
  className?: string
}

const VB_W = 480
const PAD_L = 44
const PAD_R = 12
const PAD_T = 12
const PAD_B = 24

const defaultFormat = (n: number) => String(Math.round(n * 100) / 100)

/** Multi-series line chart as responsive inline SVG with a hover tooltip. */
export function LineChart({
  series,
  labels,
  height = 200,
  yFormat = defaultFormat,
  grid = true,
  dots = false,
  ariaLabel,
  className,
}: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null)

  const model = useMemo(() => {
    const len = series.reduce((m, s) => Math.max(m, s.values.length), 0)
    let min = Infinity
    let max = -Infinity
    for (const s of series)
      for (const v of s.values) {
        if (v < min) min = v
        if (v > max) max = v
      }
    if (!Number.isFinite(min)) {
      min = 0
      max = 1
    }
    if (min === max) {
      min -= 1
      max += 1
    }
    return { len, min, max }
  }, [series])

  const { len, min, max } = model
  const plotW = VB_W - PAD_L - PAD_R
  const plotH = height - PAD_T - PAD_B
  const x = (i: number) => (len <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (len - 1)) * plotW)
  const y = (v: number) => PAD_T + (1 - (v - min) / (max - min)) * plotH

  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => min + ((max - min) * i) / ticks)

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (len === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * VB_W
    const frac = (px - PAD_L) / plotW
    const idx = Math.round(frac * (len - 1))
    setHover(Math.max(0, Math.min(len - 1, idx)))
  }

  const empty = series.length === 0 || len === 0

  return (
    <div className={cn('w-full', className)}>
      <svg
        role="img"
        aria-label={ariaLabel ?? 'Line chart'}
        width="100%"
        viewBox={`0 0 ${VB_W} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {grid &&
          yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD_L}
                x2={VB_W - PAD_R}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--border)"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={PAD_L - 6}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="var(--ink-muted)"
              >
                {yFormat(t)}
              </text>
            </g>
          ))}

        {!empty &&
          series.map((s, si) => {
            const color = s.color ?? chartColor(si)
            const d = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
            return (
              <g key={s.name}>
                <polyline
                  points={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {dots &&
                  s.values.map((v, i) => (
                    <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={color} />
                  ))}
              </g>
            )
          })}

        {hover != null && !empty && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD_T}
              y2={PAD_T + plotH}
              stroke="var(--ink-muted)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {series.map((s, si) =>
              s.values[hover] === undefined ? null : (
                <circle
                  key={s.name}
                  cx={x(hover)}
                  cy={y(s.values[hover])}
                  r={3.5}
                  fill={s.color ?? chartColor(si)}
                  stroke="var(--surface)"
                  strokeWidth={1.5}
                />
              ),
            )}
          </g>
        )}

        {labels && labels.length > 0 && (
          <g>
            {[0, len - 1].map((i) =>
              labels[i] === undefined ? null : (
                <text
                  key={i}
                  x={x(i)}
                  y={height - 6}
                  textAnchor={i === 0 ? 'start' : 'end'}
                  fontSize={10}
                  fill="var(--ink-muted)"
                >
                  {labels[i]}
                </text>
              ),
            )}
          </g>
        )}
      </svg>

      {hover != null && !empty && (
        <div
          className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs"
          role="status"
          aria-live="polite"
        >
          {labels?.[hover] != null && (
            <span className="font-medium text-ink">{labels[hover]}</span>
          )}
          {series.map((s, si) =>
            s.values[hover] === undefined ? null : (
              <span key={s.name} className="inline-flex items-center gap-1.5 text-ink-muted">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: s.color ?? chartColor(si) }}
                />
                {s.name}:{' '}
                <span className="font-medium text-ink tabular-nums">{yFormat(s.values[hover])}</span>
              </span>
            ),
          )}
        </div>
      )}
    </div>
  )
}

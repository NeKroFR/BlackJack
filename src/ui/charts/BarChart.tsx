import { useMemo, useState } from 'react'
import { cn } from '../cn'
import { chartColor } from './palette'

export interface BarDatum {
  label: string
  value: number
  /** Override color token, defaults to the categorical palette by index. */
  color?: string
}

export interface BarChartProps {
  data: BarDatum[]
  /** Rendered aspect via the internal viewBox. Width is fluid. Default 200. */
  height?: number
  /** Format bar values in labels and the tooltip. */
  valueFormat?: (n: number) => string
  /** Force a baseline of zero even when all values are positive (default true). */
  zeroBaseline?: boolean
  /** Single color for every bar (overrides the categorical palette). */
  color?: string
  ariaLabel?: string
  className?: string
}

const VB_W = 480
const PAD_L = 44
const PAD_R = 12
const PAD_T = 12
const PAD_B = 28

const defaultFormat = (n: number) => String(Math.round(n * 100) / 100)

/** Vertical bar chart as responsive inline SVG with per-bar hover highlight. */
export function BarChart({
  data,
  height = 200,
  valueFormat = defaultFormat,
  zeroBaseline = true,
  color,
  ariaLabel,
  className,
}: BarChartProps) {
  const [hover, setHover] = useState<number | null>(null)

  const { min, max } = useMemo(() => {
    let lo = zeroBaseline ? 0 : Infinity
    let hi = zeroBaseline ? 0 : -Infinity
    for (const d of data) {
      if (d.value < lo) lo = d.value
      if (d.value > hi) hi = d.value
    }
    if (!Number.isFinite(lo)) lo = 0
    if (!Number.isFinite(hi)) hi = 1
    if (lo === hi) hi = lo + 1
    return { min: lo, max: hi }
  }, [data, zeroBaseline])

  const plotW = VB_W - PAD_L - PAD_R
  const plotH = height - PAD_T - PAD_B
  const y = (v: number) => PAD_T + (1 - (v - min) / (max - min)) * plotH
  const zeroY = y(Math.max(0, min))

  const n = data.length
  const slot = n > 0 ? plotW / n : plotW
  const barW = Math.min(slot * 0.7, 48)

  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => min + ((max - min) * i) / ticks)

  return (
    <div className={cn('w-full', className)}>
      <svg
        role="img"
        aria-label={ariaLabel ?? 'Bar chart'}
        width="100%"
        viewBox={`0 0 ${VB_W} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
        onPointerLeave={() => setHover(null)}
      >
        {yTicks.map((t, i) => (
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
              {valueFormat(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = PAD_L + slot * i + slot / 2
          const top = Math.min(y(d.value), zeroY)
          const h = Math.abs(y(d.value) - zeroY)
          const fill = d.color ?? color ?? chartColor(i)
          const active = hover === i
          return (
            <g
              key={`${d.label}-${i}`}
              onPointerEnter={() => setHover(i)}
              style={{ cursor: 'default' }}
            >
              <rect
                x={cx - slot / 2}
                y={PAD_T}
                width={slot}
                height={plotH}
                fill="transparent"
              />
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={Math.max(h, 0.5)}
                rx={3}
                fill={fill}
                opacity={hover == null || active ? 1 : 0.45}
              />
              <text
                x={cx}
                y={height - 8}
                textAnchor="middle"
                fontSize={10}
                fill="var(--ink-muted)"
              >
                {d.label}
              </text>
              {active && (
                <text
                  x={cx}
                  y={top - 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--ink)"
                >
                  {valueFormat(d.value)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

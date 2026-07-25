import { forwardRef, useId } from 'react'
import { cn } from '../cn'

export interface SparklineProps {
  /** Series of y-values, plotted left→right at even x spacing. */
  data: number[]
  /** Stroke color token (default accent). */
  color?: string
  /** Fill a soft area under the line. */
  area?: boolean
  /** Rendered height in px (line stretches to the container width). */
  height?: number
  /** Stroke width in px (kept crisp under horizontal stretch). */
  strokeWidth?: number
  /** Accessible label. When omitted the sparkline is aria-hidden. */
  ariaLabel?: string
  className?: string
}

// Internal coordinate box. The SVG stretches horizontally to its container via
// preserveAspectRatio="none", and vector-effect keeps the stroke from smearing.
const VB_W = 100

/** Minimal inline-SVG trend line for dense readouts and stat tiles. */
export const Sparkline = forwardRef<SVGSVGElement, SparklineProps>(function Sparkline(
  { data, color = 'var(--accent)', area = false, height = 32, strokeWidth = 1.5, ariaLabel, className },
  ref,
) {
  const gid = useId()
  const vbH = 100
  const pad = strokeWidth + 1

  if (data.length === 0) {
    return (
      <svg
        ref={ref}
        role={ariaLabel ? 'img' : undefined}
        aria-label={ariaLabel}
        aria-hidden={ariaLabel ? undefined : true}
        width="100%"
        height={height}
        viewBox={`0 0 ${VB_W} ${vbH}`}
        preserveAspectRatio="none"
        className={cn('block', className)}
      />
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const n = data.length
  const x = (i: number) => (n === 1 ? VB_W / 2 : (i / (n - 1)) * VB_W)
  const y = (v: number) => vbH - pad - ((v - min) / span) * (vbH - pad * 2)

  const pts = data.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  const areaPath =
    n === 1
      ? ''
      : `M ${x(0).toFixed(2)},${vbH} L ` +
        data.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' L ') +
        ` L ${x(n - 1).toFixed(2)},${vbH} Z`

  return (
    <svg
      ref={ref}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      width="100%"
      height={height}
      viewBox={`0 0 ${VB_W} ${vbH}`}
      preserveAspectRatio="none"
      className={cn('block overflow-visible', className)}
    >
      {area && n > 1 && (
        <>
          <defs>
            <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#spark-${gid})`} stroke="none" />
        </>
      )}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
})

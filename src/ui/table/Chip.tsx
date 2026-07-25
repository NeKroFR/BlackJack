import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { cn } from '../cn'
import { Text } from '../Text'
import './table.css'

export type ChipSize = 'sm' | 'md' | 'lg'

export interface ChipProps extends HTMLAttributes<HTMLDivElement> {
  /** Chip denomination / value. */
  value: number
  size?: ChipSize
  /** Override the text shown on the chip face. */
  label?: string
  /** Play the place animation (chip drops onto the spot). Respects reduced-motion. */
  animateIn?: boolean
}

export interface ChipStackProps extends HTMLAttributes<HTMLDivElement> {
  /** Total bet amount, broken into standard denominations. */
  amount: number
  size?: ChipSize
  /** Maximum chips rendered before the stack is capped (default 6). */
  maxChips?: number
  /** Show the numeric total under the stack (default true). */
  showTotal?: boolean
  /** Stagger a place animation as the chips land (respects reduced-motion). */
  animateIn?: boolean
}

interface Denom {
  value: number
  bg: string
  edge: string
  ink: string
  spot: string
}

/** Casino-standard denomination colours (edge = the darker rim ring). */
const DENOMS: Denom[] = [
  { value: 5000, bg: '#b5471d', edge: '#7c2f11', ink: '#ffffff', spot: 'rgba(255,255,255,0.9)' },
  { value: 1000, bg: '#caa11d', edge: '#8a6c0c', ink: '#211803', spot: 'rgba(33,24,3,0.55)' },
  { value: 500, bg: '#6b2d8f', edge: '#481c63', ink: '#ffffff', spot: 'rgba(255,255,255,0.9)' },
  { value: 100, bg: '#1c1c22', edge: '#000000', ink: '#ffffff', spot: 'rgba(255,255,255,0.85)' },
  { value: 25, bg: '#1e7d47', edge: '#125230', ink: '#ffffff', spot: 'rgba(255,255,255,0.9)' },
  { value: 5, bg: '#c0392b', edge: '#821f16', ink: '#ffffff', spot: 'rgba(255,255,255,0.9)' },
  { value: 1, bg: '#e9e7dc', edge: '#b9b6a6', ink: '#1c1c22', spot: 'rgba(28,28,34,0.4)' },
]

function denomFor(value: number): Denom {
  for (const d of DENOMS) if (value >= d.value) return d
  return DENOMS[DENOMS.length - 1]
}

function chipText(value: number): string {
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}K`
  return `${value}`
}

const chipSizes: Record<ChipSize, string> = {
  sm: 'w-8 h-8 text-[0.5rem]',
  md: 'w-11 h-11 text-[0.6875rem]',
  lg: 'w-14 h-14 text-xs',
}

const chipPx: Record<ChipSize, number> = { sm: 32, md: 44, lg: 56 }

/** A single casino chip: coloured body, edge stripes, dashed inset ring. */
export const Chip = forwardRef<HTMLDivElement, ChipProps>(function Chip(
  { value, size = 'md', label, animateIn = false, className, style, ...rest },
  ref,
) {
  const d = denomFor(value)
  const text = label ?? chipText(value)
  return (
    <div
      ref={ref}
      role="img"
      aria-label={`${value} chip`}
      className={cn(
        'relative shrink-0 rounded-full grid place-items-center font-bold select-none',
        chipSizes[size],
        animateIn && 'tbl-chip-place',
        className,
      )}
      style={{
        background: d.edge,
        color: d.ink,
        boxShadow:
          '0 1px 1px rgba(0,0,0,0.4), 0 3px 5px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.12)',
        ...style,
      }}
      {...rest}
    >
      {/* Edge stripes: alternating light wedges around the rim. */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{ background: `repeating-conic-gradient(${d.spot} 0deg 10deg, transparent 10deg 45deg)` }}
      />
      {/* Chip body inset inside the striped edge. */}
      <div
        aria-hidden
        className="absolute inset-[15%] rounded-full"
        style={{
          background: `radial-gradient(circle at 38% 32%, color-mix(in srgb, ${d.bg} 82%, white 18%), ${d.bg} 70%)`,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.28), inset 0 -2px 4px rgba(0,0,0,0.25)',
        }}
      />
      {/* Dashed inner ring. */}
      <div
        aria-hidden
        className="absolute inset-[24%] rounded-full"
        style={{ border: `1px dashed ${d.spot}` }}
      />
      <span className="relative z-10 leading-none">{text}</span>
    </div>
  )
})

function breakdown(amount: number): number[] {
  const out: number[] = []
  let rem = Math.max(0, Math.floor(amount))
  for (const d of DENOMS) {
    while (rem >= d.value) {
      out.push(d.value)
      rem -= d.value
    }
  }
  return out
}

/** A stacked pile of chips representing a bet amount. */
export const ChipStack = forwardRef<HTMLDivElement, ChipStackProps>(function ChipStack(
  { amount, size = 'md', maxChips = 6, showTotal = true, animateIn = false, className, ...rest },
  ref,
) {
  const all = breakdown(amount)
  const chips = all.slice(0, maxChips).reverse()
  const overlap = Math.round(chipPx[size] * 0.72)

  if (chips.length === 0) {
    return (
      <div ref={ref} className={cn('inline-flex flex-col items-center gap-1', className)} {...rest}>
        {showTotal && (
          <Text size="sm" tone="muted" numeric>
            ${Math.max(0, Math.floor(amount))}
          </Text>
        )}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={cn('inline-flex flex-col items-center gap-1', className)}
      aria-label={`Bet: ${Math.floor(amount)}`}
      {...rest}
    >
      <div className="flex flex-col items-center">
        {chips.map((v, i) => (
          <Chip
            key={i}
            value={v}
            size={size}
            aria-hidden={i !== chips.length - 1}
            animateIn={animateIn}
            style={{
              marginTop: i === 0 ? 0 : -overlap,
              zIndex: i,
              animationDelay: animateIn ? `${i * 55}ms` : undefined,
            }}
          />
        ))}
      </div>
      {showTotal && (
        <Text size="sm" tone="muted" numeric>
          ${Math.floor(amount)}
        </Text>
      )}
    </div>
  )
})

import { forwardRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import type { Rules } from '../../engine/types'
import { cn } from '../cn'
import './table.css'

export interface FeltProps extends HTMLAttributes<HTMLDivElement> {
  /** Blackjack payout. Drives the "BLACKJACK PAYS …" arc marking. Default 3:2. */
  blackjackPayout?: Rules['blackjackPayout']
  /** Dealer soft-17 rule. Drives the "DEALER MUST …" marking. Default S17. */
  soft17?: Rules['soft17']
  /** Number of bet spots drawn along the betting arc (default 5). */
  spots?: number
  /**
   * `full` draws the curved rule lettering. `minimal` keeps only the betting
   * arc and its spots: on a narrow felt the SVG letterboxes into the middle
   * band, which is exactly where the cards land, so the lettering reads as
   * broken rather than as table printing.
   */
  markings?: 'full' | 'minimal'
  /** Stretch to the height of the parent instead of hugging the contents. */
  fill?: boolean
  /** Table contents (seats, cards, chips) rendered on top of the felt. */
  children?: ReactNode
}

const PAYOUT_TEXT: Record<Rules['blackjackPayout'], string> = {
  '3:2': 'BLACKJACK PAYS 3 TO 2',
  '6:5': 'BLACKJACK PAYS 6 TO 5',
  '2:1': 'BLACKJACK PAYS 2 TO 1',
  '1:1': 'BLACKJACK PAYS EVEN MONEY',
}

const SOFT17_TEXT: Record<Rules['soft17'], string> = {
  S17: 'DEALER MUST STAND ON ALL 17s',
  H17: 'DEALER MUST HIT SOFT 17',
}

const VB_W = 1000
const VB_H = 620

// Betting arc as a quadratic Bézier (concave-up smile across the lower felt).
const ARC = { p0: { x: 150, y: 548 }, p1: { x: 500, y: 300 }, p2: { x: 850, y: 548 } }

function quadPoint(t: number): { x: number; y: number } {
  const u = 1 - t
  const a = u * u
  const b = 2 * u * t
  const c = t * t
  return {
    x: a * ARC.p0.x + b * ARC.p1.x + c * ARC.p2.x,
    y: a * ARC.p0.y + b * ARC.p1.y + c * ARC.p2.y,
  }
}

const INK = 'var(--felt-ink)'

/**
 * The blackjack table: a wood/leather rail framing a radial-gradient felt with a
 * subtle noise texture and vignette, a curved betting arc with bet spots, and
 * rule-aware markings ("BLACKJACK PAYS …", "DEALER MUST …"). Lay the dealer,
 * seats and the hero hand inside via `children`.
 */
export const Felt = forwardRef<HTMLDivElement, FeltProps>(function Felt(
  {
    blackjackPayout = '3:2',
    soft17 = 'S17',
    spots = 5,
    markings = 'full',
    fill = false,
    children,
    className,
    style,
    ...rest
  },
  ref,
) {
  const spotPoints = Array.from({ length: Math.max(0, spots) }, (_, i) =>
    quadPoint((i + 0.5) / spots),
  )

  return (
    <div
      ref={ref}
      className={cn(
        'relative rounded-[1.75rem] p-2 sm:p-4',
        fill && 'flex h-full min-h-0 flex-col',
        className,
      )}
      style={{
        background: 'linear-gradient(150deg, #6b4a2b 0%, #4a301a 45%, #3a2513 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,225,180,0.35), inset 0 0 0 1px rgba(0,0,0,0.35), 0 12px 30px rgba(0,0,0,0.35)',
        ...style,
      }}
      {...rest}
    >
      {/* Felt surface */}
      <div
        className={cn(
          'relative overflow-hidden rounded-[1.15rem]',
          fill && 'flex min-h-0 flex-1 flex-col',
        )}
        style={{
          background:
            'radial-gradient(120% 105% at 50% 30%, color-mix(in srgb, var(--felt) 80%, white 8%), color-mix(in srgb, var(--felt) 94%, black 3%) 62%, color-mix(in srgb, var(--felt) 80%, black 14%))',
          boxShadow: 'inset 0 2px 18px rgba(0,0,0,0.4), inset 0 0 0 2px rgba(0,0,0,0.25)',
        }}
      >
        <div aria-hidden className="tbl-felt-noise" />

        {/* Table markings + betting arc */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <path id="tbl-arc-title" d="M 210 300 A 300 250 0 0 1 790 300" fill="none" />
            <path id="tbl-arc-rule" d="M 250 336 A 268 224 0 0 1 750 336" fill="none" />
          </defs>

          {/* "BLACKJACK PAYS 3 TO 2" curved over the felt */}
          {markings === 'full' && (
            <text
              fill={INK}
              fillOpacity="0.9"
              fontSize="34"
              fontWeight="700"
              letterSpacing="4"
              textAnchor="middle"
            >
              <textPath href="#tbl-arc-title" startOffset="50%">
                {PAYOUT_TEXT[blackjackPayout]}
              </textPath>
            </text>
          )}

          {/* Dealer rule line, smaller, below the payout arc */}
          {markings === 'full' && (
            <text
              fill={INK}
              fillOpacity="0.62"
              fontSize="19"
              fontWeight="600"
              letterSpacing="3"
              textAnchor="middle"
            >
              <textPath href="#tbl-arc-rule" startOffset="50%">
                {SOFT17_TEXT[soft17]}
              </textPath>
            </text>
          )}

          {/* Betting arc line */}
          <path
            d={`M ${ARC.p0.x} ${ARC.p0.y} Q ${ARC.p1.x} ${ARC.p1.y} ${ARC.p2.x} ${ARC.p2.y}`}
            fill="none"
            stroke={INK}
            strokeOpacity="0.28"
            strokeWidth="2.5"
          />
          <path
            d={`M ${ARC.p0.x} ${ARC.p0.y + 9} Q ${ARC.p1.x} ${ARC.p1.y + 9} ${ARC.p2.x} ${ARC.p2.y + 9}`}
            fill="none"
            stroke={INK}
            strokeOpacity="0.14"
            strokeWidth="1.5"
          />

          {/* Bet spots along the arc */}
          {spotPoints.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="26" fill="rgba(0,0,0,0.16)" />
              <circle
                cx={p.x}
                cy={p.y}
                r="26"
                fill="none"
                stroke={INK}
                strokeOpacity="0.4"
                strokeWidth="2"
                strokeDasharray="4 5"
              />
            </g>
          ))}
        </svg>

        <div aria-hidden className="tbl-felt-vignette" />

        {/* Live table contents */}
        <div className={cn('relative z-10', fill && 'flex min-h-0 flex-1 flex-col')}>{children}</div>
      </div>
    </div>
  )
})

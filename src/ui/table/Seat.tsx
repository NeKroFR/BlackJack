import { forwardRef } from 'react'
import type { CSSProperties, HTMLAttributes } from 'react'
import type { Card } from '../../engine/types'
import { cn } from '../cn'
import { Text } from '../Text'
import { CardHand } from './CardHand'
import { ChipStack } from './Chip'
import { cardWidth, type PlayingCardSize } from './PlayingCard'
import './table.css'

/** Settled outcome for a seat. Drives the win/lose/push glow. */
export type SeatResult = 'win' | 'blackjack' | 'lose' | 'push' | 'surrender'

export interface SeatProps extends HTMLAttributes<HTMLDivElement> {
  cards?: Card[]
  /** Bet amount. Renders a chip stack when > 0. */
  bet?: number
  /** Seat label, e.g. "You" or "Seat 3". */
  label?: string
  /** Highlight this seat as the one currently acting. */
  active?: boolean
  /** Force the empty placeholder even with no cards. */
  empty?: boolean
  size?: PlayingCardSize
  /** Index of a face-down hole card in `cards` (for dealer seats). */
  holeCardIndex?: number
  dealIn?: boolean
  /** Settled outcome. Applies a coloured win/lose/push glow around the seat. */
  result?: SeatResult
  /** Tighten padding and gaps — for height-constrained layouts (mobile felt). */
  dense?: boolean
  /** Hide the chip stack (the bet is shown elsewhere, e.g. the mobile dock). */
  hideBet?: boolean
}

const RESULT_GLOW: Record<SeatResult, string> = {
  win: 'var(--good)',
  blackjack: 'var(--good)',
  lose: 'var(--bad)',
  push: 'var(--accent)',
  surrender: 'var(--warn)',
}

/** A player seat: hand + bet + optional label. Highlights when active, glows on result. */
export const Seat = forwardRef<HTMLDivElement, SeatProps>(function Seat(
  {
    cards,
    bet,
    label,
    active = false,
    empty = false,
    size = 'md',
    holeCardIndex,
    dealIn = false,
    result,
    dense = false,
    hideBet = false,
    className,
    style,
    ...rest
  },
  ref,
) {
  const isEmpty = empty || !cards || cards.length === 0

  const glow = result ? RESULT_GLOW[result] : undefined
  const glowStyle: CSSProperties | undefined = glow
    ? {
        boxShadow: `0 0 0 2px color-mix(in srgb, ${glow} 55%, transparent), 0 0 18px color-mix(in srgb, ${glow} 45%, transparent)`,
        borderColor: `color-mix(in srgb, ${glow} 60%, transparent)`,
      }
    : undefined

  return (
    <div
      ref={ref}
      data-active={active || undefined}
      data-result={result || undefined}
      className={cn(
        'flex flex-col items-center rounded-xl border transition-[box-shadow,border-color] duration-150',
        dense ? 'gap-1 p-1.5' : 'gap-2 p-3',
        result ? 'tbl-seat-result' : active ? 'border-accent shadow-[var(--shadow-md)]' : 'border-transparent',
        className,
      )}
      style={{ ...glowStyle, ...style }}
      {...rest}
    >
      {isEmpty ? (
        <div
          className="flex items-center justify-center rounded-lg border border-dashed border-border text-ink-muted"
          style={{ width: cardWidth(size), aspectRatio: '5 / 7' }}
        >
          <span className="text-[0.625rem]">Open</span>
        </div>
      ) : (
        <CardHand cards={cards!} size={size} holeCardIndex={holeCardIndex} dealIn={dealIn} />
      )}

      {!hideBet && bet != null && bet > 0 && (
        <ChipStack amount={bet} size={size === 'lg' ? 'md' : 'sm'} showTotal={!dense} />
      )}

      {label && (
        <Text
          size={dense ? 'xs' : 'sm'}
          tone={active ? 'accent' : 'muted'}
          weight={active ? 'semibold' : 'medium'}
        >
          {label}
        </Text>
      )}
    </div>
  )
})

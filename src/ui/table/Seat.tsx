import { forwardRef } from 'react'
import type { CSSProperties, HTMLAttributes } from 'react'
import type { Card } from '../../engine/types'
import { cn } from '../cn'
import { Text } from '../Text'
import { CardHand } from './CardHand'
import { ChipStack } from './Chip'
import type { PlayingCardSize } from './PlayingCard'
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
}

const placeholderDims: Record<PlayingCardSize, string> = {
  sm: 'w-9 h-[3.25rem] rounded-md',
  md: 'w-14 h-20 rounded-lg',
  lg: 'w-[4.5rem] h-[6.5rem] rounded-lg',
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
  { cards, bet, label, active = false, empty = false, size = 'md', holeCardIndex, dealIn = false, result, className, style, ...rest },
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
        'flex flex-col items-center gap-2 rounded-xl p-3 border transition-[box-shadow,border-color] duration-150',
        result ? 'tbl-seat-result' : active ? 'border-accent shadow-[var(--shadow-md)]' : 'border-transparent',
        className,
      )}
      style={{ ...glowStyle, ...style }}
      {...rest}
    >
      {isEmpty ? (
        <div
          className={cn(
            'flex items-center justify-center border border-dashed border-border text-ink-muted',
            placeholderDims[size],
          )}
        >
          <span className="text-xs">Open</span>
        </div>
      ) : (
        <CardHand cards={cards!} size={size} holeCardIndex={holeCardIndex} dealIn={dealIn} />
      )}

      {bet != null && bet > 0 && <ChipStack amount={bet} size={size === 'lg' ? 'md' : 'sm'} />}

      {label && (
        <Text size="sm" tone={active ? 'accent' : 'muted'} weight={active ? 'semibold' : 'medium'}>
          {label}
        </Text>
      )}
    </div>
  )
})

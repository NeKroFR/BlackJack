import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import type { Card } from '../../engine/types'
import { handTotal, isBlackjack } from '../../engine/cards'
import { cn } from '../cn'
import { Badge } from '../Badge'
import { PlayingCard, cardWidth, type PlayingCardSize } from './PlayingCard'

export interface CardHandProps extends HTMLAttributes<HTMLDivElement> {
  cards: Card[]
  size?: PlayingCardSize
  /** Index of a face-down hole card (e.g. the dealer's second card). */
  holeCardIndex?: number
  /** Fan the cards with a slight rotation instead of a straight overlap. */
  fan?: boolean
  /** Show the hard/soft total badge (auto-hidden while a hole card is present). */
  showTotal?: boolean
  /** Animate the cards dealing in, staggered left-to-right. */
  dealIn?: boolean
}

// Horizontal overlap between adjacent cards, as a fraction of card width, so a
// hand tightens up in step with the cards when the table scales down.
const OVERLAP_RATIO = 0.39

type BadgeVariant = 'neutral' | 'good' | 'bad' | 'accent'

/** Lays out a hand with slight overlap/fan and shows a soft/hard total badge. */
export const CardHand = forwardRef<HTMLDivElement, CardHandProps>(function CardHand(
  { cards, size = 'md', holeCardIndex, fan = false, showTotal = true, dealIn = false, className, ...rest },
  ref,
) {
  const n = cards.length
  const hasHole = holeCardIndex != null && holeCardIndex >= 0 && holeCardIndex < n
  const visible = hasHole ? cards.filter((_, i) => i !== holeCardIndex) : cards
  const { total, soft } = handTotal(visible)

  const showBadge = showTotal && !hasHole && n > 0
  let badgeLabel = ''
  let badgeVariant: BadgeVariant = 'neutral'
  if (showBadge) {
    if (total > 21) {
      badgeLabel = 'Bust'
      badgeVariant = 'bad'
    } else if (isBlackjack(cards)) {
      badgeLabel = 'Blackjack'
      badgeVariant = 'accent'
    } else if (total === 21) {
      badgeLabel = '21'
      badgeVariant = 'good'
    } else {
      badgeLabel = soft ? `Soft ${total}` : `${total}`
    }
  }

  const overlap = `calc(${cardWidth(size)} * ${-OVERLAP_RATIO})`

  return (
    <div ref={ref} className={cn('inline-flex flex-col items-center gap-1.5', className)} {...rest}>
      <div className="flex items-end">
        {cards.map((card, i) => {
          const rot = fan ? (i - (n - 1) / 2) * 6 : 0
          return (
            <div
              key={card.id}
              style={{
                marginLeft: i === 0 ? 0 : overlap,
                transform: fan ? `rotate(${rot}deg)` : undefined,
                transformOrigin: 'bottom center',
                zIndex: i,
              }}
            >
              <PlayingCard
                card={card}
                faceDown={hasHole && i === holeCardIndex}
                size={size}
                dealIn={dealIn}
                style={dealIn ? { animationDelay: `${i * 60}ms` } : undefined}
              />
            </div>
          )
        })}
      </div>
      {showBadge && (
        <Badge variant={badgeVariant} size="sm" aria-label={`Hand total: ${badgeLabel}`}>
          {badgeLabel}
        </Badge>
      )}
    </div>
  )
})

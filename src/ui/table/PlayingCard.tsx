import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import type { Card, Rank, Suit } from '../../engine/types'
import { cn } from '../cn'
import './table.css'

export type PlayingCardSize = 'sm' | 'md' | 'lg'

export interface PlayingCardProps extends HTMLAttributes<HTMLDivElement> {
  /** The card to render. Omit (or set `faceDown`) to render the back. */
  card?: Card
  /** Show the back. Toggling this animates a 3D flip (unless reduced-motion). */
  faceDown?: boolean
  size?: PlayingCardSize
  /** Play a deal-in animation: slide + slight rotate from the shoe origin. */
  dealIn?: boolean
}

const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
const SUIT_NAME: Record<Suit, string> = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' }

const FACE_BG = '#fbfbf6'
const INK = '#1a1c22'
const RED = '#c62b38'

/**
 * Per-size card width: a CSS variable a layout can override (see `.tbl-fit-scale`
 * in table.css) with the fixed default as its fallback. Height and every glyph
 * follow from this one value.
 */
const CARD_WIDTH: Record<PlayingCardSize, string> = {
  sm: 'var(--tbl-card-sm, 2.25rem)',
  md: 'var(--tbl-card-md, 3.5rem)',
  lg: 'var(--tbl-card-lg, 4.5rem)',
}

/** The resolved CSS width expression for a card size. */
export function cardWidth(size: PlayingCardSize): string {
  return CARD_WIDTH[size]
}

/** Playing-card proportions: height / width, and the em ratios of the face. */
const ASPECT = '5 / 7'
const FONT_RATIO = 0.25

function rankLabel(rank: Rank): string {
  return rank === 'T' ? '10' : rank
}

/** Corner index (rank stacked over its suit glyph), reused top-left / bottom-right. */
function CornerIndex({ rank, glyph }: { rank: string; glyph: string }) {
  return (
    <span className="flex flex-col items-center leading-[0.9]">
      <span className="text-[1em] font-bold tabular-nums">{rank}</span>
      <span className="text-[0.72em]">{glyph}</span>
    </span>
  )
}

/**
 * A playing card. Renders both faces in a 3D flip container so toggling
 * `faceDown` animates a rotateY flip (the dealer's hole-card reveal). Face
 * content is decorative (`aria-hidden`). The accessible name lives on the
 * container and reflects the visible side.
 */
export const PlayingCard = forwardRef<HTMLDivElement, PlayingCardProps>(function PlayingCard(
  { card, faceDown = false, size = 'md', dealIn = false, className, style, ...rest },
  ref,
) {
  const w = CARD_WIDTH[size]
  const showBack = faceDown || !card
  const isRed = card ? card.suit === 'H' || card.suit === 'D' : false
  const color = isRed ? RED : INK
  const glyph = card ? SUIT_GLYPH[card.suit] : ''
  const rl = card ? rankLabel(card.rank) : ''

  return (
    <div
      ref={ref}
      role="img"
      aria-label={showBack ? 'Face-down card' : `${rl} of ${SUIT_NAME[card!.suit]}`}
      data-face={showBack ? 'down' : 'up'}
      className={cn('tbl-card relative shrink-0 select-none', dealIn && 'tbl-deal', className)}
      style={{
        width: w,
        aspectRatio: ASPECT,
        fontSize: `calc(${w} * ${FONT_RATIO})`,
        borderRadius: '0.57em',
        boxShadow: '0 1px 2px rgba(0,0,0,0.28), 0 5px 12px rgba(0,0,0,0.2)',
        ...style,
      }}
      {...rest}
    >
      <div className="tbl-card-inner">
        {/* Front */}
        <div
          aria-hidden
          className="tbl-card-face"
          style={{ background: FACE_BG, color, border: '1px solid rgba(0,0,0,0.16)' }}
        >
          {card && (
            <>
              <div className="absolute top-[0.28em] left-[0.42em]">
                <CornerIndex rank={rl} glyph={glyph} />
              </div>
              <div className="absolute inset-0 grid place-items-center text-[2.6em]">
                <span style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.08))' }}>{glyph}</span>
              </div>
              <div className="absolute bottom-[0.28em] right-[0.42em] rotate-180">
                <CornerIndex rank={rl} glyph={glyph} />
              </div>
            </>
          )}
        </div>

        {/* Back */}
        <div
          aria-hidden
          className="tbl-card-face tbl-card-back grid place-items-center"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--felt) 86%, black 6%), var(--felt))',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <div
            className="absolute inset-[0.28em] rounded-[0.35em] border"
            style={{
              borderColor: 'rgba(255,255,255,0.32)',
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(255,255,255,0.11) 0 3px, transparent 3px 7px),' +
                'repeating-linear-gradient(-45deg, rgba(255,255,255,0.11) 0 3px, transparent 3px 7px)',
            }}
          />
          <div
            className="relative rounded-full"
            style={{
              width: '46%',
              aspectRatio: '1',
              background:
                'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.28), rgba(255,255,255,0.06) 60%, transparent 70%)',
              border: '1px solid rgba(255,255,255,0.28)',
            }}
          />
        </div>
      </div>
    </div>
  )
})

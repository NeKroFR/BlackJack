import type { CSSProperties } from 'react'
import { Felt, Seat } from '../../ui/table'
import { Text } from '../../ui/Text'
import { Badge } from '../../ui/Badge'
import { cn } from '../../ui/cn'
import type { HandResult, RoundState } from '../../game/round'
import { signedMoney } from './format'

export interface TableFeltProps {
  state: RoundState
  /** Animate cards dealing in. */
  dealIn?: boolean
  /**
   * Height-constrained layout: fill the parent, scale the cards to the space
   * left over, and drop the labels that repeat what the dock already shows.
   */
  compact?: boolean
  className?: string
}

/**
 * The rules placard for the compact felt. The curved lettering is dropped there
 * (it collides with the cards on a narrow table), so the same information moves
 * into a corner chip.
 */
function RulesPlacard({ state }: { state: RoundState }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-1 right-2 text-[0.5625rem] font-semibold uppercase tracking-widest"
      style={{ color: 'var(--felt-ink)', opacity: 0.55 }}
    >
      {state.rules.blackjackPayout} · {state.rules.soft17}
    </div>
  )
}

const RESULT_META: Record<HandResult, { label: string; variant: 'good' | 'bad' | 'neutral' | 'warn' }> = {
  win: { label: 'Win', variant: 'good' },
  blackjack: { label: 'Blackjack', variant: 'good' },
  lose: { label: 'Lose', variant: 'bad' },
  push: { label: 'Push', variant: 'neutral' },
  surrender: { label: 'Surrender', variant: 'warn' },
}

/**
 * The felt: dealer at the top, other players in the middle, the hero's hand(s)
 * at the bottom. The active hero hand is highlighted during play, and each hero
 * hand shows its outcome once the round settles.
 */
export function TableFelt({ state, dealIn = true, compact = false, className }: TableFeltProps) {
  const { dealer, others, hero, phase, result, rules } = state
  const holeIndex = dealer.holeRevealed ? undefined : 1

  // Budget for `.tbl-fit-scale`: what the cards do not get (labels, badges,
  // padding) and how many card-heights still have to fit. Settling adds a
  // result badge under the hero, and side seats add a whole third row — both
  // would otherwise be clipped by the felt's overflow.
  const settled = phase === 'settled'
  const sideSeats = others.length > 0
  const chromeRem = 8.5 + (settled ? 1.75 : 0) + (sideSeats ? 1.5 : 0)
  const rows = 2.8 + (sideSeats ? 0.9 : 0)

  return (
    <Felt
      blackjackPayout={rules.blackjackPayout}
      soft17={rules.soft17}
      spots={Math.min(7, Math.max(3, others.length + 1))}
      markings={compact ? 'minimal' : 'full'}
      fill={compact}
      className={className}
    >
      <div
        style={
          compact
            ? ({ '--tbl-chrome': `${chromeRem}rem`, '--tbl-rows': String(rows) } as CSSProperties)
            : undefined
        }
        className={cn(
          'relative flex flex-col items-center',
          compact
            ? 'tbl-fit-scale min-h-0 flex-1 justify-around gap-1 px-1 py-2'
            : 'gap-6 px-2 py-4 sm:px-4 sm:py-6',
        )}
      >
      {compact && <RulesPlacard state={state} />}

      {/* Dealer */}
      <div className="flex flex-col items-center gap-1">
        <Text as="span" size="xs" weight="semibold" className="uppercase tracking-widest" style={{ color: 'var(--felt-ink)', opacity: 0.75 }}>
          Dealer
        </Text>
        {dealer.cards.length > 0 ? (
          <Seat cards={dealer.cards} size="md" holeCardIndex={holeIndex} dealIn={dealIn} dense={compact} />
        ) : (
          <Seat empty size="md" dense={compact} />
        )}
      </div>

      {/* Other players */}
      {others.length > 0 && (
        <div className={cn('flex flex-wrap items-start justify-center', compact ? 'gap-1' : 'gap-2')}>
          {others.map((o, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Seat cards={o.hand.cards} size="sm" dealIn={dealIn} dense={compact} />
              {!compact && (
                <Text as="span" size="xs" style={{ color: 'var(--felt-ink)', opacity: 0.6 }}>
                  Seat {i + 1}
                </Text>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hero */}
      <div className={cn('flex flex-wrap items-start justify-center', compact ? 'gap-1.5' : 'gap-3')}>
        {hero.hands.map((h, i) => {
          const active = phase === 'playerTurn' && i === hero.activeIndex
          const outcome = phase === 'settled' && result ? result.hands[i] : undefined
          const meta = outcome ? RESULT_META[outcome.result] : undefined
          const multi = hero.hands.length > 1
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <Seat
                cards={h.cards}
                bet={h.bet}
                size="md"
                active={active}
                dealIn={dealIn}
                result={outcome?.result}
                dense={compact}
                // On mobile the wager already sits in the dock, so the chip
                // stack only earns its height when there are hands to tell apart.
                hideBet={compact && !multi}
                label={multi ? `Hand ${i + 1}` : compact ? undefined : 'You'}
                className={cn(!active && !outcome && 'border-transparent')}
              />
              {meta && outcome && (
                <Badge variant={meta.variant} size="sm">
                  {meta.label} {outcome.pnl !== 0 ? signedMoney(outcome.pnl) : ''}
                </Badge>
              )}
            </div>
          )
        })}
      </div>
      </div>
    </Felt>
  )
}

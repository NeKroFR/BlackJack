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
export function TableFelt({ state, dealIn = true }: TableFeltProps) {
  const { dealer, others, hero, phase, result, rules } = state
  const holeIndex = dealer.holeRevealed ? undefined : 1

  return (
    <Felt
      blackjackPayout={rules.blackjackPayout}
      soft17={rules.soft17}
      spots={Math.min(7, Math.max(3, others.length + 1))}
    >
      <div className="flex flex-col items-center gap-6 px-2 py-4 sm:px-4 sm:py-6">
      {/* Dealer */}
      <div className="flex flex-col items-center gap-1">
        <Text as="span" size="xs" weight="semibold" className="uppercase tracking-widest" style={{ color: 'var(--felt-ink)', opacity: 0.75 }}>
          Dealer
        </Text>
        {dealer.cards.length > 0 ? (
          <Seat cards={dealer.cards} size="md" holeCardIndex={holeIndex} dealIn={dealIn} />
        ) : (
          <Seat empty size="md" />
        )}
      </div>

      {/* Other players */}
      {others.length > 0 && (
        <div className="flex flex-wrap items-start justify-center gap-2">
          {others.map((o, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Seat cards={o.hand.cards} size="sm" dealIn={dealIn} />
              <Text as="span" size="xs" style={{ color: 'var(--felt-ink)', opacity: 0.6 }}>
                Seat {i + 1}
              </Text>
            </div>
          ))}
        </div>
      )}

      {/* Hero */}
      <div className="flex flex-wrap items-start justify-center gap-3">
        {hero.hands.map((h, i) => {
          const active = phase === 'playerTurn' && i === hero.activeIndex
          const outcome = phase === 'settled' && result ? result.hands[i] : undefined
          const meta = outcome ? RESULT_META[outcome.result] : undefined
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <Seat
                cards={h.cards}
                bet={h.bet}
                size="md"
                active={active}
                dealIn={dealIn}
                result={outcome?.result}
                label={hero.hands.length > 1 ? `Hand ${i + 1}` : 'You'}
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

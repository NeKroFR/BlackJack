import { Panel } from '../../ui/Panel'
import { Text } from '../../ui/Text'
import { Button } from '../../ui/Button'
import { Inline } from '../../ui/Inline'
import { Chip, ChipStack } from '../../ui/table'
import { useSound } from '../../audio'
import { CHIP_DENOMS, TABLE_MAX } from './useTableGame'
import { money } from './format'

export interface BetControlsProps {
  pendingBet: number
  addChip: (denom: number) => void
  clearBet: () => void
  setPendingBet: (n: number) => void
  tableMin: number
  effectiveMax: number
  bankroll: number
  canDeal: boolean
  busted: boolean
  onDeal: () => void
  rebuy: (amount: number) => void
  /** Label for the primary action (e.g. "Deal" vs "Next hand"). */
  dealLabel?: string
}

/**
 * Chip-based bet builder. Tap denominations to build a wager, respecting the
 * table limits and the live bankroll (which can bust). The single primary
 * action is Deal.
 */
export function BetControls({
  pendingBet,
  addChip,
  clearBet,
  setPendingBet,
  tableMin,
  effectiveMax,
  bankroll,
  canDeal,
  busted,
  onDeal,
  rebuy,
  dealLabel = 'Deal',
}: BetControlsProps) {
  const play = useSound()
  if (busted) {
    return (
      <Panel padding="lg" elevation="raised" className="flex flex-col items-center gap-3 text-center">
        <Text size="lg" weight="semibold" tone="bad">
          Out of chips
        </Text>
        <Text size="sm" tone="muted" className="max-w-md">
          Your session bankroll dropped below the ${tableMin} table minimum. Rebuy to keep playing — your
          count and shoe carry over.
        </Text>
        <Inline gap={2} wrap justify="center">
          <Button variant="secondary" onClick={() => rebuy(500)}>
            Rebuy {money(500)}
          </Button>
          <Button variant="primary" onClick={() => rebuy(1000)}>
            Rebuy {money(1000)}
          </Button>
        </Inline>
      </Panel>
    )
  }

  const belowMin = pendingBet < tableMin

  return (
    <Panel padding="lg" elevation="raised" className="flex flex-col gap-4">
      <Inline justify="between" align="center" wrap className="gap-2">
        <Text size="sm" weight="medium">
          Place your bet
        </Text>
        <Text size="xs" tone="muted" numeric>
          Table {money(tableMin)}–{money(TABLE_MAX)} · Bankroll {money(bankroll)}
        </Text>
      </Inline>

      <Inline gap={4} align="center" wrap>
        <div className="min-w-[4.5rem]">
          {pendingBet > 0 ? (
            <ChipStack amount={pendingBet} size="md" />
          ) : (
            <Text size="lg" tone="muted" numeric>
              $0
            </Text>
          )}
        </div>

        <Inline gap={2} wrap>
          {CHIP_DENOMS.map((d) => {
            const disabled = pendingBet + d > effectiveMax
            return (
              <button
                key={d}
                type="button"
                aria-label={`Add ${money(d)} chip`}
                disabled={disabled}
                onClick={() => {
                  play('chip')
                  addChip(d)
                }}
                className="rounded-full transition-transform duration-150 hover:-translate-y-0.5 disabled:opacity-35 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              >
                <Chip value={d} size="md" />
              </button>
            )
          })}
        </Inline>
      </Inline>

      <Inline justify="between" align="center" wrap className="gap-2">
        <Inline gap={2} wrap>
          <Button size="sm" variant="ghost" onClick={clearBet} disabled={pendingBet === 0}>
            Clear
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { play('chip'); setPendingBet(tableMin) }}>
            Min
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { play('chipStack'); setPendingBet(effectiveMax) }}>
            Max
          </Button>
        </Inline>
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            play('chipStack')
            onDeal()
          }}
          disabled={!canDeal}
        >
          {dealLabel}
        </Button>
      </Inline>

      {belowMin && pendingBet > 0 && (
        <Text size="xs" tone="warn">
          Minimum bet is {money(tableMin)}.
        </Text>
      )}
    </Panel>
  )
}

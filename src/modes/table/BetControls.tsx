import type { ReactNode } from 'react'
import { Panel } from '../../ui/Panel'
import { Text } from '../../ui/Text'
import { Button } from '../../ui/Button'
import { Inline } from '../../ui/Inline'
import { cn } from '../../ui/cn'
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
  /**
   * Touch layout: one tight column — readout, chip row, then a full-width Deal.
   * Trades the roomy desktop arrangement for a dock that fits under the felt.
   */
  compact?: boolean
  /** Extra content above the chips (e.g. the settled-hand summary on mobile). */
  header?: ReactNode
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
  compact = false,
  header,
}: BetControlsProps) {
  const play = useSound()

  /** A denomination button. Sized for a thumb in the compact dock. */
  const chipButton = (d: number) => {
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
        className={cn(
          'rounded-full transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0',
          'disabled:opacity-35 disabled:pointer-events-none focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2',
          'focus-visible:ring-offset-[var(--bg)]',
        )}
      >
        <Chip value={d} size="md" />
      </button>
    )
  }

  // Tighter in the dock so they stay on the bet row: wrapping them onto their
  // own line costs the felt about 40px of card height.
  const quickClass = compact ? 'px-2 text-xs' : undefined
  const quickButtons = (
    <>
      <Button size="sm" variant="ghost" className={quickClass} onClick={clearBet} disabled={pendingBet === 0}>
        Clear
      </Button>
      <Button size="sm" variant="ghost" className={quickClass} onClick={() => { play('chip'); setPendingBet(tableMin) }}>
        Min
      </Button>
      <Button size="sm" variant="ghost" className={quickClass} onClick={() => { play('chipStack'); setPendingBet(effectiveMax) }}>
        Max
      </Button>
    </>
  )

  const deal = () => {
    play('chipStack')
    onDeal()
  }

  if (busted) {
    return (
      <Panel
        padding={compact ? 'md' : 'lg'}
        elevation="raised"
        className="flex flex-col items-center gap-3 text-center"
      >
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

  if (compact) {
    return (
      <Panel padding="none" elevation="raised" className="flex flex-col gap-2 p-2.5">
        {header}

        <Inline justify="between" align="center" wrap className="gap-2">
          <Inline gap={2} align="baseline">
            <Text as="span" size="sm" weight="medium">
              Place your bet
            </Text>
            <Text as="span" size="lg" weight="semibold" tone={pendingBet > 0 ? 'accent' : 'muted'} numeric>
              {money(pendingBet)}
            </Text>
          </Inline>
          <Inline gap={1}>{quickButtons}</Inline>
        </Inline>

        {/* Chips scroll sideways rather than wrapping into a second row, which
            would cost the felt another line of height. */}
        <div className="-mx-2.5 flex gap-2 overflow-x-auto px-2.5 pb-0.5">
          {CHIP_DENOMS.map(chipButton)}
        </div>

        <Button variant="primary" block onClick={deal} disabled={!canDeal} className="h-13 text-base">
          {dealLabel}
        </Button>

        {belowMin && pendingBet > 0 && (
          <Text size="xs" tone="warn">
            Minimum bet is {money(tableMin)}.
          </Text>
        )}
      </Panel>
    )
  }

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
          {CHIP_DENOMS.map(chipButton)}
        </Inline>
      </Inline>

      <Inline justify="between" align="center" wrap className="gap-2">
        <Inline gap={2} wrap>
          {quickButtons}
        </Inline>
        <Button variant="primary" size="lg" onClick={deal} disabled={!canDeal}>
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

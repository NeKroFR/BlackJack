import { Stack, Inline, Text, Button, NumberStepper, IconButton } from '../../ui'
import type { BetRamp, BetTier } from '../../engine/betting'

export interface BetRampEditorProps {
  ramp: BetRamp
  onChange: (ramp: BetRamp) => void
  /** Dollar value of one unit, for showing the dollar amount of each rung. */
  unit: number
}

/** Sort a ramp ascending by true count so rungs read top-to-bottom. */
function sorted(ramp: BetRamp): BetRamp {
  return [...ramp].sort((a, b) => a.minTrueCount - b.minTrueCount)
}

const money = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/**
 * Editable bet ramp: one row per rung mapping a true count to a number of units.
 * Add/remove rungs and adjust each tier's TC threshold and unit size.
 */
export function BetRampEditor({ ramp, onChange, unit }: BetRampEditorProps) {
  const rows = sorted(ramp)

  const update = (idx: number, patch: Partial<BetTier>) => {
    const next = rows.map((t, i) => (i === idx ? { ...t, ...patch } : t))
    onChange(next)
  }
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx))
  const add = () => {
    const maxTc = rows.reduce((m, t) => Math.max(m, t.minTrueCount), 0)
    const maxUnits = rows.reduce((m, t) => Math.max(m, t.units), 0)
    onChange([...rows, { minTrueCount: maxTc + 1, units: Math.max(1, maxUnits) }])
  }

  return (
    <Stack gap={3}>
      <div
        className="grid items-center gap-x-3 gap-y-2"
        style={{ gridTemplateColumns: 'auto 1fr auto auto' }}
      >
        <Text size="xs" tone="muted" className="uppercase tracking-wide">
          True count ≥
        </Text>
        <Text size="xs" tone="muted" className="uppercase tracking-wide">
          Units
        </Text>
        <Text size="xs" tone="muted" className="text-right uppercase tracking-wide">
          Bet
        </Text>
        <span aria-hidden />
        {rows.map((tier, idx) => (
          <RampRow
            key={idx}
            tier={tier}
            unit={unit}
            money={money}
            canRemove={rows.length > 1}
            onTc={(v) => update(idx, { minTrueCount: v })}
            onUnits={(v) => update(idx, { units: v })}
            onRemove={() => remove(idx)}
          />
        ))}
      </div>
      <Inline justify="between" align="center" wrap className="gap-2">
        <Button variant="secondary" size="sm" onClick={add}>
          + Add rung
        </Button>
        <Text size="xs" tone="muted">
          Below the lowest rung the ramp sits out (bets nothing).
        </Text>
      </Inline>
    </Stack>
  )
}

function RampRow({
  tier,
  unit,
  money,
  canRemove,
  onTc,
  onUnits,
  onRemove,
}: {
  tier: BetTier
  unit: number
  money: (n: number) => string
  canRemove: boolean
  onTc: (v: number) => void
  onUnits: (v: number) => void
  onRemove: () => void
}) {
  return (
    <>
      <NumberStepper
        value={tier.minTrueCount}
        onChange={onTc}
        min={-5}
        max={15}
        step={1}
        size="sm"
      />
      <NumberStepper value={tier.units} onChange={onUnits} min={0} max={100} step={1} size="sm" />
      <Text size="sm" weight="medium" className="text-right tabular-nums">
        {money(tier.units * unit)}
      </Text>
      <IconButton
        label={`Remove rung at true count ${tier.minTrueCount}`}
        size="sm"
        variant="ghost"
        disabled={!canRemove}
        onClick={onRemove}
      >
        ✕
      </IconButton>
    </>
  )
}

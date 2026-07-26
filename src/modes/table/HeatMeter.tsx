import { Panel } from '../../ui/Panel'
import { Text } from '../../ui/Text'
import { Badge } from '../../ui/Badge'
import { Inline } from '../../ui/Inline'
import { HEAT_META, heatLevel } from './heat'

export interface HeatMeterProps {
  heat: number
}

const FILL: Record<'good' | 'warn' | 'bad', string> = {
  good: 'var(--good)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
}

const BADGE: Record<'good' | 'warn' | 'bad', 'good' | 'warn' | 'bad'> = {
  good: 'good',
  warn: 'warn',
  bad: 'bad',
}

/** Camouflage gauge: how much attention your bet spread is drawing. */
export function HeatMeter({ heat }: HeatMeterProps) {
  const level = heatLevel(heat)
  const meta = HEAT_META[level]
  const pct = Math.round(Math.min(1, Math.max(0, heat)) * 100)

  return (
    <Panel padding="md" elevation="raised" className="flex flex-col gap-2">
      <Inline justify="between" align="center">
        <Text as="span" size="xs" tone="muted" weight="semibold" className="uppercase tracking-wide">
          Heat
        </Text>
        <Badge variant={BADGE[meta.tone]} size="sm">
          {meta.label}
        </Badge>
      </Inline>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Camouflage heat"
      >
        <div
          className="h-full rounded-full transition-[width,background-color] duration-300"
          style={{ width: `${pct}%`, background: FILL[meta.tone] }}
        />
      </div>
      <Text size="xs" tone="muted">
        {meta.tip}
      </Text>
    </Panel>
  )
}

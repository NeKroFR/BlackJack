import type { ReactNode } from 'react'
import { Panel } from '../Panel'
import { Text } from '../Text'
import { Badge } from '../Badge'
import { Inline } from '../Inline'
import { cn } from '../cn'
import { ACTION_META, formatCount, formatEv } from './actions'
import type { Action } from '../../engine/types'

export type HudVariant = 'minimal' | 'full'

export interface HudAdvice {
  action: Action
  /** EV of the recommended action, in units of base bet. */
  ev?: number
}

export interface HudProps {
  /** Running count for the active system. */
  runningCount: number
  /** True count. Omit for unbalanced systems (KO) that only track running count. */
  trueCount?: number
  /** Estimated decks remaining in the shoe. */
  decksRemaining: number
  /** Current wager, in currency units. Shown in full variant when provided. */
  bet?: number
  /** Recommended play + EV (advice mode). Shown in full variant when provided. */
  advice?: HudAdvice
  /** Counting-system label, e.g. "Hi-Lo". */
  systemName?: string
  /** Currency prefix for the bet readout (default "$"). */
  currency?: string
  /** `minimal` = stripped-down drill HUD. `full` = labeled panel with bet + advice. */
  variant?: HudVariant
  className?: string
}

/** Color a signed count by sign: good (positive) / bad (negative) / muted (zero). */
function countTone(n: number): 'good' | 'bad' | 'muted' {
  if (n > 0) return 'good'
  if (n < 0) return 'bad'
  return 'muted'
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  tone?: 'default' | 'muted' | 'good' | 'bad' | 'accent'
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <Text as="span" size="xs" tone="muted" weight="medium" className="uppercase tracking-wide">
        {label}
      </Text>
      <Text as="span" size="lg" weight="semibold" tone={tone} numeric>
        {value}
      </Text>
    </div>
  )
}

/**
 * Compact count/bet/advice overlay for live play and drills. `variant` scales
 * the chrome: `minimal` is a bare inline readout for speed drills, `full` is a
 * bordered panel with labels, the current bet, and (optional) advice.
 */
export function Hud({
  runningCount,
  trueCount,
  decksRemaining,
  bet,
  advice,
  systemName,
  currency = '$',
  variant = 'full',
  className,
}: HudProps) {
  const adviceMeta = advice ? ACTION_META[advice.action] : undefined

  if (variant === 'minimal') {
    return (
      <Inline
        gap={3}
        wrap
        className={cn('font-medium', className)}
        aria-label="Count readout"
      >
        <Inline gap={1}>
          <Text as="span" size="xs" tone="muted">
            RC
          </Text>
          <Text as="span" size="md" weight="semibold" tone={countTone(runningCount)} numeric>
            {formatCount(runningCount)}
          </Text>
        </Inline>
        {trueCount !== undefined && (
          <Inline gap={1}>
            <Text as="span" size="xs" tone="muted">
              TC
            </Text>
            <Text as="span" size="md" weight="semibold" tone={countTone(trueCount)} numeric>
              {formatCount(trueCount, 1)}
            </Text>
          </Inline>
        )}
        <Inline gap={1}>
          <Text as="span" size="xs" tone="muted">
            Decks
          </Text>
          <Text as="span" size="md" weight="semibold" numeric>
            {decksRemaining.toFixed(1)}
          </Text>
        </Inline>
      </Inline>
    )
  }

  return (
    <Panel
      padding="md"
      elevation="raised"
      className={cn('flex flex-col gap-3', className)}
      aria-label="Heads-up display"
    >
      {systemName && (
        <Inline justify="between">
          <Badge variant="outline" size="sm">
            {systemName}
          </Badge>
        </Inline>
      )}
      <Inline gap={5} wrap>
        <Stat label="Running" value={formatCount(runningCount)} tone={countTone(runningCount)} />
        {trueCount !== undefined && (
          <Stat label="True" value={formatCount(trueCount, 1)} tone={countTone(trueCount)} />
        )}
        <Stat label="Decks" value={decksRemaining.toFixed(1)} />
        {bet !== undefined && (
          <Stat label="Bet" value={`${currency}${bet.toLocaleString()}`} tone="accent" />
        )}
      </Inline>
      {advice && adviceMeta && (
        <Inline gap={2} className="border-t border-border pt-3" justify="between">
          <Inline gap={2}>
            <Text as="span" size="xs" tone="muted" weight="medium" className="uppercase tracking-wide">
              Play
            </Text>
            <Badge variant="accent" size="md">
              {adviceMeta.label}
            </Badge>
          </Inline>
          {advice.ev !== undefined && (
            <Text as="span" size="sm" tone="muted" numeric>
              EV {formatEv(advice.ev)}
            </Text>
          )}
        </Inline>
      )}
    </Panel>
  )
}

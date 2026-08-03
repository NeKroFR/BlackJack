import { Panel } from '../../ui/Panel'
import { Text } from '../../ui/Text'
import { Badge } from '../../ui/Badge'
import { Stack } from '../../ui/Stack'
import { Inline } from '../../ui/Inline'
import { ACTION_META, formatEv } from '../../ui/game'
import type { DecisionRecord } from './useTableGame'
import { signedMoney } from './format'

export interface PostHandFeedbackProps {
  pnl: number
  decisions: DecisionRecord[]
  /** Collapse to a single unpanelled line — for the mobile dock, where the
   *  per-decision breakdown would push the bet controls off screen. */
  compact?: boolean
}

/**
 * After a round settles: the net result plus a per-decision breakdown showing
 * each play's EV and whether it matched the engine's best line. This is where
 * the running "EV of your decisions" feedback lives.
 */
export function PostHandFeedback({ pnl, decisions, compact = false }: PostHandFeedbackProps) {
  const tone = pnl > 0 ? 'good' : pnl < 0 ? 'bad' : 'muted'
  const label = pnl > 0 ? 'You won' : pnl < 0 ? 'You lost' : 'Push'
  const mistakes = decisions.filter((d) => !d.correct).length

  if (compact) {
    return (
      <Inline justify="between" align="center" className="gap-2 border-b border-border pb-2">
        <Inline gap={2} align="baseline">
          <Text size="sm" weight="semibold" tone={tone}>
            {label}
          </Text>
          <Text size="sm" weight="semibold" tone={tone} numeric>
            {signedMoney(pnl)}
          </Text>
        </Inline>
        {decisions.length > 0 && (
          <Badge variant={mistakes === 0 ? 'good' : 'warn'} size="sm">
            {mistakes === 0 ? 'All plays optimal' : `${mistakes} misplay${mistakes > 1 ? 's' : ''}`}
          </Badge>
        )}
      </Inline>
    )
  }

  return (
    <Panel padding="md" elevation="raised" className="flex flex-col gap-3">
      <Inline justify="between" align="center" wrap className="gap-2">
        <Inline gap={2} align="center">
          <Text size="lg" weight="semibold" tone={tone}>
            {label}
          </Text>
          <Text size="lg" weight="semibold" tone={tone} numeric>
            {signedMoney(pnl)}
          </Text>
        </Inline>
        {decisions.length > 0 && (
          <Badge variant={mistakes === 0 ? 'good' : 'warn'} size="sm">
            {mistakes === 0 ? 'All plays optimal' : `${mistakes} misplay${mistakes > 1 ? 's' : ''}`}
          </Badge>
        )}
      </Inline>

      {decisions.length > 0 && (
        <Stack gap={1}>
          {decisions.map((d, i) => (
            <Inline key={i} justify="between" align="center" className="gap-2 border-t border-border pt-1 first:border-0 first:pt-0">
              <Inline gap={2} align="center">
                <span
                  aria-hidden
                  className={
                    'flex h-4 w-4 items-center justify-center rounded-full text-[0.625rem] font-bold ' +
                    (d.correct ? 'bg-good text-good-ink' : 'bg-bad text-bad-ink')
                  }
                >
                  {d.correct ? '✓' : '✗'}
                </span>
                <Text size="sm">
                  {ACTION_META[d.chosen].label}
                  {!d.correct && (
                    <Text as="span" size="sm" tone="muted">
                      {' '}→ best {ACTION_META[d.best].label}
                    </Text>
                  )}
                </Text>
              </Inline>
              <Text as="span" size="xs" tone={d.correct ? 'muted' : 'bad'} numeric>
                {d.correct ? `EV ${formatEv(d.chosenEv)}` : `${formatEv(d.evDelta)} EV`}
              </Text>
            </Inline>
          ))}
        </Stack>
      )}
    </Panel>
  )
}

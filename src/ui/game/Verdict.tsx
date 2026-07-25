import { Panel } from '../Panel'
import { Text } from '../Text'
import { Badge } from '../Badge'
import { Stack } from '../Stack'
import { Inline } from '../Inline'
import { cn } from '../cn'
import { ACTION_META } from './actions'
import type { Action } from '../../engine/types'

export interface VerdictProps {
  /** Whether the player's choice matched the engine's best action. */
  correct: boolean
  /** The engine's best action. */
  correctAction: Action
  /** What the player actually chose (shown when incorrect). */
  chosenAction?: Action
  /** Engine `Decision.explanation`: the "why", citing top actions + EVs. */
  explanation?: string
  className?: string
}

/**
 * Post-decision feedback: correct vs incorrect with the right play and the EV
 * explanation. Distinguishes states by both color (`--good`/`--bad`, which the
 * colorblind palette re-maps to blue/orange) and glyph (✓ / ✗) so it reads in
 * all theme + colorblind combinations. Animates in (motion-safe).
 */
export function Verdict({
  correct,
  correctAction,
  chosenAction,
  explanation,
  className,
}: VerdictProps) {
  const correctMeta = ACTION_META[correctAction]
  const showChosen =
    !correct && chosenAction !== undefined && chosenAction !== correctAction
  const chosenMeta = showChosen ? ACTION_META[chosenAction] : undefined

  return (
    <Panel
      role="status"
      aria-live="polite"
      padding="md"
      elevation="raised"
      className={cn(
        'motion-safe:animate-in border-l-4',
        correct ? 'border-l-good' : 'border-l-bad',
        className,
      )}
    >
      <Stack gap={2}>
        <Inline gap={2}>
          <span
            aria-hidden
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold',
              correct ? 'bg-good text-good-ink' : 'bg-bad text-bad-ink',
            )}
          >
            {correct ? '✓' : '✗'}
          </span>
          <Text as="span" size="lg" weight="semibold" tone={correct ? 'good' : 'bad'}>
            {correct ? 'Correct' : 'Not quite'}
          </Text>
        </Inline>

        {!correct && (
          <Inline gap={2} wrap>
            {chosenMeta && (
              <Inline gap={1}>
                <Text as="span" size="sm" tone="muted">
                  You played
                </Text>
                <Badge variant="bad" size="sm">
                  {chosenMeta.label}
                </Badge>
              </Inline>
            )}
            <Inline gap={1}>
              <Text as="span" size="sm" tone="muted">
                Best play
              </Text>
              <Badge variant="good" size="sm">
                {correctMeta.label}
              </Badge>
            </Inline>
          </Inline>
        )}

        {explanation && (
          <Text size="sm" tone="muted">
            {explanation}
          </Text>
        )}
      </Stack>
    </Panel>
  )
}

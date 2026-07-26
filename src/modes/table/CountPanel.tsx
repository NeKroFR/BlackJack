import { Panel } from '../../ui/Panel'
import { Text } from '../../ui/Text'
import { Button } from '../../ui/Button'
import { Inline } from '../../ui/Inline'
import { formatCount } from '../../ui/game'

export interface CountPanelProps {
  revealed: boolean
  onToggle: () => void
  runningCount: number
  trueCount: number
  usesTrueCount: boolean
  decksRemaining: number
  systemName: string
  /** 0..1 fraction of the shoe dealt. */
  shoeProgress: number
  /** 0..1 cut-card position (penetration). */
  penetration: number
}

function countTone(n: number): 'good' | 'bad' | 'muted' {
  if (n > 0) return 'good'
  if (n < 0) return 'bad'
  return 'muted'
}

/**
 * The count is the player's job here, so it stays hidden behind a reveal button.
 * Decks remaining and shoe penetration are always shown: that's table-visible
 * information (the discard tray), and you need it to convert to a true count.
 */
export function CountPanel({
  revealed,
  onToggle,
  runningCount,
  trueCount,
  usesTrueCount,
  decksRemaining,
  systemName,
  shoeProgress,
  penetration,
}: CountPanelProps) {
  return (
    <Panel padding="md" elevation="raised" className="flex flex-col gap-3">
      <Inline justify="between" align="center">
        <Text as="span" size="xs" tone="muted" weight="semibold" className="uppercase tracking-wide">
          {systemName}
        </Text>
        <Button size="sm" variant="ghost" onClick={onToggle}>
          {revealed ? 'Hide count' : 'Reveal count'}
        </Button>
      </Inline>

      <Inline gap={5} wrap>
        <div className="flex flex-col gap-0.5">
          <Text as="span" size="xs" tone="muted" weight="medium" className="uppercase tracking-wide">
            Running
          </Text>
          {revealed ? (
            <Text as="span" size="lg" weight="semibold" tone={countTone(runningCount)} numeric>
              {formatCount(runningCount, Number.isInteger(runningCount) ? 0 : 1)}
            </Text>
          ) : (
            <Text as="span" size="lg" weight="semibold" tone="muted" aria-label="hidden">
              ••
            </Text>
          )}
        </div>

        {usesTrueCount && (
          <div className="flex flex-col gap-0.5">
            <Text as="span" size="xs" tone="muted" weight="medium" className="uppercase tracking-wide">
              True
            </Text>
            {revealed ? (
              <Text as="span" size="lg" weight="semibold" tone={countTone(trueCount)} numeric>
                {formatCount(trueCount)}
              </Text>
            ) : (
              <Text as="span" size="lg" weight="semibold" tone="muted" aria-label="hidden">
                ••
              </Text>
            )}
          </div>
        )}

        <div className="flex flex-col gap-0.5">
          <Text as="span" size="xs" tone="muted" weight="medium" className="uppercase tracking-wide">
            Decks left
          </Text>
          <Text as="span" size="lg" weight="semibold" numeric>
            {decksRemaining.toFixed(1)}
          </Text>
        </div>
      </Inline>

      {/* Shoe penetration with the cut-card marker. */}
      <div className="flex flex-col gap-1">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${Math.round(shoeProgress * 100)}%` }}
          />
          <div
            aria-hidden
            className="absolute top-[-2px] h-3 w-0.5 bg-bad"
            style={{ left: `calc(${Math.round(penetration * 100)}% - 1px)` }}
          />
        </div>
        <Text as="span" size="xs" tone="muted">
          Cut card at {Math.round(penetration * 100)}% penetration
        </Text>
      </div>
    </Panel>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Panel, Text, Stack, Inline, Badge, Button, Card as CardSurface, cn } from '../../ui'
import { CardHand, PlayingCard } from '../../ui'
import { ActionBar, Verdict, type ActionSlot } from '../../ui/game'
import { useSound } from '../../audio'
import type { Action, Rules } from '../../engine/types'
import type { TrainingApi } from '../../training'
import type { Rng } from '../../engine/cards'
import {
  buildDrills,
  correctActionAt,
  explainDrill,
  matchupLabel,
  offeredActions,
  signed,
  thresholdText,
  type DeviationDrill,
} from './data'

export interface PlayDeviationProps {
  rules: Rules
  training: TrainingApi
  /** Injectable RNG for deterministic tests (defaults to Math.random). */
  rng?: Rng
}

interface Round {
  drill: DeviationDrill
  trueCount: number
}

const TC_OFFSETS = [-3, -2, -1, 0, 1, 2, 3]
const clampTc = (n: number) => Math.max(-6, Math.min(9, n))

/** Sub-mode 1: hand + dealer up + a true count → pick the correct play. */
export function PlayDeviation({ rules, training, rng = Math.random }: PlayDeviationProps) {
  const drills = useMemo(() => buildDrills(rules), [rules])
  const byKey = useMemo(() => new Map(drills.map((d) => [d.key, d])), [drills])
  const pool = useMemo(() => drills.map((d) => d.key), [drills])

  const [round, setRound] = useState<Round | null>(null)
  const [chosen, setChosen] = useState<Action | null>(null)
  const play = useSound()
  const rngRef = useRef(rng)
  rngRef.current = rng

  const deal = useCallback(() => {
    const r = rngRef.current
    const key = training.pickNext(pool) ?? pool[Math.floor(r() * pool.length)]
    const drill = byKey.get(key) ?? drills[0]
    const offset = TC_OFFSETS[Math.floor(r() * TC_OFFSETS.length)]
    setChosen(null)
    setRound({ drill, trueCount: clampTc(drill.index + offset) })
  }, [byKey, drills, pool, training])

  useEffect(() => {
    deal()
    // Re-deal a fresh hand whenever the rules (and therefore the pool) change.
  }, [deal])

  const answer = useCallback(
    (action: Action) => {
      if (!round || chosen) return
      const best = correctActionAt(round.drill, round.trueCount)
      setChosen(action)
      play(action === best ? 'correct' : 'incorrect')
      training.record({
        category: 'deviations',
        correct: action === best,
        chosen: action,
        best,
        handContext: {
          playerCards: round.drill.cards,
          dealerUp: round.drill.dealerUpValue,
          trueCount: round.trueCount,
        },
        srKey: round.drill.key,
      })
    },
    [round, chosen, training, play],
  )

  if (!round) return null
  const { drill, trueCount } = round
  const best = correctActionAt(drill, trueCount)
  const answered = chosen !== null
  const offered = offeredActions(drill, rules)

  const slot = (action: Action): ActionSlot =>
    offered.has(action)
      ? { onClick: () => answer(action), disabled: answered }
      : { onClick: () => {}, hidden: true }

  const tcColor = trueCount > 0 ? 'text-good' : trueCount < 0 ? 'text-bad' : 'text-ink'

  return (
    <Stack gap={4}>
      <Panel padding="lg" elevation="raised">
        <Stack gap={5} align="center">
          <Inline gap={8} justify="center" align="center" wrap className="w-full">
            <Stack gap={1} align="center">
              <Text size="xs" tone="muted" className="uppercase tracking-wide">
                Dealer
              </Text>
              <PlayingCard card={drill.upCard} size="lg" />
            </Stack>
            <Stack gap={1} align="center">
              <Text size="xs" tone="muted" className="uppercase tracking-wide">
                Your hand
              </Text>
              <CardHand cards={drill.cards} size="lg" />
            </Stack>
          </Inline>

          <CardSurface inset padding="sm" className="min-w-28 text-center">
            <Text size="xs" tone="muted" className="uppercase tracking-wide">
              True count
            </Text>
            <div className={cn('text-4xl font-bold tabular-nums', tcColor)}>
              {signed(trueCount)}
            </div>
          </CardSurface>

          <Text size="sm" tone="muted">
            {matchupLabel(drill)} — what is the correct play at this count?
          </Text>
        </Stack>
      </Panel>

      <ActionBar
        hit={slot('hit')}
        stand={slot('stand')}
        double={slot('double')}
        split={slot('split')}
        surrender={slot('surrender')}
        recommend={answered ? best : undefined}
        onSpace={answered ? deal : undefined}
        block
      />

      {answered && (
        <Stack gap={3}>
          <Verdict
            correct={chosen === best}
            correctAction={best}
            chosenAction={chosen ?? undefined}
            explanation={explainDrill(drill, trueCount)}
          />
          <Inline justify="between" align="center" wrap className="gap-3">
            <Text size="sm" tone="muted">
              {thresholdText(drill)}
            </Text>
            <Button variant="primary" onClick={deal}>
              Next hand
              <Badge variant="outline" size="sm" className="ml-1">
                Space
              </Badge>
            </Button>
          </Inline>
        </Stack>
      )}
    </Stack>
  )
}

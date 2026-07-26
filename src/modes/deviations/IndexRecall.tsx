import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Panel, Text, Stack, Inline, Badge, Button, NumberStepper, cn } from '../../ui'
import type { Rules } from '../../engine/types'
import type { TrainingApi } from '../../training'
import type { Rng } from '../../engine/cards'
import { useSound } from '../../audio'
import {
  buildRecallItems,
  gradeRecall,
  recallCorrect,
  signed,
  type RecallItem,
} from './data'

export interface IndexRecallProps {
  rules: Rules
  training: TrainingApi
  rng?: Rng
}

/** Sub-mode 2: recall the index number for a play (±0 exact, ±1 close). */
export function IndexRecall({ rules, training, rng = Math.random }: IndexRecallProps) {
  const items = useMemo(() => buildRecallItems(rules), [rules])
  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items])
  const pool = useMemo(() => items.map((i) => i.key), [items])

  const [item, setItem] = useState<RecallItem | null>(null)
  const [guess, setGuess] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const play = useSound()
  const rngRef = useRef(rng)
  rngRef.current = rng

  const nextItem = useCallback(() => {
    const r = rngRef.current
    const key = training.pickNext(pool) ?? pool[Math.floor(r() * pool.length)]
    setItem(byKey.get(key) ?? items[0])
    setGuess(0)
    setRevealed(false)
  }, [byKey, items, pool, training])

  useEffect(() => {
    nextItem()
  }, [nextItem])

  const submit = useCallback(() => {
    if (!item || revealed) return
    const grade = gradeRecall(guess, item.index)
    setRevealed(true)
    play(recallCorrect(grade) ? 'correct' : 'incorrect')
    training.record({
      category: 'deviations',
      correct: recallCorrect(grade),
      srKey: item.key,
    })
  }, [item, guess, revealed, training, play])

  if (!item) return null
  const grade = revealed ? gradeRecall(guess, item.index) : null
  const gradeColor =
    grade === 'exact' ? 'text-good' : grade === 'close' ? 'text-warn' : 'text-bad'
  const gradeLabel =
    grade === 'exact' ? 'Exact!' : grade === 'close' ? 'Close — off by 1' : 'Not quite'

  return (
    <Stack gap={4}>
      <Panel padding="lg" elevation="raised">
        <Stack gap={4} align="center">
          <Text size="xs" tone="muted" className="uppercase tracking-wide">
            At what true count does this deviation start?
          </Text>
          <Inline gap={3} align="center" justify="center" wrap>
            <Text size="lg" weight="bold">
              {item.matchup}
            </Text>
            <Badge variant="accent" size="md">
              {item.play}
            </Badge>
          </Inline>

          {!revealed ? (
            <Stack gap={3} align="center">
              <NumberStepper
                value={guess}
                onChange={setGuess}
                min={-10}
                max={10}
                formatValue={(v) => `TC ${signed(v)}`}
              />
              <Text size="xs" tone="muted">
                Enter the true-count index, then submit.
              </Text>
            </Stack>
          ) : (
            <Stack gap={2} align="center">
              <div className={cn('text-lg font-semibold', gradeColor)}>{gradeLabel}</div>
              <Inline gap={4} align="center">
                <Stack gap={0} align="center">
                  <Text size="xs" tone="muted">
                    Your answer
                  </Text>
                  <Text size="lg" weight="semibold" className="tabular-nums">
                    {signed(guess)}
                  </Text>
                </Stack>
                <Stack gap={0} align="center">
                  <Text size="xs" tone="muted">
                    Index
                  </Text>
                  <Text size="lg" weight="bold" tone="accent" className="tabular-nums">
                    {signed(item.index)}
                  </Text>
                </Stack>
              </Inline>
              <Text size="sm" tone="muted">
                {item.play} at TC ≥ {signed(item.index)}.
              </Text>
            </Stack>
          )}
        </Stack>
      </Panel>

      <Inline justify="end" gap={2}>
        {!revealed ? (
          <Button variant="primary" onClick={submit}>
            Check answer
          </Button>
        ) : (
          <Button variant="primary" onClick={nextItem}>
            Next
          </Button>
        )}
      </Inline>
    </Stack>
  )
}

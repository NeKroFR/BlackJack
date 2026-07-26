import { useEffect, useMemo, useRef } from 'react'
import type { Card } from '../engine/types'
import {
  Panel,
  Stack,
  Inline,
  Text,
  Button,
  Segmented,
  Toggle,
  CardHand,
  KeyHint,
} from '../ui'
import { ActionBar, Verdict, useActionKeys } from '../ui/game'
import { StatTile } from '../ui/charts'
import { useStore } from '../store'
import { useSound } from '../audio'
import { PageHeader } from './PageHeader'
import { useStrategyTrainer } from '../modes/strategy/useStrategyTrainer'
import { FOCUS_LABELS, type FocusFilter } from '../modes/strategy/situations'

const FOCUS_OPTIONS: { value: FocusFilter; label: string }[] = (
  Object.keys(FOCUS_LABELS) as FocusFilter[]
).map((value) => ({ value, label: FOCUS_LABELS[value] }))

const noop = () => {}

/** A face-down placeholder for the dealer's hole card (content never shown). */
const HOLE_CARD: Card = { rank: 'A', suit: 'S', id: 'strategy-hole' }

export default function StrategyTrainer() {
  const rules = useStore((s) => s.rules)
  const play = useSound()
  const t = useStrategyTrainer()
  const { current, phase, result } = t

  // A card-slide as each fresh hand is dealt (each deal is a new object, even
  // when spaced repetition resurfaces the same situation key).
  const dealtRef = useRef<typeof current>(null)
  useEffect(() => {
    if (current && current !== dealtRef.current) play('deal')
    dealtRef.current = current
  }, [current, play])

  // Verdict cue on each graded answer.
  const resultRef = useRef<typeof result>(null)
  useEffect(() => {
    if (result && result !== resultRef.current) play(result.correct ? 'correct' : 'incorrect')
    resultRef.current = result
  }, [result, play])

  const revealed = phase === 'revealed'
  const accuracy =
    t.session.answered === 0 ? 0 : Math.round((t.session.correct / t.session.answered) * 100)

  // Space advances to the next hand once a verdict is showing.
  useActionKeys({ onSpace: revealed ? t.next : undefined }, { enabled: revealed })

  const dealerCards = useMemo(
    () => (current ? [current.dealerUpCard, HOLE_CARD] : []),
    [current],
  )

  const timedFrac = t.timedTotalMs > 0 ? t.timeLeftMs / t.timedTotalMs : 0
  const timedLow = timedFrac <= 0.25

  return (
    <>
      <PageHeader
        title="Strategy trainer"
        description="A random hand versus a dealer upcard, dealt from your current rules. Pick your play and get an instant, EV-backed verdict."
      />

      <Stack gap={4}>
        <Inline justify="between" align="center" wrap className="gap-3">
          <Segmented
            label="Focus filter"
            options={FOCUS_OPTIONS}
            value={t.focus}
            onChange={t.setFocus}
            size="sm"
          />
          <Toggle
            checked={t.timed}
            onChange={t.setTimed}
            label="Timed quiz"
            ariaLabel="Timed quiz"
            size="sm"
          />
        </Inline>

        <Inline gap={3} wrap>
          <StatTile
            className="min-w-[140px] flex-1"
            label="Streak"
            value={t.session.streak}
            hint={`Best this session: ${t.session.bestStreak}`}
          />
          <StatTile
            className="min-w-[140px] flex-1"
            label="Accuracy"
            value={`${accuracy}%`}
            hint={`${t.session.correct}/${t.session.answered} correct`}
          />
          <StatTile
            className="min-w-[140px] flex-1"
            label="Hands"
            value={t.session.answered}
            hint={FOCUS_LABELS[t.focus]}
          />
        </Inline>

        <Panel padding="lg" elevation="raised">
          <Stack gap={5} align="center">
            <Stack gap={2} align="center">
              <Text size="sm" tone="muted" className="uppercase tracking-wide">
                Dealer shows
              </Text>
              {current && (
                <CardHand cards={dealerCards} holeCardIndex={1} showTotal={false} size="md" />
              )}
            </Stack>

            <Stack gap={2} align="center">
              <Text size="sm" tone="muted" className="uppercase tracking-wide">
                Your hand
              </Text>
              {current && <CardHand cards={current.playerCards} size="md" dealIn />}
            </Stack>

            {t.timed && !revealed && (
              <div
                className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-label="Time remaining"
                aria-valuenow={Math.round(timedFrac * 100)}
              >
                <div
                  className={timedLow ? 'h-full bg-bad' : 'h-full bg-accent'}
                  style={{ width: `${Math.max(0, timedFrac * 100)}%` }}
                />
              </div>
            )}

            <div className="w-full max-w-lg">
              {current && !revealed && (
                <ActionBar
                  block
                  hit={{ onClick: () => t.answer('hit') }}
                  stand={{ onClick: () => t.answer('stand') }}
                  double={{ onClick: () => t.answer('double'), disabled: !current.legal.double }}
                  split={
                    current.legal.split
                      ? { onClick: () => t.answer('split') }
                      : { onClick: noop, hidden: true }
                  }
                  surrender={
                    current.legal.surrender
                      ? { onClick: () => t.answer('surrender') }
                      : { onClick: noop, hidden: true }
                  }
                />
              )}

              {current && revealed && result && (
                <Stack gap={3}>
                  <Verdict
                    correct={result.correct}
                    correctAction={result.best}
                    chosenAction={result.chosen}
                    explanation={
                      result.timedOut
                        ? `Time's up. ${current.decision.explanation}`
                        : current.decision.explanation
                    }
                  />
                  <Button
                    variant="primary"
                    size="lg"
                    block
                    onClick={t.next}
                    trailing={<KeyHint keyName="Space" />}
                  >
                    Next hand
                  </Button>
                </Stack>
              )}
            </div>
          </Stack>
        </Panel>

        <Text size="sm" tone="muted">
          {rules.decks}D · {rules.soft17} · {rules.das ? 'DAS' : 'no DAS'} ·{' '}
          {rules.surrender === 'none' ? 'no surrender' : `${rules.surrender} surrender`} ·{' '}
          {rules.blackjackPayout}. Missed hands resurface more often.
        </Text>
      </Stack>
    </>
  )
}

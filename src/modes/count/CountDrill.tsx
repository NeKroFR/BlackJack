import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Inline,
  KeyHint,
  Panel,
  PlayingCard,
  Segmented,
  Slider,
  Stack,
  Text,
  Toggle,
  useToast,
} from '../../ui'
import { StatTile } from '../../ui/charts'
import { getSystem } from '../../engine/counting/systems'
import { useSound } from '../../audio'
import { useStore } from '../../store'
import { recordResult } from '../../training/recordResult'
import { PageHeader } from '../../screens/PageHeader'
import {
  achievedCpm,
  buildPlan,
  cardIntervalMs,
  cardsThrough,
  expectedRunning,
  expectedTrue,
  rampCpm,
  type CountMode,
  type DrillPlan,
} from './engine'
import { CountEntry } from './CountEntry'

type Phase = 'config' | 'flashing' | 'checkpoint' | 'final' | 'summary'
type FinalStep = 'rc' | 'tc'

interface Answer {
  label: string
  expected: number
  given: number
  correct: boolean
}

const MODE_OPTIONS: { value: CountMode; label: string }[] = [
  { value: 'single', label: 'Single card' },
  { value: 'grouped', label: 'Grouped' },
  { value: 'shoe', label: 'Full shoe' },
  { value: 'table', label: 'Table pace' },
]

const MODE_BLURB: Record<CountMode, string> = {
  single: 'One card at a time — build raw tag-summing speed.',
  grouped: 'Two or three cards per flash — chunk them at a glance.',
  shoe: 'Count a full shoe to the cut card, with mid-shoe count checks.',
  table: 'A whole table of hands per beat — sustain the count under load.',
}

const CPM_MIN = 30
const CPM_MAX = 300

export default function CountDrill() {
  const systemId = useStore((s) => s.systemId)
  const decks = useStore((s) => s.rules.decks)
  const penetration = useStore((s) => s.rules.penetration)
  const seats = useStore((s) => s.tableSeats)
  const dealingSpeed = useStore((s) => s.dealingSpeed)
  const setDealingSpeed = useStore((s) => s.setDealingSpeed)
  const rounding = useStore((s) => s.trueCountRounding)
  const updateCpm = useStore((s) => s.updateCpm)
  const addSession = useStore((s) => s.addSession)
  const toast = useToast()
  const play = useSound()

  const system = useMemo(() => getSystem(systemId), [systemId])
  const balanced = system.balanced && system.usesTrueCount

  const [mode, setMode] = useState<CountMode>('single')
  const [cpm, setCpm] = useState(dealingSpeed)
  const [adaptive, setAdaptive] = useState(true)

  const [phase, setPhase] = useState<Phase>('config')
  const [plan, setPlan] = useState<DrillPlan | null>(null)
  const [beatIndex, setBeatIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [finalStep, setFinalStep] = useState<FinalStep>('rc')
  const [answers, setAnswers] = useState<Answer[]>([])

  // Timing: accumulate only active (flashing) time, excluding pauses + prompts.
  const flashStartRef = useRef<number>(0)
  const activeMsRef = useRef<number>(0)
  const startedAtRef = useRef<number>(0)

  const bankActive = useCallback(() => {
    if (flashStartRef.current > 0) {
      activeMsRef.current += Date.now() - flashStartRef.current
      flashStartRef.current = 0
    }
  }, [])

  const resumeFlashing = useCallback(() => {
    flashStartRef.current = Date.now()
    setPaused(false)
    setPhase('flashing')
  }, [])

  const startDrill = useCallback(() => {
    const next = buildPlan({
      mode,
      decks,
      seats,
      penetration,
      seed: (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0,
    })
    setPlan(next)
    setAnswers([])
    setBeatIndex(0)
    setFinalStep('rc')
    activeMsRef.current = 0
    startedAtRef.current = Date.now()
    flashStartRef.current = Date.now()
    setPaused(false)
    setPhase('flashing')
  }, [mode, decks, seats, penetration])

  // The flashing clock: show the current beat for a card-scaled duration, then
  // either pause for a checkpoint or advance to the next beat / the final count.
  useEffect(() => {
    if (phase !== 'flashing' || paused || !plan) return
    const beat = plan.beats[beatIndex]
    if (!beat) return
    const dur = Math.max(180, beat.cards.length * cardIntervalMs(cpm))
    const t = window.setTimeout(() => {
      if (beat.checkpoint) {
        bankActive()
        setPhase('checkpoint')
      } else if (beatIndex + 1 >= plan.beats.length) {
        bankActive()
        setFinalStep('rc')
        setPhase('final')
      } else {
        setBeatIndex(beatIndex + 1)
      }
    }, dur)
    return () => window.clearTimeout(t)
  }, [phase, paused, plan, beatIndex, cpm, bankActive])

  // A soft card-slide tick as each new beat of cards flashes up.
  useEffect(() => {
    if (phase === 'flashing') play('deal')
  }, [phase, beatIndex, play])

  const record = useCallback((correct: boolean) => {
    recordResult({ category: 'counting', correct, now: Date.now() })
    play(correct ? 'correct' : 'incorrect')
  }, [play])

  // ---- checkpoint grading ---------------------------------------------------
  function submitCheckpoint(given: number) {
    if (!plan) return
    const seen = cardsThrough(plan.beats, beatIndex)
    const expected = balanced
      ? expectedTrue(seen, system, decks, rounding)
      : expectedRunning(seen, system, decks)
    const correct = expected === given
    record(correct)
    setAnswers((a) => [
      ...a,
      { label: balanced ? `True count @ beat ${beatIndex + 1}` : `Running count @ beat ${beatIndex + 1}`, expected, given, correct },
    ])
    if (beatIndex + 1 >= plan.beats.length) {
      setFinalStep('rc')
      setPhase('final')
    } else {
      setBeatIndex(beatIndex + 1)
      resumeFlashing()
    }
  }

  // ---- final grading --------------------------------------------------------
  function finalize(finalAnswers: Answer[]) {
    setAnswers(finalAnswers)
    const total = finalAnswers.length
    const correct = finalAnswers.filter((a) => a.correct).length
    const cards = plan?.totalCards ?? 0
    const cpmAchieved = achievedCpm(cards, activeMsRef.current)
    if (cpmAchieved > 0) updateCpm(cpmAchieved)
    addSession({
      id: `count-${startedAtRef.current}`,
      mode: `count-${mode}`,
      startedAt: startedAtRef.current,
      endedAt: Date.now(),
      hands: cards,
      correct,
      total,
    })
    if (adaptive && total > 0 && correct === total) {
      const bumped = rampCpm(cpm, true, CPM_MAX)
      if (bumped > cpm) {
        setCpm(bumped)
        setDealingSpeed(bumped)
        toast.toast({ title: `Nailed it — speeding up to ${bumped} cpm`, variant: 'good' })
      }
    }
    setPhase('summary')
  }

  function submitFinal(given: number) {
    if (!plan) return
    const seen = cardsThrough(plan.beats, plan.beats.length - 1)
    if (finalStep === 'rc') {
      const expected = expectedRunning(seen, system, decks)
      const correct = expected === given
      record(correct)
      const rcAnswer: Answer = { label: 'Final running count', expected, given, correct }
      if (balanced) {
        setAnswers((a) => [...a, rcAnswer])
        setFinalStep('tc')
      } else {
        finalize([...answers, rcAnswer])
      }
    } else {
      const expected = expectedTrue(seen, system, decks, rounding)
      const correct = expected === given
      record(correct)
      finalize([...answers, { label: 'Final true count', expected, given, correct }])
    }
  }

  function stopEarly() {
    bankActive()
    if (answers.length > 0) finalize(answers)
    else {
      setPlan(null)
      setPhase('config')
    }
  }

  // ---- keyboard: Space starts / pauses --------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (phase === 'config') {
        e.preventDefault()
        startDrill()
      } else if (phase === 'flashing') {
        e.preventDefault()
        if (paused) resumeFlashing()
        else {
          bankActive()
          setPaused(true)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, paused, startDrill, resumeFlashing, bankActive])

  const beat = plan?.beats[beatIndex]
  const progress = plan ? (beatIndex + 1) / plan.beats.length : 0

  return (
    <>
      <PageHeader
        title="Count drill"
        description="Train raw counting speed and accuracy. Cards flash at your pace; call the count on the checkpoints and again at the end."
        actions={
          <Badge variant="accent" size="md">
            {system.name}
          </Badge>
        }
      />

      {phase === 'config' && (
        <Stack gap={5}>
          <Segmented
            label="Drill mode"
            block
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
          />
          <Text tone="muted" size="sm">
            {MODE_BLURB[mode]}
          </Text>

          <Panel padding="lg">
            <Stack gap={5}>
              <Slider
                label="Pace"
                min={CPM_MIN}
                max={CPM_MAX}
                step={10}
                value={cpm}
                onChange={(v) => {
                  setCpm(v)
                  setDealingSpeed(v)
                }}
                formatValue={(v) => `${v} cards / min`}
              />
              <Inline justify="between" align="center" wrap className="gap-3">
                <Stack gap={1}>
                  <Text weight="medium">Adaptive pace</Text>
                  <Text tone="muted" size="sm">
                    Speed up automatically after a flawless round.
                  </Text>
                </Stack>
                <Toggle checked={adaptive} onChange={setAdaptive} label="Adaptive pace" />
              </Inline>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatTile label="System" value={system.name} hint={balanced ? 'balanced' : 'unbalanced'} />
                <StatTile label="Decks" value={decks} hint="from rules" />
                {mode === 'table' && (
                  <StatTile label="Players" value={seats + 1} hint={`${seats} others + you`} />
                )}
                {mode === 'shoe' && (
                  <StatTile
                    label="Cut card"
                    value={`${Math.round(penetration * 100)}%`}
                    hint="penetration"
                  />
                )}
              </div>
              {!balanced && (
                <Text tone="muted" size="sm">
                  {system.name} is unbalanced — start your count at the IRC of{' '}
                  <span className="tabular-nums text-ink">{system.runningCountStart(decks)}</span> for{' '}
                  {decks} decks. You'll be asked for the running count only.
                </Text>
              )}
            </Stack>
          </Panel>

          <Inline gap={3}>
            <Button variant="primary" size="lg" onClick={startDrill} trailing={<KeyHint keyName="Space" />}>
              Start drill
            </Button>
          </Inline>
        </Stack>
      )}

      {phase === 'flashing' && plan && (
        <Stack gap={5} align="stretch">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>

          <div className="flex min-h-[16rem] items-center justify-center rounded-2xl border border-border bg-[var(--felt)] p-6">
            {paused ? (
              <Stack gap={2} align="center">
                <Text size="lg" weight="semibold" className="text-white">
                  Paused
                </Text>
                <Text size="sm" className="text-white/70">
                  Press Space to resume.
                </Text>
              </Stack>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-3">
                {beat?.cards.map((c) => (
                  <PlayingCard key={c.id} card={c} size="lg" dealIn />
                ))}
              </div>
            )}
          </div>

          <Inline justify="between" align="center" wrap className="gap-3">
            <Text tone="muted" size="sm" numeric>
              Beat {beatIndex + 1} / {plan.beats.length} · {cpm} cpm
            </Text>
            <Inline gap={2}>
              <Button
                variant="secondary"
                onClick={() => {
                  if (paused) resumeFlashing()
                  else {
                    bankActive()
                    setPaused(true)
                  }
                }}
                trailing={<KeyHint keyName="Space" />}
              >
                {paused ? 'Resume' : 'Pause'}
              </Button>
              <Button variant="ghost" onClick={stopEarly}>
                Stop
              </Button>
            </Inline>
          </Inline>
        </Stack>
      )}

      {phase === 'checkpoint' && (
        <Panel padding="lg" elevation="raised">
          <Stack gap={5} align="center">
            <Text tone="accent" weight="semibold" size="lg">
              Checkpoint
            </Text>
            <CountEntry
              label={balanced ? 'Current true count' : 'Current running count'}
              submitLabel="Lock in"
              onSubmit={submitCheckpoint}
            />
          </Stack>
        </Panel>
      )}

      {phase === 'final' && (
        <Panel padding="lg" elevation="raised">
          <Stack gap={5} align="center">
            <Text tone="accent" weight="semibold" size="lg">
              Shoe complete
            </Text>
            <CountEntry
              key={finalStep}
              label={finalStep === 'rc' ? 'Final running count' : 'Final true count'}
              submitLabel={finalStep === 'rc' && balanced ? 'Next' : 'Finish'}
              onSubmit={submitFinal}
            />
            {balanced && (
              <Text tone="muted" size="sm">
                {finalStep === 'rc' ? 'Running count first, then the true count.' : 'Now the true count.'}
              </Text>
            )}
          </Stack>
        </Panel>
      )}

      {phase === 'summary' && (
        <SummaryView
          answers={answers}
          cards={plan?.totalCards ?? 0}
          cpm={achievedCpm(plan?.totalCards ?? 0, activeMsRef.current)}
          onAgain={startDrill}
          onChange={() => {
            setPlan(null)
            setPhase('config')
          }}
        />
      )}
    </>
  )
}

interface SummaryViewProps {
  answers: Answer[]
  cards: number
  cpm: number
  onAgain: () => void
  onChange: () => void
}

function SummaryView({ answers, cards, cpm, onAgain, onChange }: SummaryViewProps) {
  const correct = answers.filter((a) => a.correct).length
  const total = answers.length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  return (
    <Stack gap={5}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Accuracy" value={`${accuracy}%`} hint={`${correct}/${total} counts`} />
        <StatTile label="Speed" value={cpm} hint="cards / min" />
        <StatTile label="Cards seen" value={cards} />
      </div>

      <Panel padding="md">
        <Stack gap={3}>
          <Text weight="semibold">Your calls</Text>
          <ul className="space-y-2">
            {answers.map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2 last:border-0"
              >
                <Text size="sm">{a.label}</Text>
                <Inline gap={2}>
                  {a.correct ? (
                    <Badge variant="good" size="sm">
                      {a.given}
                    </Badge>
                  ) : (
                    <>
                      <Badge variant="bad" size="sm">
                        you {a.given}
                      </Badge>
                      <Text size="xs" tone="muted">
                        was
                      </Text>
                      <Badge variant="good" size="sm">
                        {a.expected}
                      </Badge>
                    </>
                  )}
                </Inline>
              </li>
            ))}
          </ul>
        </Stack>
      </Panel>

      <Inline gap={3}>
        <Button variant="primary" size="lg" onClick={onAgain} trailing={<KeyHint keyName="Space" />}>
          Deal again
        </Button>
        <Button variant="secondary" size="lg" onClick={onChange}>
          Change mode
        </Button>
      </Inline>
    </Stack>
  )
}

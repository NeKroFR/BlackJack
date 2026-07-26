// useStrategyTrainer: the state machine behind the basic-strategy drill.
//
// Deals a hand + upcard for the active rules (biased toward the chosen focus
// filter and toward previously-missed situations via spaced repetition), grades
// the player's action against the in-process EV engine, records the result to
// the store, and advances. An optional timed mode adds a per-hand countdown that
// scores a timeout as a miss.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Action, Card, Composition, Decision } from '../../engine/types'
import { useStore } from '../../store'
import { useEngine } from '../../training/useEngine'
import { useTraining } from '../../training'
import {
  categoryFor,
  dealSituation,
  gradeChoice,
  legalActions,
  parseSituationKey,
  poolFor,
  situationKey,
  type FocusFilter,
  type Grade,
  type Legality,
  type Situation,
} from './situations'

/** Countdown budget per hand in timed mode. */
export const TIMED_MS = 10_000

export interface CurrentHand {
  key: string
  situation: Situation
  playerCards: Card[]
  dealerUpCard: Card
  comp: Composition
  decision: Decision
  legal: Legality
}

export type Phase = 'awaiting' | 'revealed'

export interface AnswerResult extends Grade {
  /** What the player chose, undefined when the countdown expired. */
  chosen: Action | undefined
  /** True when this result came from a timed-mode timeout. */
  timedOut: boolean
}

export interface SessionStats {
  answered: number
  correct: number
  streak: number
  bestStreak: number
}

const EMPTY_SESSION: SessionStats = { answered: 0, correct: 0, streak: 0, bestStreak: 0 }

export interface StrategyTrainerApi {
  focus: FocusFilter
  setFocus(focus: FocusFilter): void
  timed: boolean
  setTimed(timed: boolean): void
  current: CurrentHand | null
  phase: Phase
  result: AnswerResult | null
  session: SessionStats
  /** Remaining countdown in ms (timed mode only, 0 otherwise). */
  timeLeftMs: number
  timedTotalMs: number
  /** Submit an action (or undefined for a timeout). No-op once revealed. */
  answer(action: Action | undefined): void
  /** Deal the next hand. */
  next(): void
}

export function useStrategyTrainer(): StrategyTrainerApi {
  const rules = useStore((s) => s.rules)
  const engine = useEngine()
  const training = useTraining()

  const [focus, setFocus] = useState<FocusFilter>('all')
  const [timed, setTimed] = useState(false)
  const [current, setCurrent] = useState<CurrentHand | null>(null)
  const [phase, setPhase] = useState<Phase>('awaiting')
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [session, setSession] = useState<SessionStats>(EMPTY_SESSION)
  const [timeLeftMs, setTimeLeftMs] = useState(0)

  const pool = useMemo(() => poolFor(focus), [focus])

  const deal = useCallback(() => {
    const key = training.pickNext(pool) ?? pool[Math.floor(Math.random() * pool.length)]
    const sit = parseSituationKey(key) ?? { kind: 'hard' as const, value: 16, up: 10 }
    const safeKey = parseSituationKey(key) ? key : situationKey(sit)
    const dealt = dealSituation(sit, rules)
    const legal = legalActions(dealt.playerCards, rules)
    const decision = engine.evaluate(dealt.playerCards, sit.up, dealt.comp, rules, {
      canDouble: legal.double,
      canSplit: legal.split,
      canSurrender: legal.surrender,
    })
    setCurrent({
      key: safeKey,
      situation: sit,
      playerCards: dealt.playerCards,
      dealerUpCard: dealt.dealerUpCard,
      comp: dealt.comp,
      decision,
      legal,
    })
    setResult(null)
    setPhase('awaiting')
    setTimeLeftMs(timed ? TIMED_MS : 0)
  }, [engine, training, rules, pool, timed])

  // Latest `deal` without churning the focus effect below.
  const dealRef = useRef(deal)
  dealRef.current = deal

  // Deal on mount and whenever the focus filter changes.
  useEffect(() => {
    dealRef.current()
  }, [focus])

  const answer = useCallback(
    (action: Action | undefined) => {
      setCurrent((cur) => {
        // Guard against double-submits: only grade while awaiting.
        if (!cur) return cur
        setPhase((ph) => {
          if (ph !== 'awaiting') return ph
          const grade = gradeChoice(cur.decision, action)
          setResult({ ...grade, chosen: action, timedOut: action === undefined })
          training.record({
            category: categoryFor(cur.situation),
            correct: grade.correct,
            chosen: action,
            best: grade.best,
            evDelta: grade.evDelta,
            handContext: {
              playerCards: cur.playerCards,
              dealerUp: cur.situation.up,
            },
            srKey: cur.key,
          })
          setSession((s) => {
            const streak = grade.correct ? s.streak + 1 : 0
            return {
              answered: s.answered + 1,
              correct: s.correct + (grade.correct ? 1 : 0),
              streak,
              bestStreak: Math.max(s.bestStreak, streak),
            }
          })
          return 'revealed'
        })
        return cur
      })
    },
    [training],
  )

  const answerRef = useRef(answer)
  answerRef.current = answer

  // Timed-mode countdown: tick while awaiting. A timeout scores as a miss.
  useEffect(() => {
    if (!timed || phase !== 'awaiting' || !current) return
    // Seed a full budget when timed mode was toggled on mid-hand (timeLeftMs 0).
    const budget = timeLeftMs > 0 ? timeLeftMs : TIMED_MS
    const deadline = Date.now() + budget
    if (timeLeftMs <= 0) setTimeLeftMs(budget)
    const id = window.setInterval(() => {
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        window.clearInterval(id)
        setTimeLeftMs(0)
        answerRef.current(undefined)
      } else {
        setTimeLeftMs(remaining)
      }
    }, 100)
    return () => window.clearInterval(id)
    // Restart the ticker on each new hand. timeLeftMs is seeded at deal time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, phase, current?.key])

  const next = useCallback(() => dealRef.current(), [])

  return {
    focus,
    setFocus,
    timed,
    setTimed,
    current,
    phase,
    result,
    session,
    timeLeftMs,
    timedTotalMs: TIMED_MS,
    answer,
    next,
  }
}

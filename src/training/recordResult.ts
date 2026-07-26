// recordResult: the one entry point every training mode calls after grading
// an answer or round. It fans a single result out to all the persistent side
// effects (accuracy, streak, mistake log, XP + level-up, daily streak,
// achievements) and advances the spaced-repetition queue.
//
// The store never reads the clock (see store/progressSlice), so callers pass a
// `now` timestamp. This module does the (UI-side) date math to derive today's
// and yesterday's ISO day for the daily-streak update.

import { useCallback, useMemo, useRef } from 'react'
import type { Action, Card } from '../engine/types'
import { useStore } from '../store'
import type { StatCategory } from '../store'
import { XP_PER_LEVEL, levelForXp } from '../store/progressSlice'
import { makeScheduler, type Scheduler, type SrState } from './spacedRepetition'
import type { Rng } from '../engine/cards'

// ---- XP helpers -------------------------------------------------------------

/** Base XP for a correct answer, before the streak bonus. */
export const XP_CORRECT = 10
/** Consolation XP for a wrong answer (participation keeps the loop rewarding). */
export const XP_WRONG = 2
/** Cap on the per-answer streak bonus. */
export const XP_STREAK_CAP = 10

/** Cumulative XP required to *reach* `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  return Math.max(0, level - 1) * XP_PER_LEVEL
}

/** XP still needed to reach the next level from a given XP total. */
export function xpToNextLevel(xp: number): number {
  const next = levelForXp(Math.max(0, xp)) + 1
  return xpForLevel(next) - Math.max(0, xp)
}

/** XP earned for a single answer given the streak length *after* it. */
export function xpForAnswer(correct: boolean, streakAfter: number): number {
  if (!correct) return XP_WRONG
  return XP_CORRECT + Math.min(Math.max(0, streakAfter - 1), XP_STREAK_CAP)
}

/** Award XP to the store and report whether it triggered a level-up. */
export function awardXp(amount: number): {
  xpAwarded: number
  leveledUp: boolean
  fromLevel: number
  toLevel: number
} {
  const fromLevel = useStore.getState().level
  useStore.getState().addXp(amount)
  const toLevel = useStore.getState().level
  return { xpAwarded: amount, leveledUp: toLevel > fromLevel, fromLevel, toLevel }
}

// ---- Achievements -----------------------------------------------------------

export interface AchievementDef {
  id: string
  title: string
  description: string
  /** True when the current store state qualifies for this achievement. */
  earned: (s: ReturnType<typeof useStore.getState>) => boolean
}

const totalAnswers = (s: ReturnType<typeof useStore.getState>): number =>
  Object.values(s.accuracy).reduce((n, c) => n + c.total, 0)

/** The catalog of achievements the trainer can award. */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-steps',
    title: 'First Steps',
    description: 'Answer your first hand.',
    earned: (s) => totalAnswers(s) >= 1,
  },
  {
    id: 'streak-10',
    title: 'On a Roll',
    description: 'Reach a 10-answer streak.',
    earned: (s) => s.bestStreak >= 10,
  },
  {
    id: 'streak-25',
    title: 'Locked In',
    description: 'Reach a 25-answer streak.',
    earned: (s) => s.bestStreak >= 25,
  },
  {
    id: 'streak-50',
    title: 'Unstoppable',
    description: 'Reach a 50-answer streak.',
    earned: (s) => s.bestStreak >= 50,
  },
  {
    id: 'century',
    title: 'Century',
    description: 'Answer 100 hands.',
    earned: (s) => totalAnswers(s) >= 100,
  },
  {
    id: 'level-5',
    title: 'Apprentice',
    description: 'Reach level 5.',
    earned: (s) => s.level >= 5,
  },
  {
    id: 'level-10',
    title: 'Card Sharp',
    description: 'Reach level 10.',
    earned: (s) => s.level >= 10,
  },
  {
    id: 'daily-7',
    title: 'Habit Formed',
    description: 'Practice 7 days in a row.',
    earned: (s) => s.dailyStreak >= 7,
  },
  {
    id: 'sharpshooter',
    title: 'Sharpshooter',
    description: 'Hit 90% accuracy in a category over 50+ hands.',
    earned: (s) =>
      Object.values(s.accuracy).some((c) => c.total >= 50 && c.correct / c.total >= 0.9),
  },
]

/**
 * Award any newly-earned achievements against the current store state and
 * return their ids. Pure w.r.t. time. Reads only the (already-updated) store.
 */
export function checkAchievements(): string[] {
  const s = useStore.getState()
  const owned = new Set(s.achievements)
  const newly: string[] = []
  for (const a of ACHIEVEMENTS) {
    if (!owned.has(a.id) && a.earned(s)) {
      s.awardAchievement(a.id)
      newly.push(a.id)
    }
  }
  return newly
}

// ---- Daily streak helpers ---------------------------------------------------

const DAY_MS = 86_400_000

/** UTC ISO day (YYYY-MM-DD) for a timestamp. */
export function isoDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

// ---- recordResult -----------------------------------------------------------

/** Hand context logged with a mistake for later review. */
export interface HandContext {
  playerCards: Card[]
  /** Dealer upcard bucket (1 = Ace .. 10 = ten-valued). */
  dealerUp: number
  trueCount?: number
}

export interface RecordResultInput {
  category: StatCategory
  correct: boolean
  /** Hand snapshot, required (with `chosen`+`best`) to log a mistake. */
  handContext?: HandContext
  chosen?: Action
  best?: Action
  /** EV lost by the chosen action vs. best (clamped to <= 0). Default 0. */
  evDelta?: number
  /** Millisecond timestamp supplied by the UI (store never reads the clock). */
  now: number
  /** Optional explicit mistake id (else derived from `now`). */
  id?: string
  /** Spaced-rep item key to advance, if the mode uses the scheduler. */
  srKey?: string
  /** Scheduler instance to advance (see `useTraining`). */
  scheduler?: Scheduler
}

export interface RecordResultOutcome {
  xpAwarded: number
  leveledUp: boolean
  level: number
  streak: number
  achievementsUnlocked: string[]
  loggedMistake: boolean
}

let mistakeSeq = 0

function makeMistakeId(now: number): string {
  mistakeSeq = (mistakeSeq + 1) % 1_000_000
  return `m-${now}-${mistakeSeq}`
}

/**
 * Apply one graded result to the store and spaced-rep queue. Call once per
 * answer/round. Returns a summary (XP, level-up, streak, achievements) so the
 * UI can celebrate without re-reading the store.
 */
export function recordResult(input: RecordResultInput): RecordResultOutcome {
  const {
    category,
    correct,
    handContext,
    chosen,
    best,
    evDelta = 0,
    now,
    scheduler,
    srKey,
  } = input

  const s = useStore.getState()

  // 1) accuracy + streak
  s.recordAnswer(category, correct)
  const streak = useStore.getState().streak

  // 2) mistake log (only when we have enough context)
  let loggedMistake = false
  if (!correct && handContext && chosen && best) {
    s.logMistake({
      id: input.id ?? makeMistakeId(now),
      category,
      playerCards: handContext.playerCards,
      dealerUp: handContext.dealerUp,
      trueCount: handContext.trueCount,
      chosen,
      correct: best,
      evDelta: Math.min(0, evDelta),
      timestamp: now,
    })
    loggedMistake = true
  }

  // 3) XP + level-up (streak bonus uses the post-answer streak)
  const xp = xpForAnswer(correct, streak)
  const xpResult = awardXp(xp)

  // 4) daily streak (UI-side date math, store just extends/resets)
  s.markActiveDay(isoDay(now), isoDay(now - DAY_MS))

  // 5) spaced repetition
  if (scheduler && srKey) scheduler.recordReview(srKey, correct, now)

  // 6) achievements (evaluated against the now-updated store)
  const achievementsUnlocked = checkAchievements()

  return {
    xpAwarded: xp,
    leveledUp: xpResult.leveledUp,
    level: xpResult.toLevel,
    streak,
    achievementsUnlocked,
    loggedMistake,
  }
}

// ---- useTraining hook -------------------------------------------------------

export interface UseTrainingOptions {
  /** RNG for spaced-rep selection (default `Math.random`). */
  rng?: Rng
  /** Clock for defaulting `now` (default `Date.now`), injectable for tests. */
  clock?: () => number
  /** Initial scheduler state (e.g. restored from the store). */
  initialSchedulerState?: SrState
}

export interface TrainingApi {
  /** The mode's spaced-rep scheduler instance. */
  scheduler: Scheduler
  /** Grade a result: forwards to `recordResult`, injecting scheduler + now. */
  record(input: Omit<RecordResultInput, 'now' | 'scheduler'> & { now?: number }): RecordResultOutcome
  /** Pick the next item key from `pool`, biased toward due/missed items. */
  pickNext(pool: string[], now?: number): string | undefined
}

/**
 * Wires `recordResult` to a per-mode spaced-rep scheduler and sensible time/RNG
 * defaults. Modes call `record({...})` after each answer and `pickNext(pool)`
 * to choose the next situation to drill.
 */
export function useTraining(opts: UseTrainingOptions = {}): TrainingApi {
  const rng = opts.rng ?? Math.random
  const clock = opts.clock ?? Date.now
  const schedulerRef = useRef<Scheduler | null>(null)
  if (!schedulerRef.current) {
    schedulerRef.current = makeScheduler(opts.initialSchedulerState)
  }
  const scheduler = schedulerRef.current

  const record = useCallback<TrainingApi['record']>(
    (input) =>
      recordResult({ ...input, now: input.now ?? clock(), scheduler }),
    [clock, scheduler],
  )

  const pickNext = useCallback<TrainingApi['pickNext']>(
    (pool, now) => scheduler.pickNext(rng, { now: now ?? clock(), pool }),
    [clock, rng, scheduler],
  )

  return useMemo(() => ({ scheduler, record, pickNext }), [scheduler, record, pickNext])
}

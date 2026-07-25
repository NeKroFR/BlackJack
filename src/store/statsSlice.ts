import type { StateCreator } from 'zustand'
import type { Action, Card } from '../engine/types'
import type { StoreState } from './index'

/** Skill buckets tracked for accuracy reporting. */
export type StatCategory =
  | 'basicSplit'
  | 'basicSoft'
  | 'basicStiff'
  | 'counting'
  | 'deviations'
  | 'betting'

export const STAT_CATEGORIES: StatCategory[] = [
  'basicSplit',
  'basicSoft',
  'basicStiff',
  'counting',
  'deviations',
  'betting',
]

export interface AccuracyCounter {
  correct: number
  total: number
}

export type AccuracyMap = Record<StatCategory, AccuracyCounter>

/** A logged mistake for later review. The caller supplies `timestamp` (and `id`). The store never calls Date.now. */
export interface MistakeEntry {
  id: string
  category: StatCategory
  playerCards: Card[]
  /** Dealer upcard bucket (1 = Ace .. 10 = ten-valued). */
  dealerUp: number
  trueCount?: number
  chosen: Action
  correct: Action
  /** EV lost by choosing `chosen` instead of `correct` (<= 0). */
  evDelta: number
  timestamp: number
}

/** A completed drill/session summary appended to history. */
export interface SessionRecord {
  id: string
  mode: string
  startedAt: number
  endedAt: number
  hands: number
  correct: number
  total: number
  pnl?: number
}

export interface StatsState {
  accuracy: AccuracyMap
  streak: number
  bestStreak: number
  /** Counting speed in cards per minute (rolling estimate). */
  cpm: number
  sessionHistory: SessionRecord[]
  mistakeLog: MistakeEntry[]
}

export interface StatsActions {
  /** Record a graded answer: bumps the category counter and the correct/streak state. */
  recordAnswer(category: StatCategory, correct: boolean): void
  /** Append a fully-formed mistake entry (caller owns id + timestamp). */
  logMistake(entry: MistakeEntry): void
  /** Blend a new cards-per-minute sample into the rolling estimate. */
  updateCpm(cpm: number): void
  addSession(record: SessionRecord): void
  removeMistake(id: string): void
  clearMistakes(): void
  resetStats(): void
}

export type StatsSlice = StatsState & StatsActions

const emptyAccuracy = (): AccuracyMap => ({
  basicSplit: { correct: 0, total: 0 },
  basicSoft: { correct: 0, total: 0 },
  basicStiff: { correct: 0, total: 0 },
  counting: { correct: 0, total: 0 },
  deviations: { correct: 0, total: 0 },
  betting: { correct: 0, total: 0 },
})

export const DEFAULT_STATS: StatsState = {
  accuracy: emptyAccuracy(),
  streak: 0,
  bestStreak: 0,
  cpm: 0,
  sessionHistory: [],
  mistakeLog: [],
}

/** Accuracy as a 0..1 fraction, 0 when nothing has been answered. */
export function accuracyPct(counter: AccuracyCounter): number {
  return counter.total === 0 ? 0 : counter.correct / counter.total
}

export const createStatsSlice: StateCreator<StoreState, [], [], StatsSlice> = (set) => ({
  ...DEFAULT_STATS,
  recordAnswer: (category, correct) =>
    set((s) => {
      const prev = s.accuracy[category]
      const next: AccuracyCounter = {
        correct: prev.correct + (correct ? 1 : 0),
        total: prev.total + 1,
      }
      const streak = correct ? s.streak + 1 : 0
      return {
        accuracy: { ...s.accuracy, [category]: next },
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
      }
    }),
  logMistake: (entry) => set((s) => ({ mistakeLog: [entry, ...s.mistakeLog] })),
  updateCpm: (cpm) =>
    set((s) => ({ cpm: s.cpm === 0 ? cpm : Math.round(s.cpm * 0.7 + cpm * 0.3) })),
  addSession: (record) => set((s) => ({ sessionHistory: [record, ...s.sessionHistory] })),
  removeMistake: (id) => set((s) => ({ mistakeLog: s.mistakeLog.filter((m) => m.id !== id) })),
  clearMistakes: () => set({ mistakeLog: [] }),
  resetStats: () =>
    set({
      accuracy: emptyAccuracy(),
      streak: 0,
      bestStreak: 0,
      cpm: 0,
      sessionHistory: [],
      mistakeLog: [],
    }),
})

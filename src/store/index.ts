import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  createSettingsSlice,
  DEFAULT_SETTINGS,
  type SettingsSlice,
  type SettingsState,
} from './settingsSlice'
import {
  createBankrollSlice,
  DEFAULT_BANKROLL,
  type BankrollSlice,
  type BankrollState,
} from './bankrollSlice'
import {
  createStatsSlice,
  DEFAULT_STATS,
  type StatsSlice,
  type StatsState,
} from './statsSlice'
import {
  createProgressSlice,
  DEFAULT_PROGRESS,
  type ProgressSlice,
  type ProgressState,
} from './progressSlice'
import { createGameSlice, type GameSlice } from './gameSlice'

export type StoreState = SettingsSlice & BankrollSlice & StatsSlice & ProgressSlice & GameSlice

/** The persisted projection of the store (everything except the transient game slice). */
export type PersistedState = SettingsState & BankrollState & StatsState & ProgressState

export const STORE_NAME = 'blackjack-trainer'
export const STORE_VERSION = 1

/** Pull only the persisted fields out of the full store state. */
export function pickPersisted(s: StoreState): PersistedState {
  return {
    // settings
    rules: s.rules,
    systemId: s.systemId,
    themeMode: s.themeMode,
    colorblind: s.colorblind,
    sound: s.sound,
    volume: s.volume,
    haptics: s.haptics,
    adviceMode: s.adviceMode,
    dealingSpeed: s.dealingSpeed,
    tableSeats: s.tableSeats,
    trueCountRounding: s.trueCountRounding,
    showIndexNumbers: s.showIndexNumbers,
    seenOnboarding: s.seenOnboarding,
    // bankroll
    bankroll: s.bankroll,
    unit: s.unit,
    sessionPnl: s.sessionPnl,
    betRamp: s.betRamp,
    // stats
    accuracy: s.accuracy,
    streak: s.streak,
    bestStreak: s.bestStreak,
    cpm: s.cpm,
    sessionHistory: s.sessionHistory,
    mistakeLog: s.mistakeLog,
    // progress
    curriculum: s.curriculum,
    unlockedModules: s.unlockedModules,
    xp: s.xp,
    level: s.level,
    achievements: s.achievements,
    dailyStreak: s.dailyStreak,
    lastActiveDay: s.lastActiveDay,
  }
}

export const useStore = create<StoreState>()(
  persist(
    (...a) => ({
      ...createSettingsSlice(...a),
      ...createBankrollSlice(...a),
      ...createStatsSlice(...a),
      ...createProgressSlice(...a),
      ...createGameSlice(...a),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      partialize: (state) => pickPersisted(state),
    },
  ),
)

// ---- Export / import --------------------------------------------------------

interface Envelope {
  name: typeof STORE_NAME
  version: number
  state: PersistedState
}

/** Serialize the persisted slice of state as a JSON string suitable for download. */
export function exportState(): string {
  const envelope: Envelope = {
    name: STORE_NAME,
    version: STORE_VERSION,
    state: pickPersisted(useStore.getState()),
  }
  return JSON.stringify(envelope, null, 2)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Structural validation of an imported persisted-state object. */
export function isValidPersistedState(v: unknown): v is PersistedState {
  if (!isRecord(v)) return false
  const req: [string, (x: unknown) => boolean][] = [
    ['rules', isRecord],
    ['systemId', (x) => typeof x === 'string'],
    ['themeMode', (x) => typeof x === 'string'],
    ['colorblind', (x) => typeof x === 'boolean'],
    ['adviceMode', (x) => typeof x === 'string'],
    ['dealingSpeed', (x) => typeof x === 'number'],
    ['tableSeats', (x) => typeof x === 'number'],
    ['bankroll', (x) => typeof x === 'number'],
    ['unit', (x) => typeof x === 'number'],
    ['betRamp', (x) => Array.isArray(x)],
    ['accuracy', isRecord],
    ['streak', (x) => typeof x === 'number'],
    ['sessionHistory', (x) => Array.isArray(x)],
    ['mistakeLog', (x) => Array.isArray(x)],
    ['curriculum', isRecord],
    ['unlockedModules', (x) => Array.isArray(x)],
    ['xp', (x) => typeof x === 'number'],
    ['achievements', (x) => Array.isArray(x)],
  ]
  return req.every(([key, ok]) => key in v && ok(v[key]))
}

/**
 * Replace the persisted slice of state from a JSON string produced by `exportState`
 * (a bare persisted-state object is also accepted). Returns false on malformed input.
 */
export function importState(json: string): boolean {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return false
  }
  const candidate = isRecord(parsed) && 'state' in parsed ? parsed.state : parsed
  if (!isValidPersistedState(candidate)) return false
  useStore.setState(candidate)
  return true
}

/** Restore all persisted slices to their defaults (leaves the transient game slice untouched). */
export function resetPersisted(): void {
  useStore.setState({
    ...DEFAULT_SETTINGS,
    ...DEFAULT_BANKROLL,
    ...DEFAULT_STATS,
    ...DEFAULT_PROGRESS,
  })
}

export * from './settingsSlice'
export * from './bankrollSlice'
export * from './statsSlice'
export * from './progressSlice'
export * from './gameSlice'

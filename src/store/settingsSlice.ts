import type { StateCreator } from 'zustand'
import type { CountingSystem, Rules } from '../engine/types'
import { DEFAULT_RULES } from '../engine/rules'
import type { StoreState } from './index'

export type ThemeMode = 'light' | 'dark' | 'system'
export type AdviceMode = 'always' | 'onDemand' | 'mistakes'
export type TrueCountRounding = 'quarter' | 'half' | 'full'

export interface SettingsState {
  rules: Rules
  systemId: CountingSystem['id']
  themeMode: ThemeMode
  colorblind: boolean
  sound: boolean
  /** Master output volume for synthesized sound cues, 0..1. */
  volume: number
  haptics: boolean
  adviceMode: AdviceMode
  /** Cards per minute pacing for drills/dealing (higher = faster). */
  dealingSpeed: number
  /** Number of other seated players at the live table, 0..6. */
  tableSeats: number
  trueCountRounding: TrueCountRounding
  showIndexNumbers: boolean
  /** Whether the first-run welcome has been shown/dismissed. */
  seenOnboarding: boolean
}

export interface SettingsActions {
  setRules(rules: Rules): void
  patchRules(partial: Partial<Rules>): void
  setSystemId(id: CountingSystem['id']): void
  setThemeMode(mode: ThemeMode): void
  setColorblind(on: boolean): void
  setSound(on: boolean): void
  setVolume(volume: number): void
  setHaptics(on: boolean): void
  setAdviceMode(mode: AdviceMode): void
  setDealingSpeed(cpm: number): void
  setTableSeats(seats: number): void
  setTrueCountRounding(rounding: TrueCountRounding): void
  setShowIndexNumbers(on: boolean): void
  setSeenOnboarding(on: boolean): void
  resetSettings(): void
}

export type SettingsSlice = SettingsState & SettingsActions

export const DEFAULT_SETTINGS: SettingsState = {
  rules: DEFAULT_RULES,
  systemId: 'hilo',
  themeMode: 'system',
  colorblind: false,
  sound: true,
  volume: 0.7,
  haptics: true,
  adviceMode: 'mistakes',
  dealingSpeed: 60,
  tableSeats: 0,
  trueCountRounding: 'full',
  showIndexNumbers: true,
  seenOnboarding: false,
}

const clampSeats = (n: number) => Math.max(0, Math.min(6, Math.round(n)))

export const createSettingsSlice: StateCreator<StoreState, [], [], SettingsSlice> = (set) => ({
  ...DEFAULT_SETTINGS,
  setRules: (rules) => set({ rules }),
  patchRules: (partial) => set((s) => ({ rules: { ...s.rules, ...partial } })),
  setSystemId: (systemId) => set({ systemId }),
  setThemeMode: (themeMode) => set({ themeMode }),
  setColorblind: (colorblind) => set({ colorblind }),
  setSound: (sound) => set({ sound }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  setHaptics: (haptics) => set({ haptics }),
  setAdviceMode: (adviceMode) => set({ adviceMode }),
  setDealingSpeed: (dealingSpeed) => set({ dealingSpeed: Math.max(1, dealingSpeed) }),
  setTableSeats: (seats) => set({ tableSeats: clampSeats(seats) }),
  setTrueCountRounding: (trueCountRounding) => set({ trueCountRounding }),
  setShowIndexNumbers: (showIndexNumbers) => set({ showIndexNumbers }),
  setSeenOnboarding: (seenOnboarding) => set({ seenOnboarding }),
  resetSettings: () => set({ ...DEFAULT_SETTINGS }),
})

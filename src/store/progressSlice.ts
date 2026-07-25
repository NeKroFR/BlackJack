import type { StateCreator } from 'zustand'
import type { StoreState } from './index'

/** XP required per level grows linearly. Level 1 starts at 0 XP. */
export const XP_PER_LEVEL = 100

export function levelForXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1
}

export interface ProgressState {
  /** moduleId -> completed. */
  curriculum: Record<string, boolean>
  unlockedModules: string[]
  xp: number
  level: number
  achievements: string[]
  dailyStreak: number
  /** ISO day string (YYYY-MM-DD) of last activity. Caller supplies it, store never reads the clock. */
  lastActiveDay: string | null
}

export interface ProgressActions {
  completeModule(moduleId: string): void
  unlockModule(moduleId: string): void
  addXp(amount: number): void
  awardAchievement(id: string): void
  /**
   * Record activity for `today` (ISO day). Pass `yesterday` so the store can extend
   * the streak without doing date math itself.
   */
  markActiveDay(today: string, yesterday: string): void
  resetProgress(): void
}

export type ProgressSlice = ProgressState & ProgressActions

export const DEFAULT_PROGRESS: ProgressState = {
  curriculum: {},
  unlockedModules: ['basic-strategy'],
  xp: 0,
  level: 1,
  achievements: [],
  dailyStreak: 0,
  lastActiveDay: null,
}

export const createProgressSlice: StateCreator<StoreState, [], [], ProgressSlice> = (set) => ({
  ...DEFAULT_PROGRESS,
  completeModule: (moduleId) =>
    set((s) => ({ curriculum: { ...s.curriculum, [moduleId]: true } })),
  unlockModule: (moduleId) =>
    set((s) =>
      s.unlockedModules.includes(moduleId)
        ? s
        : { unlockedModules: [...s.unlockedModules, moduleId] },
    ),
  addXp: (amount) =>
    set((s) => {
      const xp = Math.max(0, s.xp + amount)
      return { xp, level: levelForXp(xp) }
    }),
  awardAchievement: (id) =>
    set((s) =>
      s.achievements.includes(id) ? s : { achievements: [...s.achievements, id] },
    ),
  markActiveDay: (today, yesterday) =>
    set((s) => {
      if (s.lastActiveDay === today) return s
      const dailyStreak = s.lastActiveDay === yesterday ? s.dailyStreak + 1 : 1
      return { dailyStreak, lastActiveDay: today }
    }),
  resetProgress: () => set({ ...DEFAULT_PROGRESS }),
})

import type { StateCreator } from 'zustand'
import type { BetRamp } from '../engine/betting'
import type { StoreState } from './index'

export interface BankrollState {
  /** Total bankroll in currency units. */
  bankroll: number
  /** One betting unit in currency units. */
  unit: number
  /** Net profit/loss for the current session (resets on new session). */
  sessionPnl: number
  /** Active bet ramp (true count -> units). */
  betRamp: BetRamp
}

export interface BankrollActions {
  setBankroll(amount: number): void
  setUnit(amount: number): void
  setBetRamp(ramp: BetRamp): void
  /** Remove a stake from the bankroll as it goes into action. */
  bet(stake: number): void
  /** Return `payout` to the bankroll when a hand resolves (0 on a loss, stake on push, more on a win). */
  settle(payout: number): void
  /** Zero the session P/L without touching the bankroll. */
  resetSession(): void
  /** Restore bankroll/unit/session to defaults. */
  resetBankroll(): void
}

export type BankrollSlice = BankrollState & BankrollActions

export const DEFAULT_BET_RAMP: BetRamp = [
  { minTrueCount: 1, units: 1 },
  { minTrueCount: 2, units: 2 },
  { minTrueCount: 3, units: 4 },
  { minTrueCount: 4, units: 8 },
  { minTrueCount: 5, units: 12 },
]

export const DEFAULT_BANKROLL: BankrollState = {
  bankroll: 1000,
  unit: 25,
  sessionPnl: 0,
  betRamp: DEFAULT_BET_RAMP,
}

export const createBankrollSlice: StateCreator<StoreState, [], [], BankrollSlice> = (set) => ({
  ...DEFAULT_BANKROLL,
  setBankroll: (bankroll) => set({ bankroll }),
  setUnit: (unit) => set({ unit: Math.max(0, unit) }),
  setBetRamp: (betRamp) => set({ betRamp }),
  bet: (stake) => set((s) => ({ bankroll: s.bankroll - stake, sessionPnl: s.sessionPnl - stake })),
  settle: (payout) => set((s) => ({ bankroll: s.bankroll + payout, sessionPnl: s.sessionPnl + payout })),
  resetSession: () => set({ sessionPnl: 0 }),
  resetBankroll: () => set({ ...DEFAULT_BANKROLL }),
})

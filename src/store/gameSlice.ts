import type { StateCreator } from 'zustand'
import type { Card } from '../engine/types'
import type { StoreState } from './index'

export type GamePhase =
  | 'idle'
  | 'betting'
  | 'dealing'
  | 'playerTurn'
  | 'dealerTurn'
  | 'settlement'
  | 'shuffle'

/** A single player hand at the live table (supports splits). */
export interface TableHand {
  cards: Card[]
  bet: number
  /** True once the hand is finished (stood/busted/blackjack/surrendered). */
  done: boolean
  doubled: boolean
  surrendered: boolean
}

export interface GameState {
  phase: GamePhase
  /** Undealt cards remaining in the shoe. */
  shoe: Card[]
  /** Cards revealed so far this shoe (feeds the running count). */
  seen: Card[]
  dealerHand: Card[]
  playerHands: TableHand[]
  activeHandIndex: number
  runningCount: number
  trueCount: number
  /** Cards dealt since the last shuffle (for penetration). */
  cardsDealt: number
}

export interface GameActions {
  setPhase(phase: GamePhase): void
  /** Load a fresh shoe and clear the round + count. */
  newShoe(shoe: Card[]): void
  /** Shallow-merge a partial update into the live game state. */
  patchGame(partial: Partial<GameState>): void
  setCount(runningCount: number, trueCount: number): void
  /** Clear the table for a new round while keeping the shoe/count. */
  clearRound(): void
  /** Full reset back to idle with an empty shoe. */
  resetGame(): void
}

export type GameSlice = GameState & GameActions

export const INITIAL_GAME: GameState = {
  phase: 'idle',
  shoe: [],
  seen: [],
  dealerHand: [],
  playerHands: [],
  activeHandIndex: 0,
  runningCount: 0,
  trueCount: 0,
  cardsDealt: 0,
}

export const createGameSlice: StateCreator<StoreState, [], [], GameSlice> = (set) => ({
  ...INITIAL_GAME,
  setPhase: (phase) => set({ phase }),
  newShoe: (shoe) =>
    set({
      ...INITIAL_GAME,
      shoe,
      phase: 'betting',
    }),
  patchGame: (partial) => set(partial),
  setCount: (runningCount, trueCount) => set({ runningCount, trueCount }),
  clearRound: () =>
    set({
      phase: 'betting',
      dealerHand: [],
      playerHands: [],
      activeHandIndex: 0,
    }),
  resetGame: () => set({ ...INITIAL_GAME }),
})

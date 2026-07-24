// Core domain types shared across the engine and UI. Do not redefine elsewhere, import them.

export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K'
export type Suit = 'S' | 'H' | 'D' | 'C' // spades, hearts, diamonds, clubs

export interface Card {
  rank: Rank
  suit: Suit
  /** Unique within a shoe instance. Used for React keys and deal animations. */
  id: string
}

/**
 * Card-value bucket used by the combinatorial EV engine.
 * 1 = Ace, 2..9 = pip cards, 10 = every ten-valued card (T, J, Q, K).
 */
export type Bucket = number // 1..10

/**
 * Remaining-card counts per bucket. Length 11, index 0 unused so
 * `comp[bucket]` reads naturally. `comp[1]` = aces left, `comp[10]` = tens left.
 */
export type Composition = number[]

export type Action = 'stand' | 'hit' | 'double' | 'split' | 'surrender'

/** A player or dealer hand, just its cards. Totals are derived by cards.ts helpers. */
export interface Hand {
  cards: Card[]
}

// ---- Rules -----------------------------------------------------------------

export type SoftSeventeen = 'H17' | 'S17'
export type SurrenderRule = 'none' | 'late' | 'early'
export type BlackjackPayout = '3:2' | '6:5' | '2:1' | '1:1'
export type DoubleRule = 'any2' | '9-11' | '10-11'

export interface Rules {
  decks: 1 | 2 | 4 | 6 | 8
  soft17: SoftSeventeen
  /** Double after split allowed. */
  das: boolean
  /** Which starting totals may double. */
  double: DoubleRule
  /** Total number of hands a player may reach via splitting (e.g. 4). */
  maxSplitHands: number
  resplitAces: boolean
  hitSplitAces: boolean
  surrender: SurrenderRule
  blackjackPayout: BlackjackPayout
  /** true = US game, dealer peeks for blackjack. false = European no-hole-card (ENHC). */
  dealerPeek: boolean
  insurance: boolean
  /** Fraction of the shoe dealt before reshuffle, 0..1 (e.g. 0.75 for 4.5/6 decks). */
  penetration: number
}

// ---- EV engine outputs -----------------------------------------------------

export interface ActionEv {
  action: Action
  /** Expected value in units of the base bet, roughly [-2, +2]. */
  ev: number
}

export interface InsuranceDecision {
  takeEv: number
  declineEv: number
  recommend: boolean
}

export interface Decision {
  best: Action
  /** All legal actions, sorted by EV descending. */
  ranked: ActionEv[]
  insurance?: InsuranceDecision
  /** Human-readable "why", citing the top actions and their EVs. */
  explanation: string
}

/** Probability distribution of the dealer's final outcome. Probabilities sum to 1. */
export interface DealerDist {
  p17: number
  p18: number
  p19: number
  p20: number
  p21: number
  pBust: number
  pBlackjack: number
}

// ---- Counting --------------------------------------------------------------

export interface CountingSystem {
  id: 'hilo' | 'ko' | 'wong-halves' | 'omega2' | 'zen'
  name: string
  /** Balanced systems use true count. Unbalanced (KO) use running count only. */
  balanced: boolean
  level: 1 | 2 | 3
  /** Point value per bucket (1..10). Fractional tags allowed (Wong Halves). */
  tags: Record<Bucket, number>
  usesTrueCount: boolean
  /** Initial running count (Initial Running Count), nonzero for unbalanced systems. */
  runningCountStart: (decks: number) => number
  /** Whether the system is played with a separate ace side-count. */
  sideCountAces: boolean
}

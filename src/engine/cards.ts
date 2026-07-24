import type { Bucket, Card, Composition, Rank, Suit } from './types'

export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']
export const SUITS: Suit[] = ['S', 'H', 'D', 'C']

/** Map a rank to its EV-engine bucket (1 = Ace, 2..9 pips, 10 = any ten). */
export function bucket(rank: Rank): Bucket {
  if (rank === 'A') return 1
  if (rank === 'T' || rank === 'J' || rank === 'Q' || rank === 'K') return 10
  return Number(rank) as Bucket
}

/** Best total for a hand with soft-ace handling, plus whether it is soft. */
export function handTotal(cards: Card[]): { total: number; soft: boolean } {
  let total = 0
  let aces = 0
  for (const c of cards) {
    const b = bucket(c.rank)
    total += b
    if (b === 1) aces++
  }
  // Promote a single ace from 1 to 11 when it doesn't bust.
  let soft = false
  if (aces > 0 && total + 10 <= 21) {
    total += 10
    soft = true
  }
  return { total, soft }
}

export function isBust(cards: Card[]): boolean {
  return handTotal(cards).total > 21
}

/** Natural blackjack: exactly two cards totaling 21. */
export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards).total === 21
}

/** A pair (by value) can be split. */
export function isPair(cards: Card[]): boolean {
  return cards.length === 2 && bucket(cards[0].rank) === bucket(cards[1].rank)
}

/** Build an ordered shoe of `decks` 52-card decks with stable unique ids. */
export function buildShoe(decks: number): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) {
        cards.push({ rank: r, suit: s, id: `${d}-${s}-${r}` })
      }
    }
  }
  return cards
}

export type Rng = () => number

/** Immutable Fisher–Yates shuffle with an injectable RNG (for deterministic tests). */
export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

/** Mulberry32: tiny seedable RNG for reproducible shuffles and Monte-Carlo. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fresh composition for a full shoe of `decks` decks. */
export function compositionFromDecks(decks: number): Composition {
  const comp = new Array(11).fill(0)
  for (let v = 1; v <= 9; v++) comp[v] = 4 * decks
  comp[10] = 16 * decks
  return comp
}

/** Composition of an explicit list of cards. */
export function compositionFromCards(cards: Card[]): Composition {
  const comp = new Array(11).fill(0)
  for (const c of cards) comp[bucket(c.rank)]++
  return comp
}

/** Immutable removal of one card of the given bucket value. */
export function removeFromComposition(comp: Composition, value: Bucket): Composition {
  const c = comp.slice()
  c[value] = Math.max(0, c[value] - 1)
  return c
}

/** Total cards remaining in a composition. */
export function totalCards(comp: Composition): number {
  let n = 0
  for (let v = 1; v <= 10; v++) n += comp[v]
  return n
}

/** Stable key for memoizing EV/dealer recursions on a composition. */
export function compKey(comp: Composition): string {
  return comp.slice(1, 11).join(',')
}

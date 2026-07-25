import { mulberry32, type Rng } from './cards'

/**
 * Deck-estimation helpers for the "read the discard tray" skill (SPEC §5, §10.1).
 *
 * A player estimates how many decks are LEFT in the shoe by eyeballing the
 * height of the discard tray. From that estimate they convert a running count
 * into a true count. Everything here is pure and RNG-injectable.
 */

const CARDS_PER_DECK = 52

/** Cards remaining, clamped so estimates never report a negative height. */
export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

/**
 * Decks still in the shoe given how many decks sit in the discard tray.
 * Result is clamped to [0, totalDecks].
 */
export function decksRemainingFromDiscard(discardDecks: number, totalDecks: number): number {
  return clamp(totalDecks - discardDecks, 0, totalDecks)
}

/**
 * True count from a running count and a discard-tray reading, using the same
 * `running / max(decksRemaining, 0.5)` convention as counting/index.ts so a
 * near-empty shoe never explodes the divisor.
 */
export function estimateTrueCount(running: number, discardDecks: number, totalDecks: number): number {
  const remaining = decksRemainingFromDiscard(discardDecks, totalDecks)
  return running / Math.max(remaining, 0.5)
}

/** Rounding granularity a player mentally snaps the tray height to. */
export type DeckRounding = 'quarter' | 'half' | 'full'

const STEP: Record<DeckRounding, number> = {
  quarter: 0.25,
  half: 0.5,
  full: 1,
}

/** Snap a deck count to the nearest quarter / half / full deck. */
export function roundDecks(decks: number, to: DeckRounding): number {
  const step = STEP[to]
  return Math.round(decks / step) * step
}

/**
 * Number of cards dealt before the cut card, i.e. `totalDecks * penetration`
 * decks converted to whole cards. Penetration is a fraction in [0, 1].
 */
export function penetrationCards(totalDecks: number, penetration: number): number {
  const frac = clamp(penetration, 0, 1)
  return Math.round(totalDecks * frac * CARDS_PER_DECK)
}

// ---- Estimation drill ------------------------------------------------------

/** A single "how many decks are left?" flashcard for the estimation drill. */
export interface DiscardDrill {
  /** Shoe size the drill is set in. */
  totalDecks: number
  /** Decks shown sitting in the discard tray (the visual prompt). */
  discardDecks: number
  /** The exact truth the player must approximate. */
  decksRemaining: number
  /** Accepted absolute error, in decks, for a correct answer. */
  tolerance: number
}

/**
 * Generate a random discard-tray estimation question. Picks a plausible amount
 * of played cards (never past the cut) and snaps the tray reading to the given
 * rounding so it mirrors what a player actually sees. Pure: pass a seeded
 * `rng` (e.g. `mulberry32(seed)`) for reproducible drills.
 */
export function makeDiscardDrill(
  totalDecks: number,
  rng: Rng = mulberry32(0),
  opts: { tolerance?: number; rounding?: DeckRounding } = {},
): DiscardDrill {
  const tolerance = opts.tolerance ?? 0.5
  const rounding = opts.rounding ?? 'quarter'
  // Deal somewhere between a fresh shoe and ~90% penetration.
  const dealtDecks = rng() * totalDecks * 0.9
  const discardDecks = clamp(roundDecks(dealtDecks, rounding), 0, totalDecks)
  const decksRemaining = decksRemainingFromDiscard(discardDecks, totalDecks)
  return { totalDecks, discardDecks, decksRemaining, tolerance }
}

/** Whether a player's guess is within the drill's tolerance band. */
export function isDrillAnswerCorrect(drill: DiscardDrill, guessDecksRemaining: number): boolean {
  return Math.abs(guessDecksRemaining - drill.decksRemaining) <= drill.tolerance + 1e-9
}

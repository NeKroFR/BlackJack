import type { Card, CountingSystem } from '../types'
import { bucket } from '../cards'

/**
 * Running count over cards seen so far. Sum of the system's tags per seen card.
 * Does NOT include the system's initial running count (the shoe's starting
 * value, added at shoe setup). Use `runningCountWithStart` to fold in the IRC.
 */
export function runningCount(seen: Card[], sys: CountingSystem): number {
  let rc = 0
  for (const c of seen) rc += sys.tags[bucket(c.rank)]
  return rc
}

/**
 * Running count including the system's Initial Running Count for `decks` decks.
 * Balanced systems have IRC 0. Unbalanced systems (KO) start negative.
 */
export function runningCountWithStart(
  seen: Card[],
  sys: CountingSystem,
  decks: number,
): number {
  return sys.runningCountStart(decks) + runningCount(seen, sys)
}

/**
 * Decks remaining from cards seen. Optionally round to the nearest
 * quarter/half/full deck (dealer-estimation convenience).
 */
export function decksRemaining(
  cardsSeen: number,
  totalDecks: number,
  round?: 'quarter' | 'half' | 'full',
): number {
  const raw = (totalDecks * 52 - cardsSeen) / 52
  if (!round) return raw
  const step = round === 'quarter' ? 0.25 : round === 'half' ? 0.5 : 1
  return Math.round(raw / step) * step
}

/** True count = running count per remaining deck, clamped to avoid blow-ups. */
export function trueCount(running: number, decksRemaining: number): number {
  return running / Math.max(decksRemaining, 0.5)
}

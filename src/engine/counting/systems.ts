import type { CountingSystem } from '../types'

/**
 * Counting-system tag tables. Bucket keys are 1 (Ace) .. 10 (tens).
 * NOTE for verification: balanced systems' tags, weighted by 4 cards each for
 * buckets 1..9 and 16 cards for bucket 10, must sum to 0 over a full deck.
 */

export const HILO: CountingSystem = {
  id: 'hilo',
  name: 'Hi-Lo',
  balanced: true,
  level: 1,
  usesTrueCount: true,
  sideCountAces: false,
  runningCountStart: () => 0,
  tags: { 1: -1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: -1 },
}

// KO (Knock-Out): unbalanced level-1. Differs from Hi-Lo only in that 7 counts +1.
// Standard IRC = 4 - 4*decks (0 for 1 deck, -20 for 6 decks) so the pivot sits at +4.
export const KO: CountingSystem = {
  id: 'ko',
  name: 'KO (Knock-Out)',
  balanced: false,
  level: 1,
  usesTrueCount: false,
  sideCountAces: false,
  runningCountStart: (decks) => 4 - 4 * decks,
  tags: { 1: -1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 0, 9: 0, 10: -1 },
}

// Wong Halves: balanced level-3 (fractional tags). One of the strongest systems.
export const WONG_HALVES: CountingSystem = {
  id: 'wong-halves',
  name: 'Wong Halves',
  balanced: true,
  level: 3,
  usesTrueCount: true,
  sideCountAces: false,
  runningCountStart: () => 0,
  tags: { 1: -1, 2: 0.5, 3: 1, 4: 1, 5: 1.5, 6: 1, 7: 0.5, 8: 0, 9: -0.5, 10: -1 },
}

// Omega II: balanced level-2, played with an ace side-count.
export const OMEGA_II: CountingSystem = {
  id: 'omega2',
  name: 'Omega II',
  balanced: true,
  level: 2,
  usesTrueCount: true,
  sideCountAces: true,
  runningCountStart: () => 0,
  tags: { 1: 0, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 1, 8: 0, 9: -1, 10: -2 },
}

// Zen Count: balanced level-2 all-rounder.
export const ZEN: CountingSystem = {
  id: 'zen',
  name: 'Zen Count',
  balanced: true,
  level: 2,
  usesTrueCount: true,
  sideCountAces: false,
  runningCountStart: () => 0,
  tags: { 1: -1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 1, 8: 0, 9: 0, 10: -2 },
}

export const SYSTEMS: CountingSystem[] = [HILO, KO, WONG_HALVES, OMEGA_II, ZEN]

/** Featured systems shown up front. Rest live under an "advanced" selector. */
export const FEATURED_SYSTEM_IDS: CountingSystem['id'][] = ['hilo', 'ko']

export function getSystem(id: CountingSystem['id']): CountingSystem {
  const s = SYSTEMS.find((x) => x.id === id)
  if (!s) throw new Error(`Unknown counting system: ${id}`)
  return s
}

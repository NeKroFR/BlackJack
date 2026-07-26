// Strategy-trainer situation model.
//
// A "situation" is the trainable unit of basic strategy: a player hand shape
// (pair / soft / hard total) versus a dealer upcard. Each situation has a
// stable string key (e.g. `H16v10`, `S18v6`, `P8v1`) that the spaced-repetition
// scheduler uses to resurface the hands a player misses most.
//
// Card generation deals real Card objects out of a freshly shuffled shoe for the
// active rules, so the composition handed to the EV engine reflects true card
// removal. Hard totals use the same modal composition (`ten + (total - 10)`) as
// the engine's `basicStrategyChart`, so the trainer's grading matches the
// rule-aware Reference chart cell-for-cell.

import type { Action, Bucket, Card, Composition, Decision, Rules } from '../../engine/types'
import type { StatCategory } from '../../store'
import {
  buildShoe,
  shuffle,
  bucket,
  isPair,
  handTotal,
  compositionFromCards,
  type Rng,
} from '../../engine/cards'

export type SituationKind = 'pair' | 'soft' | 'hard'

export interface Situation {
  kind: SituationKind
  /** Pair: the bucket (1 = Aces, 10 = tens). Soft/Hard: the hand total. */
  value: number
  /** Dealer upcard bucket, 1..10 (1 = Ace). */
  up: number
}

export type FocusFilter = 'all' | 'pairs' | 'soft' | 'stiff' | 'surrenders'

export const FOCUS_LABELS: Record<FocusFilter, string> = {
  all: 'All',
  pairs: 'Pairs',
  soft: 'Soft',
  stiff: 'Stiffs',
  surrenders: 'Surrenders',
}

/** Dealer upcards, Ace last (bucket 1). */
const UPCARDS: number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]

const KIND_PREFIX: Record<SituationKind, string> = { pair: 'P', soft: 'S', hard: 'H' }

/** Encode a situation as its stable spaced-repetition key. */
export function situationKey(sit: Situation): string {
  return `${KIND_PREFIX[sit.kind]}${sit.value}v${sit.up}`
}

const KEY_RE = /^([PSH])(\d+)v(\d+)$/
const PREFIX_KIND: Record<string, SituationKind> = { P: 'pair', S: 'soft', H: 'hard' }

/** Decode a key produced by `situationKey`. Returns null on malformed input. */
export function parseSituationKey(key: string): Situation | null {
  const m = KEY_RE.exec(key)
  if (!m) return null
  const kind = PREFIX_KIND[m[1]]
  return { kind, value: Number(m[2]), up: Number(m[3]) }
}

// ---- Situation pools per focus filter --------------------------------------

/** Non-pair hard totals offered under the "All" filter. */
const HARD_TOTALS_ALL = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
/** Soft totals A2..A9 → 13..20. */
const SOFT_TOTALS = [13, 14, 15, 16, 17, 18, 19, 20]
/** Pair buckets: Aces (1), 2..9, tens (10). */
const PAIR_BUCKETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function keysFor(kind: SituationKind, values: number[], ups: number[] = UPCARDS): string[] {
  const out: string[] = []
  for (const v of values) for (const up of ups) out.push(situationKey({ kind, value: v, up }))
  return out
}

/** The full situation key space for a focus filter (the spaced-rep pool). */
export function poolFor(focus: FocusFilter): string[] {
  switch (focus) {
    case 'pairs':
      return keysFor('pair', PAIR_BUCKETS)
    case 'soft':
      return keysFor('soft', SOFT_TOTALS)
    case 'stiff':
      return keysFor('hard', [12, 13, 14, 15, 16])
    case 'surrenders':
      // Hands where surrender is a live option: the classic 14–17 vs 9/10/A,
      // plus 8-8 vs a ten or ace.
      return [
        ...keysFor('hard', [14, 15, 16, 17], [9, 10, 1]),
        ...keysFor('pair', [8], [10, 1]),
      ]
    case 'all':
    default:
      return [
        ...keysFor('hard', HARD_TOTALS_ALL),
        ...keysFor('soft', SOFT_TOTALS),
        ...keysFor('pair', PAIR_BUCKETS),
      ]
  }
}

// ---- Card generation -------------------------------------------------------

/**
 * Representative non-pair hard hand for each total. Mirrors the engine's
 * `basicStrategyChart` HARD_REP: stiff totals use their modal `ten + (total-10)`
 * composition so borderline surrender/stand cells (15 v 10, 16 v 10) resolve to
 * the canonical total-dependent chart.
 */
const HARD_REP: Record<number, number[]> = {
  5: [2, 3],
  6: [2, 4],
  7: [3, 4],
  8: [3, 5],
  9: [4, 5],
  10: [4, 6],
  11: [5, 6],
  12: [10, 2],
  13: [10, 3],
  14: [10, 4],
  15: [10, 5],
  16: [10, 6],
  17: [10, 7],
  18: [10, 8],
  19: [10, 9],
  20: [10, 6, 4],
}

const RANK_FOR_BUCKET: Record<number, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'T',
}

export interface DealtSituation {
  situation: Situation
  playerCards: Card[]
  dealerUpCard: Card
  /** Composition AFTER removing the player cards and dealer upcard. */
  comp: Composition
}

/** Bucket values that make up the player's two/three cards for a situation. */
function playerBucketsFor(sit: Situation): number[] {
  if (sit.kind === 'pair') return [sit.value, sit.value]
  if (sit.kind === 'soft') return [1, sit.value - 11]
  const rep = HARD_REP[sit.value]
  if (rep) return rep
  // Fallback: a ten plus the remainder (kept off the pair row where possible).
  const other = sit.value - 10
  return other >= 2 && other <= 9 ? [10, other] : [sit.value - 3, 3]
}

/**
 * Deal a concrete hand + dealer upcard matching `sit` out of a freshly shuffled
 * shoe for `rules`. Real cards are removed from the shoe, so `comp` reflects true
 * card removal. Deterministic for a given `rng`.
 */
export function dealSituation(sit: Situation, rules: Rules, rng: Rng = Math.random): DealtSituation {
  const shoe = shuffle(buildShoe(rules.decks), rng)

  const takeBucket = (b: Bucket): Card => {
    const i = shoe.findIndex((c) => bucket(c.rank) === b)
    if (i >= 0) return shoe.splice(i, 1)[0]
    // Shoe exhausted of this bucket (only under tiny synthetic decks): synthesize.
    return { rank: RANK_FOR_BUCKET[b] as Card['rank'], suit: 'S', id: `synth-${b}-${shoe.length}` }
  }

  const playerCards = playerBucketsFor(sit).map((b) => takeBucket(b))
  const dealerUpCard = takeBucket(sit.up as Bucket)
  const comp = compositionFromCards(shoe)
  return { situation: sit, playerCards, dealerUpCard, comp }
}

// ---- Legality + categorisation ---------------------------------------------

export interface Legality {
  hit: boolean
  stand: boolean
  double: boolean
  split: boolean
  surrender: boolean
}

/** Whether the rules permit doubling this starting total. */
export function doubleAllowed(total: number, soft: boolean, rules: Rules): boolean {
  if (rules.double === 'any2') return true
  if (soft) return false // ranged double rules apply to hard totals only
  if (rules.double === '9-11') return total >= 9 && total <= 11
  if (rules.double === '10-11') return total >= 10 && total <= 11
  return false
}

/** Legal actions for a fresh two-card hand under `rules`. */
export function legalActions(playerCards: Card[], rules: Rules): Legality {
  const { total, soft } = handTotal(playerCards)
  const twoCard = playerCards.length === 2
  return {
    hit: true,
    stand: true,
    double: twoCard && doubleAllowed(total, soft, rules),
    split: twoCard && isPair(playerCards) && rules.maxSplitHands >= 2,
    surrender: twoCard && rules.surrender !== 'none',
  }
}

/** Stat category for a situation: split / soft / stiff (basic-strategy buckets). */
export function categoryFor(sit: Situation): StatCategory {
  if (sit.kind === 'pair') return 'basicSplit'
  if (sit.kind === 'soft') return 'basicSoft'
  return 'basicStiff'
}

// ---- Grading ---------------------------------------------------------------

export interface Grade {
  correct: boolean
  /** The engine's best action. */
  best: Action
  /** EV of the best action. */
  bestEv: number
  /** EV of the action the player chose (−Infinity if it was not legal). */
  chosenEv: number
  /** EV surrendered by the chosen action vs best (≤ 0). */
  evDelta: number
}

/**
 * Grade a chosen action against the engine's decision. `chosen === undefined`
 * (a timed-quiz timeout) is always wrong. A choice counts as correct when it is
 * the best action, or ties it within floating-point tolerance.
 */
export function gradeChoice(decision: Decision, chosen: Action | undefined): Grade {
  const best = decision.best
  const bestEv = decision.ranked[0]?.ev ?? 0
  const chosenEv =
    chosen === undefined
      ? -Infinity
      : decision.ranked.find((a) => a.action === chosen)?.ev ?? -Infinity
  const evDelta = Number.isFinite(chosenEv) ? Math.min(0, chosenEv - bestEv) : bestEv * -1 - 1
  const correct = chosen !== undefined && (chosen === best || Math.abs(chosenEv - bestEv) < 1e-9)
  return { correct, best, bestEv, chosenEv, evDelta }
}

import {
  bucket,
  compositionFromDecks,
  removeFromComposition,
  totalCards,
} from './cards'
import { evaluate } from './ev'
import { HILO } from './counting/systems'
import { trueCount } from './counting/index'
import type { Action, Card, Composition, Rank, Rules } from './types'

/**
 * Count-based index plays (SPEC §6).
 *
 * Two layers live here:
 *
 * 1. The canonical Hi-Lo data: the **Illustrious 18** playing deviations and the
 *    **Fab 4** late-surrender deviations, as typed, lookup-friendly tables. Each
 *    entry is the true count at/above which you switch from basic strategy to the
 *    listed `action`.
 * 2. A composition-driven derivation, {@link deriveIndex}, reproducing those
 *    numbers from first principles: it sweeps the true count by depleting the shoe
 *    (low cards raise the count, high cards lower it) and reports where
 *    {@link evaluate}'s best action flips. Reusing the EV engine, it works for any
 *    rules or hand, not just the memorised set, and powers the "why" per index.
 */

/** An index-play action: a normal player action, or the insurance side bet. */
export type DeviationAction = Action | 'insurance'

export interface IndexPlay {
  /**
   * Canonical hand key: a hard total ('9'..'16'), a pair of tens ('TT'), or the
   * special 'insurance' marker. Deviations in the Illustrious 18 / Fab 4 are all
   * total- or pair-dependent, so a string key is enough to look them up.
   */
  hand: string
  /** Dealer upcard bucket, 1..10 (1 = Ace). */
  dealerUpValue: number
  /** What you switch to at/above the index. */
  action: DeviationAction
  /** True count (Hi-Lo) at/above which the deviation applies. */
  index: number
}

/** Take insurance at Hi-Lo true count ≥ +3. */
export const INSURANCE_INDEX = 3

/**
 * The Illustrious 18: highest-value Hi-Lo playing deviations (Schlesinger),
 * insurance included as the famous first entry. `index` is the true count at or
 * above which you make the listed play instead of basic strategy. For negative
 * entries you deviate at or above the (negative) index, basic strategy below it.
 */
export const ILLUSTRIOUS_18: IndexPlay[] = [
  { hand: 'insurance', dealerUpValue: 1, action: 'insurance', index: INSURANCE_INDEX },
  { hand: '16', dealerUpValue: 10, action: 'stand', index: 0 },
  { hand: '15', dealerUpValue: 10, action: 'stand', index: 4 },
  { hand: 'TT', dealerUpValue: 5, action: 'split', index: 5 },
  { hand: 'TT', dealerUpValue: 6, action: 'split', index: 4 },
  { hand: '10', dealerUpValue: 10, action: 'double', index: 4 },
  { hand: '12', dealerUpValue: 3, action: 'stand', index: 2 },
  { hand: '12', dealerUpValue: 2, action: 'stand', index: 3 },
  { hand: '11', dealerUpValue: 1, action: 'double', index: 1 },
  { hand: '9', dealerUpValue: 2, action: 'double', index: 1 },
  { hand: '10', dealerUpValue: 1, action: 'double', index: 4 },
  { hand: '9', dealerUpValue: 7, action: 'double', index: 3 },
  { hand: '16', dealerUpValue: 9, action: 'stand', index: 5 },
  { hand: '13', dealerUpValue: 2, action: 'stand', index: -1 },
  { hand: '12', dealerUpValue: 4, action: 'stand', index: 0 },
  { hand: '12', dealerUpValue: 5, action: 'stand', index: -2 },
  { hand: '12', dealerUpValue: 6, action: 'stand', index: -1 },
  { hand: '13', dealerUpValue: 3, action: 'stand', index: -2 },
]

/**
 * The Fab 4: late-surrender deviations worth memorising in Hi-Lo. Surrender the
 * listed hard total at/above the index, hit (or play basic) below it.
 */
export const FAB_4: IndexPlay[] = [
  { hand: '14', dealerUpValue: 10, action: 'surrender', index: 3 },
  { hand: '15', dealerUpValue: 10, action: 'surrender', index: 0 },
  { hand: '15', dealerUpValue: 9, action: 'surrender', index: 2 },
  { hand: '15', dealerUpValue: 1, action: 'surrender', index: 1 },
]

/**
 * Canonical Hi-Lo index for a hand/upcard, looked up from the Illustrious 18
 * (insurance included). Returns `null` when the pairing is not a memorised
 * deviation. Use {@link deriveIndex} to compute one for an arbitrary hand/rules.
 */
export function indexFor(hand: string, dealerUpValue: number): number | null {
  const hit = ILLUSTRIOUS_18.find(
    (e) => e.hand === hand && e.dealerUpValue === dealerUpValue,
  )
  return hit ? hit.index : null
}

// ---- Composition-driven derivation -----------------------------------------

function mkCard(value: number, tag: string): Card {
  const rank: Rank = value === 1 ? 'A' : value === 10 ? 'T' : (String(value) as Rank)
  return { rank, suit: 'S', id: `dev-${tag}-${value}` }
}

/** Hi-Lo value of the cards STILL in the shoe (a full shoe sums to 0). */
function hiLoRemaining(comp: Composition): number {
  let s = 0
  for (let b = 1; b <= 10; b++) s += HILO.tags[b] * comp[b]
  return s
}

/**
 * True count implied by a composition. Everything dealt out of the shoe is
 * `fullShoe − comp`. Since a full shoe carries running count 0, the running
 * count of the seen cards is exactly `−hiLoRemaining(comp)`. Dividing by the
 * decks still in the shoe gives the true count a counter would hold at the table
 * (known player/dealer cards are already out of `comp`, so their tags fold in).
 */
function trueCountOf(comp: Composition): number {
  const running = -hiLoRemaining(comp)
  const decksLeft = totalCards(comp) / 52
  return trueCount(running, decksLeft)
}

/** Remove `n` cards, cycling through `pattern`, skipping exhausted buckets. */
function removeCycling(comp: Composition, n: number, pattern: number[]): Composition {
  let c = comp
  let removed = 0
  let i = 0
  let sinceProgress = 0
  while (removed < n && sinceProgress < pattern.length) {
    const b = pattern[i % pattern.length]
    if (c[b] > 0) {
      c = removeFromComposition(c, b)
      removed++
      sinceProgress = 0
    } else {
      sinceProgress++
    }
    i++
  }
  return c
}

// Card groups by Hi-Lo tag. Low cards (+1) and high cards (−1) drive the count.
// Neutral cards (0) go with the flow but do not move it. Tens outnumber aces
// ~4:1 in the shoe, so high removals follow that ratio to mirror real depletion.
const LOW_PATTERN = [2, 3, 4, 5, 6]
const HIGH_PATTERN = [10, 10, 10, 10, 1]
const NEUTRAL_PATTERN = [7, 8, 9]
/** Fraction of a shoe that is Hi-Lo-neutral (7,8,9): 12 of every 52 cards. */
const NEUTRAL_FRACTION = 12 / 52

/**
 * Build a realistically-depleted shoe from `base` (a full shoe with the known
 * table cards already removed) that carries approximately true count `targetTc`.
 *
 * A shoe reaches a true count by DEALING OUT cards, not by only shedding low
 * ones: to sit at TC +4 with `decksLeft` decks behind the cut card, the cards
 * already gone are a mix, more low than high plus a proportional slug of
 * neutrals. Modelling only low removals would force an unrealistically huge
 * running count to hit a given ten-density, pushing every derived index too
 * high. So we deal `dealt` cards: neutrals by their shoe fraction, the rest
 * low/high split to leave the target running count (`targetTc · decksLeft`). The
 * `low = dealt·20/52 + running/2`, `high = dealt·20/52 − running/2` split is
 * exactly the conditional-expected composition of a shoe dealt to that count.
 *
 * Penetration is kept shallow (`decksLeft ≈ 5/6 of the shoe`) on purpose: a
 * given true count is reached with a small perturbation of the full shoe, so the
 * derived crossovers stay close to the first-order effect-of-removal
 * linearisation the canonical Illustrious-18 / Fab-4 indices are built on, while
 * still deep enough to reach the true counts the sweep needs.
 */
function depletedShoe(base: Composition, decks: number, targetTc: number): Composition {
  const decksLeft = Math.max(0.5, (decks * 5) / 6)
  const dealt = Math.max(0, totalCards(base) - decksLeft * 52)
  const neutral = Math.round(dealt * NEUTRAL_FRACTION)
  const counted = dealt - neutral // low + high removals
  const running = targetTc * decksLeft // low − high
  let low = Math.round((counted + running) / 2)
  let high = counted - low
  if (low < 0) {
    high += low
    low = 0
  }
  if (high < 0) {
    low += high
    high = 0
  }
  let c = removeCycling(base, low, LOW_PATTERN)
  c = removeCycling(c, high, HIGH_PATTERN)
  c = removeCycling(c, neutral, NEUTRAL_PATTERN)
  return c
}

const TC_LO = -8
const TC_HI = 8
const COARSE_STEP = 0.5
const FINE_STEP = 0.1

/** Best action excluding surrender: count-deviation candidates are plays. */
function bestPlay(ranked: { action: Action; ev: number }[]): Action {
  for (const r of ranked) if (r.action !== 'surrender') return r.action
  return ranked[0].action
}

/**
 * Find the true count at which `crossed(tc)` first turns true while sweeping the
 * count upward, coarse then fine, and report the ACTUAL true count of the
 * composition there. Returns `null` if it never crosses.
 */
function sweepCrossover(
  base: Composition,
  decks: number,
  crossed: (comp: Composition) => boolean,
): number | null {
  let bracketLo = TC_LO
  let flipHi: number | null = null
  for (let tc = TC_LO; tc <= TC_HI + 1e-9; tc += COARSE_STEP) {
    if (crossed(depletedShoe(base, decks, tc))) {
      flipHi = tc
      break
    }
    bracketLo = tc
  }
  if (flipHi === null) return null

  let flip = depletedShoe(base, decks, flipHi)
  for (let tc = bracketLo + FINE_STEP; tc <= flipHi + 1e-9; tc += FINE_STEP) {
    const comp = depletedShoe(base, decks, tc)
    if (crossed(comp)) {
      flip = comp
      break
    }
  }
  return trueCountOf(flip)
}

/**
 * Derive the Hi-Lo index for a play from the EV engine: the true count at/above
 * which the deviation action overtakes the basic-strategy action.
 *
 * The shoe is swept from a strongly negative to a strongly positive count with
 * {@link depletedShoe}. The best non-surrender action at the extremes fixes the
 * basic ("low") and deviation ("high") candidates. The index is the crossover of
 * those TWO actions' EVs, a direct stand-vs-hit (or double-vs-hit, …) comparison,
 * matching how the canonical indices are defined. Comparing the two candidates
 * directly (rather than the global best) keeps a third option such as late
 * surrender (optimal only through the middle of the range) from masking the true
 * crossover (so 16 v 10 lands at ~0, not where standing finally beats
 * surrendering). Returns `null` when the action never flips.
 */
export function deriveIndex(
  playerCards: Card[],
  dealerUpValue: number,
  rules: Rules,
): number | null {
  let base = compositionFromDecks(rules.decks)
  for (const c of playerCards) base = removeFromComposition(base, bucket(c.rank))
  base = removeFromComposition(base, dealerUpValue)

  const rankedAt = (comp: Composition) =>
    evaluate(playerCards, dealerUpValue, comp, rules).ranked
  const evForAction = (ranked: { action: Action; ev: number }[], a: Action): number => {
    const hit = ranked.find((r) => r.action === a)
    return hit ? hit.ev : Number.NaN
  }

  const lowAction = bestPlay(rankedAt(depletedShoe(base, rules.decks, TC_LO)))
  const highAction = bestPlay(rankedAt(depletedShoe(base, rules.decks, TC_HI)))
  if (lowAction === highAction) return null

  return sweepCrossover(base, rules.decks, (comp) => {
    const ranked = rankedAt(comp)
    return evForAction(ranked, highAction) - evForAction(ranked, lowAction) >= 0
  })
}

/**
 * Derive the insurance index: the true count at/above which insurance turns +EV
 * under `rules`. Sweeps a dealer-Ace shoe upward until {@link evaluate}
 * recommends the bet. Returns `null` if insurance is disabled.
 */
export function deriveInsuranceIndex(rules: Rules): number | null {
  if (!rules.insurance) return null
  const playerCards = [mkCard(8, 'ins'), mkCard(7, 'ins')]
  let base = compositionFromDecks(rules.decks)
  for (const c of playerCards) base = removeFromComposition(base, bucket(c.rank))
  base = removeFromComposition(base, 1) // dealer Ace upcard

  return sweepCrossover(base, rules.decks, (comp) => {
    const d = evaluate(playerCards, 1, comp, rules)
    return d.insurance?.recommend === true
  })
}

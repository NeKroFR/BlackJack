import { compKey, totalCards } from './cards'
import type { Composition, DealerDist, Rules } from './types'

/**
 * Options for {@link dealerProbabilities}.
 */
export interface DealerOptions {
  /**
   * Infinite-deck fast path: draw probabilities come from fixed 1/13 rank
   * frequencies instead of the actual composition. Used for chart generation
   * where exact depletion does not matter. In this mode the returned
   * distribution is always UNCONDITIONAL (peek conditioning is skipped), so the
   * seven fields sum to exactly 1 and pBust reproduces the canonical
   * dealer-bust-by-upcard table.
   */
  infinite?: boolean
}

/**
 * Six mutually exclusive non-blackjack dealer outcomes, indexed for the
 * recursion. Blackjack (a two-card 21) is tracked separately.
 */
const OUT_17 = 0
const OUT_18 = 1
const OUT_19 = 2
const OUT_20 = 3
const OUT_21 = 4
const OUT_BUST = 5

type Dist6 = Float64Array // [p17, p18, p19, p20, p21, pBust]

/** Draw source: buckets present and their draw weights (summing to 1). */
interface DrawSource {
  buckets: number[]
  weight: (b: number) => number
  /** Composition after removing one card of bucket b (identity when infinite). */
  next: (b: number) => Composition
}

/**
 * Add card of bucket `b` (1 = Ace) to a running (total, soft) state.
 * Returns the new state, or a bust flag when it cannot be kept <= 21.
 */
function addCard(
  total: number,
  soft: boolean,
  b: number,
): { total: number; soft: boolean; bust: boolean } {
  let t = total + b // an Ace enters as 1 here
  let s = soft
  if (b === 1 && t + 10 <= 21) {
    t += 10
    s = true
  }
  if (t > 21 && s) {
    // Demote the soft ace back to 1 to avoid busting.
    t -= 10
    s = false
  }
  if (t > 21) return { total: t, soft: false, bust: true }
  return { total: t, soft: s, bust: false }
}

/**
 * Dealer outcome probabilities from a given upcard.
 *
 * Enumerated recursively: from the upcard draw the hole card, then keep drawing
 * until the dealer must stand. Draw probabilities use the ACTUAL remaining
 * composition (each drawn card removed as we recurse) so counting/depletion
 * effects emerge. Pass `{ infinite: true }` for the fixed 1/13 fast path. The
 * recursion is memoized on `(dealerTotal, soft, compKey)`.
 *
 * Standing rule: dealer hits to hard 17+. On soft 17 it hits iff
 * `rules.soft17 === 'H17'`, else stands.
 *
 * Blackjack handling: a two-card 21 (Ace + ten in the first two dealer cards)
 * is reported as `pBlackjack`, never folded into `p21` (which is reserved for
 * multi-card 21s). When `rules.dealerPeek` is true and the upcard is an Ace or
 * a ten, the dealer has already peeked, so the game only continues with no
 * natural: the six non-blackjack fields (`p17..pBust`) are therefore
 * CONDITIONED on "dealer does not have blackjack" (renormalised to sum to 1),
 * while `pBlackjack` still reports the unconditional probability of the natural
 * (needed for ENHC handling and insurance math). In every other case (no peek,
 * upcard not Ace/ten, or the infinite fast path) the distribution is
 * unconditional and all seven fields sum to 1.
 *
 * @param upcardValue dealer upcard bucket, 1..10 (1 = Ace, 10 = any ten).
 * @param comp remaining composition AFTER removing all known cards (the upcard
 *   included). Ignored when `opts.infinite` is set.
 * @param rules table rules (soft-17 action and peek behaviour are consulted).
 */
export function dealerProbabilities(
  upcardValue: number,
  comp: Composition,
  rules: Rules,
  opts: DealerOptions = {},
): DealerDist {
  const infinite = opts.infinite === true
  const hitsSoft17 = rules.soft17 === 'H17'
  const memo = new Map<string, Dist6>()

  function source(c: Composition): DrawSource {
    if (infinite) {
      return {
        buckets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        weight: (b) => (b === 10 ? 4 : 1) / 13,
        next: () => c,
      }
    }
    const n = totalCards(c)
    const buckets: number[] = []
    for (let b = 1; b <= 10; b++) if (c[b] > 0) buckets.push(b)
    return {
      buckets,
      weight: (b) => c[b] / n,
      next: (b) => {
        const nc = c.slice()
        nc[b] = nc[b] - 1
        return nc
      },
    }
  }

  /**
   * Final-outcome distribution for a dealer already holding (total, soft) with
   * remaining composition `c`. Never produces a "blackjack": naturals are
   * separated out at the top level before `play` is entered.
   */
  function play(total: number, soft: boolean, c: Composition): Dist6 {
    // Terminal: dealer must stand.
    const standsHard = total >= 18 || (total === 17 && !(soft && hitsSoft17))
    if (total >= 17 && standsHard) {
      const d = new Float64Array(6)
      d[total - 17] = 1
      return d
    }
    // Otherwise the dealer draws (includes soft 17 under H17).

    const key = `${total}|${soft ? 1 : 0}|${infinite ? 'inf' : compKey(c)}`
    const cached = memo.get(key)
    if (cached) return cached

    const d = new Float64Array(6)
    const src = source(c)
    for (const b of src.buckets) {
      const w = src.weight(b)
      if (w === 0) continue
      const nxt = addCard(total, soft, b)
      if (nxt.bust) {
        d[OUT_BUST] += w
        continue
      }
      const sub = play(nxt.total, nxt.soft, src.next(b))
      for (let i = 0; i < 6; i++) d[i] += w * sub[i]
    }
    memo.set(key, d)
    return d
  }

  // ---- Top level: draw the hole card, splitting off naturals. --------------
  // Upcard-only state: an Ace shows as soft 11, any other card as its hard value.
  const upTotal = upcardValue === 1 ? 11 : upcardValue
  const upSoft = upcardValue === 1

  const agg = new Float64Array(6)
  let pBlackjack = 0
  const src = source(comp)
  for (const b of src.buckets) {
    const w = src.weight(b)
    if (w === 0) continue
    const nxt = addCard(upTotal, upSoft, b)
    if (!nxt.bust && nxt.total === 21) {
      // Two-card 21 = natural blackjack (only reachable from an Ace or ten up).
      pBlackjack += w
      continue
    }
    if (nxt.bust) {
      agg[OUT_BUST] += w
      continue
    }
    const sub = play(nxt.total, nxt.soft, src.next(b))
    for (let i = 0; i < 6; i++) agg[i] += w * sub[i]
  }

  const conditionOnNoBlackjack =
    !infinite && rules.dealerPeek && (upcardValue === 1 || upcardValue === 10)

  if (conditionOnNoBlackjack) {
    const noBj = 1 - pBlackjack
    const s = noBj > 0 ? noBj : 1
    for (let i = 0; i < 6; i++) agg[i] /= s
  }

  return {
    p17: agg[OUT_17],
    p18: agg[OUT_18],
    p19: agg[OUT_19],
    p20: agg[OUT_20],
    p21: agg[OUT_21],
    pBust: agg[OUT_BUST],
    pBlackjack,
  }
}

/**
 * Convenience infinite-deck sibling used for chart generation and the
 * dealer-bust reference table. Equivalent to
 * `dealerProbabilities(up, [], rules, { infinite: true })`.
 */
export function dealerProbabilitiesInfinite(upcardValue: number, rules: Rules): DealerDist {
  return dealerProbabilities(upcardValue, [], rules, { infinite: true })
}

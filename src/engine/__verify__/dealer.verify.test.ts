/**
 * INDEPENDENT adversarial verification of `../dealer.ts`.
 *
 * This file does NOT trust the engine's own recursion. It re-derives the
 * dealer bust-by-upcard table from scratch with a self-contained infinite-deck
 * recursion written here, then asserts that:
 *   1. the engine's infinite-deck output matches the canonical published
 *      S17 bust-by-upcard table (±0.6%),
 *   2. the engine's output matches this file's independent reference (±0.3%),
 *   3. every seven-field distribution sums to exactly 1.
 *
 * Canonical S17 dealer-bust-by-upcard (Wizard-of-Odds / Blackjack-Apprenticeship):
 *   2→35.4  3→37.4  4→39.6  5→41.7  6→42.3  7→26.2  8→24.5  9→22.9  10→21.2  A→11.5
 */
import { describe, expect, it } from 'vitest'
import { dealerProbabilities } from '../dealer'
import { DEFAULT_RULES } from '../rules'
import type { DealerDist, Rules } from '../types'

const S17: Rules = { ...DEFAULT_RULES, soft17: 'S17' }

// ---------------------------------------------------------------------------
// Independent infinite-deck dealer recursion (S17). Written from the rules of
// blackjack, sharing no code with the engine under test. Ten-valued cards have
// weight 4/13; all others 1/13. Dealer stands on all 17 (S17), hits below.
// A two-card 21 off an A/ten upcard is a natural (counts toward pBlackjack, not
// bust); it is a made 21, never a bust.
// ---------------------------------------------------------------------------
type Dist = { p17: number; p18: number; p19: number; p20: number; p21: number; pBust: number }

const weight = (b: number): number => (b === 10 ? 4 : 1) / 13

function addCard(total: number, soft: boolean, b: number): { total: number; soft: boolean; bust: boolean } {
  let t = total + b
  let s = soft
  if (b === 1 && t + 10 <= 21) {
    t += 10
    s = true
  }
  if (t > 21 && s) {
    t -= 10
    s = false
  }
  if (t > 21) return { total: t, soft: false, bust: true }
  return { total: t, soft: s, bust: false }
}

const zero = (): Dist => ({ p17: 0, p18: 0, p19: 0, p20: 0, p21: 0, pBust: 0 })
const FIELDS = ['p17', 'p18', 'p19', 'p20', 'p21', 'pBust'] as const

function refPlay(total: number, soft: boolean, memo: Map<string, Dist>): Dist {
  // S17: stand on all 17 and above.
  if (total >= 17) {
    const d = zero()
    if (total === 17) d.p17 = 1
    else if (total === 18) d.p18 = 1
    else if (total === 19) d.p19 = 1
    else if (total === 20) d.p20 = 1
    else d.p21 = 1
    return d
  }
  const key = `${total}|${soft ? 1 : 0}`
  const cached = memo.get(key)
  if (cached) return cached
  const d = zero()
  for (let b = 1; b <= 10; b++) {
    const w = weight(b)
    const nx = addCard(total, soft, b)
    if (nx.bust) {
      d.pBust += w
      continue
    }
    const sub = refPlay(nx.total, nx.soft, memo)
    for (const f of FIELDS) d[f] += w * sub[f]
  }
  memo.set(key, d)
  return d
}

/** Independent unconditional infinite-deck dealer distribution for an upcard. */
function refUpcard(up: number): { dist: Dist; pBlackjack: number } {
  const memo = new Map<string, Dist>()
  const upTotal = up === 1 ? 11 : up
  const upSoft = up === 1
  const d = zero()
  let pBlackjack = 0
  for (let b = 1; b <= 10; b++) {
    const w = weight(b)
    const nx = addCard(upTotal, upSoft, b)
    if (!nx.bust && nx.total === 21) {
      pBlackjack += w
      continue
    }
    if (nx.bust) {
      d.pBust += w
      continue
    }
    const sub = refPlay(nx.total, nx.soft, memo)
    for (const f of FIELDS) d[f] += w * sub[f]
  }
  return { dist: d, pBlackjack }
}

function sumAll(d: DealerDist): number {
  return d.p17 + d.p18 + d.p19 + d.p20 + d.p21 + d.pBust + d.pBlackjack
}

const CANONICAL: Record<number, number> = {
  2: 0.354,
  3: 0.374,
  4: 0.396,
  5: 0.417,
  6: 0.423,
  7: 0.262,
  8: 0.245,
  9: 0.229,
  10: 0.212,
  1: 0.115, // Ace
}
const UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]
const label = (u: number) => (u === 1 ? 'A' : String(u))

describe('VERIFY dealer.ts — bust probability by upcard (infinite deck, S17)', () => {
  for (const up of UPCARDS) {
    const expected = CANONICAL[up]
    it(`upcard ${label(up)}: engine bust ≈ canonical ${(expected * 100).toFixed(1)}% (±0.6%)`, () => {
      // Engine under test, infinite fast-path (empty composition ignored in this mode).
      const d = dealerProbabilities(up, [], S17, { infinite: true })
      expect(Math.abs(d.pBust - expected)).toBeLessThanOrEqual(0.006)
    })

    it(`upcard ${label(up)}: engine matches this file's independent recursion (±0.3%)`, () => {
      const d = dealerProbabilities(up, [], S17, { infinite: true })
      const ref = refUpcard(up)
      expect(Math.abs(d.pBust - ref.dist.pBust)).toBeLessThanOrEqual(0.003)
      expect(Math.abs(d.pBlackjack - ref.pBlackjack)).toBeLessThanOrEqual(0.003)
    })
  }
})

describe('VERIFY dealer.ts — distributions sum to 1 (infinite deck, S17)', () => {
  for (const up of UPCARDS) {
    it(`upcard ${label(up)}: all seven fields sum to 1`, () => {
      const d = dealerProbabilities(up, [], S17, { infinite: true })
      expect(sumAll(d)).toBeCloseTo(1, 9)
    })
  }
})

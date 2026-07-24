import { describe, expect, it } from 'vitest'
import { compositionFromDecks } from './cards'
import { dealerProbabilities, dealerProbabilitiesInfinite } from './dealer'
import { DEFAULT_RULES } from './rules'
import type { DealerDist, Rules } from './types'

const S17: Rules = { ...DEFAULT_RULES, soft17: 'S17' }
const H17: Rules = { ...DEFAULT_RULES, soft17: 'H17' }

function sumAll(d: DealerDist): number {
  return d.p17 + d.p18 + d.p19 + d.p20 + d.p21 + d.pBust + d.pBlackjack
}

function sumNonBlackjack(d: DealerDist): number {
  return d.p17 + d.p18 + d.p19 + d.p20 + d.p21 + d.pBust
}

describe('dealerProbabilities — infinite deck bust targets (S17)', () => {
  // Canonical dealer-bust-by-upcard (infinite deck, dealer stands soft 17).
  const targets: Record<number, number> = {
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

  for (const [upStr, expected] of Object.entries(targets)) {
    const up = Number(upStr)
    it(`upcard ${up === 1 ? 'A' : up} busts ~${(expected * 100).toFixed(1)}%`, () => {
      const d = dealerProbabilitiesInfinite(up, S17)
      expect(d.pBust).toBeGreaterThan(expected - 0.006)
      expect(d.pBust).toBeLessThan(expected + 0.006)
    })
  }
})

describe('dealerProbabilities — distributions sum to ~1', () => {
  it('infinite-deck dists (all seven fields) sum to 1 for every upcard', () => {
    for (let up = 1; up <= 10; up++) {
      const d = dealerProbabilitiesInfinite(up, S17)
      expect(sumAll(d)).toBeCloseTo(1, 8)
    }
  })

  it('infinite H17 dists sum to 1 as well', () => {
    for (let up = 1; up <= 10; up++) {
      const d = dealerProbabilitiesInfinite(up, H17)
      expect(sumAll(d)).toBeCloseTo(1, 8)
    }
  })

  it('finite full-shoe dists sum to 1 (no peek, upcard not A/ten)', () => {
    const comp = compositionFromDecks(6)
    const noPeek: Rules = { ...S17, dealerPeek: false }
    for (let up = 2; up <= 9; up++) {
      const d = dealerProbabilities(up, comp, noPeek)
      expect(sumAll(d)).toBeCloseTo(1, 8)
    }
  })

  it('finite full-shoe dists sum to 1 for A/ten upcards when no peek (ENHC)', () => {
    const comp = compositionFromDecks(6)
    const enhc: Rules = { ...S17, dealerPeek: false }
    for (const up of [1, 10]) {
      const d = dealerProbabilities(up, comp, enhc)
      expect(sumAll(d)).toBeCloseTo(1, 8)
    }
  })
})

describe('dealerProbabilities — blackjack + peek conditioning', () => {
  it('reports pBlackjack ~ P(ten in hole) for an Ace upcard, full shoe', () => {
    const comp = compositionFromDecks(6)
    // 96 tens out of 311 remaining cards after the Ace upcard is removed.
    const c = comp.slice()
    c[1] -= 1
    const d = dealerProbabilities(1, c, { ...S17, dealerPeek: false })
    expect(d.pBlackjack).toBeCloseTo(96 / 311, 6)
  })

  it('reports pBlackjack ~ P(ace in hole) for a ten upcard, full shoe', () => {
    const comp = compositionFromDecks(6)
    const c = comp.slice()
    c[10] -= 1
    const d = dealerProbabilities(10, c, { ...S17, dealerPeek: false })
    expect(d.pBlackjack).toBeCloseTo(24 / 311, 6)
  })

  it('non-A/ten upcards never make blackjack', () => {
    const comp = compositionFromDecks(6)
    for (let up = 2; up <= 9; up++) {
      const c = comp.slice()
      c[up] -= 1
      const d = dealerProbabilities(up, c, S17)
      expect(d.pBlackjack).toBe(0)
    }
  })

  it('peek + Ace/ten: non-blackjack fields are conditioned (sum to 1) and pBlackjack still reported', () => {
    const comp = compositionFromDecks(6)
    for (const up of [1, 10]) {
      const c = comp.slice()
      c[up] -= 1
      const d = dealerProbabilities(up, c, { ...S17, dealerPeek: true })
      expect(d.pBlackjack).toBeGreaterThan(0)
      expect(sumNonBlackjack(d)).toBeCloseTo(1, 8)
    }
  })

  it('peek conditioning raises the reported bust rate vs unconditional', () => {
    const comp = compositionFromDecks(6)
    const c = comp.slice()
    c[1] -= 1
    const peeked = dealerProbabilities(1, c, { ...S17, dealerPeek: true })
    const raw = dealerProbabilities(1, c, { ...S17, dealerPeek: false })
    expect(peeked.pBust).toBeGreaterThan(raw.pBust)
  })
})

describe('dealerProbabilities — H17 vs S17 sanity', () => {
  it('H17 on a 6 upcard busts more often than S17', () => {
    const s = dealerProbabilitiesInfinite(6, S17)
    const h = dealerProbabilitiesInfinite(6, H17)
    expect(h.pBust).toBeGreaterThan(s.pBust)
  })

  it('composition depletion changes the distribution (counting effect)', () => {
    const base = compositionFromDecks(6)
    base[6] -= 1 // upcard 6 removed
    const rich = base.slice()
    // Remove several tens: a ten-poor shoe should bust the 6 less often.
    rich[10] -= 20
    const full = dealerProbabilities(6, base, { ...S17, dealerPeek: false })
    const tenPoor = dealerProbabilities(6, rich, { ...S17, dealerPeek: false })
    expect(tenPoor.pBust).not.toBeCloseTo(full.pBust, 4)
    expect(tenPoor.pBust).toBeLessThan(full.pBust)
  })
})

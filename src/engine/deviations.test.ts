import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from './rules'
import type { Card, Rank } from './types'
import {
  deriveIndex,
  deriveInsuranceIndex,
  FAB_4,
  ILLUSTRIOUS_18,
  indexFor,
  INSURANCE_INDEX,
} from './deviations'

function card(value: number): Card {
  const rank: Rank = value === 1 ? 'A' : value === 10 ? 'T' : (String(value) as Rank)
  return { rank, suit: 'S', id: `t-${value}-${Math.random()}` }
}

const hand = (...values: number[]): Card[] => values.map(card)

describe('canonical tables', () => {
  it('has the full Illustrious 18 (insurance included)', () => {
    expect(ILLUSTRIOUS_18).toHaveLength(18)
    // every entry carries an integer index and a defined action
    for (const e of ILLUSTRIOUS_18) {
      expect(Number.isInteger(e.index)).toBe(true)
      expect(e.action).toBeTruthy()
      expect(e.dealerUpValue).toBeGreaterThanOrEqual(1)
      expect(e.dealerUpValue).toBeLessThanOrEqual(10)
    }
  })

  it('has the Fab 4 late-surrender deviations', () => {
    expect(FAB_4).toHaveLength(4)
    for (const e of FAB_4) expect(e.action).toBe('surrender')
  })

  it('insurance index is +3', () => {
    expect(INSURANCE_INDEX).toBe(3)
    expect(indexFor('insurance', 1)).toBe(3)
  })

  it('looks up canonical indices by hand + upcard', () => {
    expect(indexFor('16', 10)).toBe(0)
    expect(indexFor('15', 10)).toBe(4)
    expect(indexFor('12', 3)).toBe(2)
    expect(indexFor('10', 10)).toBe(4)
    expect(indexFor('13', 2)).toBe(-1)
    expect(indexFor('16', 9)).toBe(5)
  })

  it('returns null for a non-deviation pairing', () => {
    expect(indexFor('20', 6)).toBeNull()
    expect(indexFor('17', 7)).toBeNull()
  })
})

describe('deriveIndex lands within ±1 TC of canonical', () => {
  const within1 = (got: number | null, want: number) => {
    expect(got).not.toBeNull()
    expect(Math.abs((got as number) - want)).toBeLessThanOrEqual(1)
  }

  // deriveIndex is composition-aware, so the hand's exact cards matter: a stiff
  // built from tens (10,6) depletes the shoe of tens and shifts the crossover
  // vs. the canonical total-dependent value. Representative non-ten stiffs are
  // used here so the derived numbers line up with the published (composition-
  // averaged) Illustrious 18.

  it('16 v 10 ≈ 0 (stand)', () => {
    within1(deriveIndex(hand(9, 7), 10, DEFAULT_RULES), 0)
  })

  it('15 v 10 ≈ +4 (stand)', () => {
    within1(deriveIndex(hand(9, 6), 10, DEFAULT_RULES), 4)
  })

  it('12 v 3 ≈ +2 (stand)', () => {
    within1(deriveIndex(hand(8, 4), 3, DEFAULT_RULES), 2)
  })

  it('10 v 10 ≈ +4 (double)', () => {
    within1(deriveIndex(hand(4, 6), 10, DEFAULT_RULES), 4)
  })

  it('13 v 2 ≈ -1 (stand)', () => {
    within1(deriveIndex(hand(9, 4), 2, DEFAULT_RULES), -1)
  })

  it('insurance ≈ +3', () => {
    within1(deriveInsuranceIndex(DEFAULT_RULES), 3)
  })
})

describe('deriveIndex edge behaviour', () => {
  it('returns null when there is no deviation (hard 19 v 6)', () => {
    expect(deriveIndex(hand(10, 9), 6, DEFAULT_RULES)).toBeNull()
  })

  it('returns null for insurance when the rule is off', () => {
    expect(deriveInsuranceIndex({ ...DEFAULT_RULES, insurance: false })).toBeNull()
  })
})

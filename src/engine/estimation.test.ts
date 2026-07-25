import { describe, expect, it } from 'vitest'
import { mulberry32 } from './cards'
import {
  decksRemainingFromDiscard,
  estimateTrueCount,
  isDrillAnswerCorrect,
  makeDiscardDrill,
  penetrationCards,
  roundDecks,
} from './estimation'

describe('decksRemainingFromDiscard', () => {
  it('subtracts discard from total', () => {
    expect(decksRemainingFromDiscard(2, 6)).toBe(4)
    expect(decksRemainingFromDiscard(0, 6)).toBe(6)
    expect(decksRemainingFromDiscard(6, 6)).toBe(0)
  })

  it('clamps into [0, totalDecks]', () => {
    expect(decksRemainingFromDiscard(8, 6)).toBe(0)
    expect(decksRemainingFromDiscard(-1, 6)).toBe(6)
  })
})

describe('estimateTrueCount', () => {
  it('divides running count by decks remaining', () => {
    // 6-deck shoe, 2 decks in tray -> 4 remaining; +8 running -> +2 TC
    expect(estimateTrueCount(8, 2, 6)).toBeCloseTo(2, 10)
  })

  it('floors the divisor at 0.5 near shoe end', () => {
    // 5.75 decks discarded of 6 -> 0.25 remaining, clamped divisor to 0.5
    expect(estimateTrueCount(5, 5.75, 6)).toBeCloseTo(10, 10)
  })

  it('handles negative running counts', () => {
    expect(estimateTrueCount(-6, 3, 6)).toBeCloseTo(-2, 10)
  })
})

describe('roundDecks', () => {
  it('snaps to quarter', () => {
    expect(roundDecks(1.1, 'quarter')).toBe(1)
    expect(roundDecks(1.13, 'quarter')).toBe(1.25)
    expect(roundDecks(1.4, 'quarter')).toBe(1.5)
  })

  it('snaps to half', () => {
    expect(roundDecks(1.2, 'half')).toBe(1)
    expect(roundDecks(1.3, 'half')).toBe(1.5)
  })

  it('snaps to full', () => {
    expect(roundDecks(1.4, 'full')).toBe(1)
    expect(roundDecks(1.6, 'full')).toBe(2)
  })
})

describe('penetrationCards', () => {
  it('converts penetration fraction to whole cards', () => {
    // 6 decks * 0.75 = 4.5 decks = 234 cards
    expect(penetrationCards(6, 0.75)).toBe(234)
    expect(penetrationCards(1, 1)).toBe(52)
    expect(penetrationCards(2, 0.5)).toBe(52)
  })

  it('clamps penetration to [0, 1]', () => {
    expect(penetrationCards(6, -0.5)).toBe(0)
    expect(penetrationCards(6, 2)).toBe(6 * 52)
  })
})

describe('makeDiscardDrill', () => {
  it('is deterministic for a fixed seed', () => {
    const a = makeDiscardDrill(6, mulberry32(42))
    const b = makeDiscardDrill(6, mulberry32(42))
    expect(a).toEqual(b)
  })

  it('produces self-consistent truth within the shoe', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 200; i++) {
      const d = makeDiscardDrill(6, rng)
      expect(d.totalDecks).toBe(6)
      expect(d.discardDecks).toBeGreaterThanOrEqual(0)
      expect(d.discardDecks).toBeLessThanOrEqual(6)
      expect(d.decksRemaining).toBeCloseTo(6 - d.discardDecks, 10)
      // Tray reading is snapped to a quarter deck by default.
      expect(Math.round(d.discardDecks * 4)).toBeCloseTo(d.discardDecks * 4, 10)
      expect(d.tolerance).toBeGreaterThan(0)
    }
  })

  it('honors a custom tolerance and rounding', () => {
    const d = makeDiscardDrill(8, mulberry32(1), { tolerance: 0.25, rounding: 'half' })
    expect(d.tolerance).toBe(0.25)
    expect(Math.round(d.discardDecks * 2)).toBeCloseTo(d.discardDecks * 2, 10)
  })

  it('grades answers against the tolerance band', () => {
    const drill = { totalDecks: 6, discardDecks: 2, decksRemaining: 4, tolerance: 0.5 }
    expect(isDrillAnswerCorrect(drill, 4)).toBe(true)
    expect(isDrillAnswerCorrect(drill, 4.5)).toBe(true)
    expect(isDrillAnswerCorrect(drill, 3.5)).toBe(true)
    expect(isDrillAnswerCorrect(drill, 4.75)).toBe(false)
    expect(isDrillAnswerCorrect(drill, 3.25)).toBe(false)
  })
})

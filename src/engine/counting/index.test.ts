import { describe, expect, it } from 'vitest'
import { buildShoe } from '../cards'
import { HILO, KO, OMEGA_II, WONG_HALVES, ZEN } from './systems'
import {
  decksRemaining,
  runningCount,
  runningCountWithStart,
  trueCount,
} from './index'

const BALANCED = [HILO, WONG_HALVES, OMEGA_II, ZEN]

describe('runningCount', () => {
  it('sums to 0 for a full single deck under every balanced system', () => {
    const deck = buildShoe(1)
    for (const sys of BALANCED) {
      expect(runningCount(deck, sys)).toBeCloseTo(0, 10)
    }
  })

  it('sums to +4 over a full single deck under KO (its own tags)', () => {
    expect(runningCount(buildShoe(1), KO)).toBe(4)
  })

  it('does not fold in the IRC by itself', () => {
    expect(runningCount([], KO)).toBe(0)
  })
})

describe('runningCountWithStart', () => {
  it('KO runningCountStart(6) === -20', () => {
    expect(KO.runningCountStart(6)).toBe(-20)
  })

  it('folds the IRC into the tag sum', () => {
    // empty shoe of 6 decks under KO -> just the IRC
    expect(runningCountWithStart([], KO, 6)).toBe(-20)
    // balanced systems have IRC 0
    expect(runningCountWithStart([], HILO, 6)).toBe(0)
  })
})

describe('decksRemaining', () => {
  it('computes raw decks remaining', () => {
    expect(decksRemaining(0, 6)).toBe(6)
    expect(decksRemaining(52, 6)).toBe(5)
    expect(decksRemaining(78, 6)).toBe(4.5)
  })

  it('rounds to quarter/half/full deck', () => {
    // 3 decks -> 156 cards; seen 20 -> raw = (156-20)/52 = 2.615...
    expect(decksRemaining(20, 3, 'quarter')).toBe(2.5)
    expect(decksRemaining(20, 3, 'half')).toBe(2.5)
    expect(decksRemaining(20, 3, 'full')).toBe(3)
  })
})

describe('trueCount', () => {
  it('Hi-Lo +6 with 3 decks left === +2', () => {
    expect(trueCount(6, 3)).toBe(2)
  })

  it('clamps the divisor to 0.5', () => {
    expect(trueCount(3, 0)).toBe(6)
    expect(trueCount(3, 0.25)).toBe(6)
  })
})

import { describe, expect, it } from 'vitest'
import { buildShoe } from '../cards'
import { DEFAULT_RULES } from '../rules'
import { HILO, KO, OMEGA_II, WONG_HALVES, ZEN } from '../counting/systems'
import { runningCount, trueCount } from '../counting/index'
import { deriveIndex, deriveInsuranceIndex } from '../deviations'
import type { Card, Rank, Suit } from '../types'

// Adversarial verification of SPEC §5 (counting) and §6 (deviations).
// This file does NOT modify any source module; it only observes behaviour.

const BALANCED = [
  { sys: HILO, name: 'Hi-Lo' },
  { sys: WONG_HALVES, name: 'Wong Halves' },
  { sys: OMEGA_II, name: 'Omega II' },
  { sys: ZEN, name: 'Zen' },
]

let card = 0
function mk(rank: Rank, suit: Suit = 'S'): Card {
  return { rank, suit, id: `v-${rank}-${card++}` }
}

describe('§5 counting — balanced systems zero out over a full deck', () => {
  it('every balanced system sums to running count 0 over a full single deck', () => {
    const deck = buildShoe(1)
    for (const { sys, name } of BALANCED) {
      const rc = runningCount(deck, sys)
      // eslint-disable-next-line no-console
      console.log(`[balanced] ${name} full-deck running count = ${rc}`)
      expect(rc).toBeCloseTo(0, 10)
    }
  })
})

describe('§5 counting — KO IRC math', () => {
  it('KO runningCountStart(6) === -20', () => {
    const irc = KO.runningCountStart(6)
    // eslint-disable-next-line no-console
    console.log(`[KO] runningCountStart(6) = ${irc}`)
    expect(irc).toBe(-20)
  })
})

describe('§5 counting — Hi-Lo true count', () => {
  it('trueCount(+6, 3) === +2', () => {
    const tc = trueCount(6, 3)
    // eslint-disable-next-line no-console
    console.log(`[Hi-Lo] trueCount(+6, 3 decks) = ${tc}`)
    expect(tc).toBe(2)
  })
})

describe('§6 deviations — derived indices within ±1 TC of canonical', () => {
  const cases: {
    label: string
    player: Card[]
    up: number
    canonical: number
  }[] = [
    { label: '16 v 10', player: [mk('T'), mk('6')], up: 10, canonical: 0 },
    { label: '15 v 10', player: [mk('T'), mk('5')], up: 10, canonical: 4 },
    { label: '12 v 3', player: [mk('T'), mk('2')], up: 3, canonical: 2 },
    { label: '10 v 10', player: [mk('6'), mk('4')], up: 10, canonical: 4 },
  ]

  for (const c of cases) {
    it(`${c.label} ≈ ${c.canonical >= 0 ? '+' : ''}${c.canonical}`, () => {
      const derived = deriveIndex(c.player, c.up, DEFAULT_RULES)
      // eslint-disable-next-line no-console
      console.log(
        `[deviation] ${c.label}: derived=${derived === null ? 'null' : derived.toFixed(2)} canonical=${c.canonical} diff=${derived === null ? 'n/a' : Math.abs(derived - c.canonical).toFixed(2)}`,
      )
      expect(derived).not.toBeNull()
      expect(Math.abs((derived as number) - c.canonical)).toBeLessThanOrEqual(1)
    })
  }

  it('insurance ≈ +3', () => {
    const derived = deriveInsuranceIndex(DEFAULT_RULES)
    // eslint-disable-next-line no-console
    console.log(
      `[deviation] insurance: derived=${derived === null ? 'null' : derived.toFixed(2)} canonical=3 diff=${derived === null ? 'n/a' : Math.abs(derived - 3).toFixed(2)}`,
    )
    expect(derived).not.toBeNull()
    expect(Math.abs((derived as number) - 3)).toBeLessThanOrEqual(1)
  })
})

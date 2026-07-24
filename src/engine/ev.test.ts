import { describe, expect, it } from 'vitest'
import { compositionFromDecks, removeFromComposition } from './cards'
import { basicStrategyChart, evaluate } from './ev'
import { DEFAULT_RULES } from './rules'
import type { Action, Card, Composition, Rank, Rules } from './types'

// ---- Test helpers ----------------------------------------------------------

function card(value: number): Card {
  const rank: Rank = value === 1 ? 'A' : value === 10 ? 'T' : (String(value) as Rank)
  return { rank, suit: 'S', id: `t-${value}-${Math.random()}` }
}

/** Full shoe for the rules minus the player's cards and the dealer upcard. */
function shoeMinus(rules: Rules, playerValues: number[], up: number): Composition {
  let comp = compositionFromDecks(rules.decks)
  for (const v of playerValues) comp = removeFromComposition(comp, v)
  return removeFromComposition(comp, up)
}

function decide(playerValues: number[], up: number, rules: Rules = DEFAULT_RULES) {
  return evaluate(playerValues.map(card), up, shoeMinus(rules, playerValues, up), rules)
}

function best(playerValues: number[], up: number, rules: Rules = DEFAULT_RULES): Action {
  return decide(playerValues, up, rules).best
}

const S17 = DEFAULT_RULES
const H17: Rules = { ...DEFAULT_RULES, soft17: 'H17' }
const NO_SURRENDER: Rules = { ...DEFAULT_RULES, surrender: 'none' }

// Dealer upcards in chart order, Ace (bucket 1) last.
const UPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]

// ---- Structural sanity -----------------------------------------------------

describe('evaluate — output shape', () => {
  it('ranked is sorted descending and best is ranked[0]', () => {
    const d = decide([10, 6], 10)
    for (let i = 1; i < d.ranked.length; i++) {
      expect(d.ranked[i - 1].ev).toBeGreaterThanOrEqual(d.ranked[i].ev)
    }
    expect(d.best).toBe(d.ranked[0].action)
  })

  it('always offers at least stand and hit', () => {
    const actions = decide([10, 6], 7).ranked.map((r) => r.action)
    expect(actions).toContain('stand')
    expect(actions).toContain('hit')
  })

  it('explanation names the best action and cites the dealer', () => {
    const d = decide([10, 10], 6)
    expect(d.explanation).toContain('Stand')
    expect(d.explanation.toLowerCase()).toContain('dealer')
    expect(d.explanation).toContain('%')
  })

  it('every action EV sits inside the [-2, 2] band', () => {
    for (const up of UPS) {
      for (const r of decide([8, 8], up).ranked) {
        expect(r.ev).toBeGreaterThanOrEqual(-2.0001)
        expect(r.ev).toBeLessThanOrEqual(2.0001)
      }
    }
  })

  it('double and surrender are absent on a three-card hand', () => {
    const actions = decide([5, 4, 2], 6).ranked.map((r) => r.action)
    expect(actions).not.toContain('double')
    expect(actions).not.toContain('surrender')
  })
})

// ---- Required strategy cells (SPEC §4.2 examples) --------------------------

describe('evaluate — canonical basic-strategy decisions (6-deck S17 DAS)', () => {
  it('11 doubles against 2-10 and hits against an Ace (S17)', () => {
    for (const up of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      expect(best([5, 6], up)).toBe('double')
    }
    // The classic S17 exception: 11 vs A is a hit, not a double.
    expect(best([5, 6], 1)).toBe('hit')
  })

  it('11 vs A doubles under H17 (rule sensitivity)', () => {
    expect(best([5, 6], 1, H17)).toBe('double')
  })

  it('hard 20 stands against every upcard', () => {
    for (const up of UPS) expect(best([10, 5, 5], up)).toBe('stand')
  })

  it('soft 18 (A,7) hits against 9, 10 and Ace', () => {
    for (const up of [9, 10, 1]) expect(best([1, 7], up)).toBe('hit')
  })

  it('soft 18 (A,7) doubles against 3-6 and stands against 2/7/8', () => {
    for (const up of [3, 4, 5, 6]) expect(best([1, 7], up)).toBe('double')
    for (const up of [2, 7, 8]) expect(best([1, 7], up)).toBe('stand')
  })

  it('8,8 splits against every upcard', () => {
    for (const up of UPS) expect(best([8, 8], up)).toBe('split')
  })

  it('T,T stands against every upcard', () => {
    for (const up of UPS) expect(best([10, 10], up)).toBe('stand')
  })

  it('A,A splits against every upcard', () => {
    for (const up of UPS) expect(best([1, 1], up)).toBe('split')
  })

  it('12 stands against 4/5/6 and hits against 2/3', () => {
    for (const up of [4, 5, 6]) expect(best([10, 2], up)).toBe('stand')
    for (const up of [2, 3]) expect(best([10, 2], up)).toBe('hit')
  })

  it('16 vs 10: surrenders with late surrender available', () => {
    expect(best([10, 6], 10, S17)).toBe('surrender')
  })

  it('16 vs 10 without surrender is a stand/hit near-tie (no double or split)', () => {
    const d = decide([10, 6], 10, NO_SURRENDER)
    expect(['stand', 'hit']).toContain(d.best)
    const stand = d.ranked.find((r) => r.action === 'stand')!.ev
    const hit = d.ranked.find((r) => r.action === 'hit')!.ev
    // The two are within a hair of each other — the reason the taught play
    // (stand) and the EV-optimal play flip-flop across sources.
    expect(Math.abs(stand - hit)).toBeLessThan(0.02)
  })

  it('9 doubles against 3-6 but hits against 2 and 7', () => {
    for (const up of [3, 4, 5, 6]) expect(best([4, 5], up)).toBe('double')
    for (const up of [2, 7]) expect(best([4, 5], up)).toBe('hit')
  })

  it('hard 17 always stands', () => {
    for (const up of UPS) expect(best([10, 7], up)).toBe('stand')
  })
})

// ---- Insurance -------------------------------------------------------------

describe('evaluate — insurance', () => {
  it('declines insurance at full-shoe ten density (below one third)', () => {
    const d = decide([9, 7], 1)
    expect(d.insurance).toBeDefined()
    expect(d.insurance!.recommend).toBe(false)
    expect(d.insurance!.takeEv).toBeLessThan(0)
  })

  it('recommends insurance when the remaining shoe is rich in tens', () => {
    const comp: Composition = new Array(11).fill(0)
    comp[10] = 40 // > 1/3 of the shoe is tens
    comp[5] = 10
    const d = evaluate([card(9), card(7)], 1, comp, DEFAULT_RULES)
    expect(d.insurance!.recommend).toBe(true)
    expect(d.insurance!.takeEv).toBeGreaterThan(0)
  })

  it('breaks even exactly at one-third ten density', () => {
    const comp: Composition = new Array(11).fill(0)
    comp[10] = 10
    comp[5] = 20 // ten density = 10/30 = 1/3 -> takeEv 0
    const d = evaluate([card(9), card(7)], 1, comp, DEFAULT_RULES)
    expect(d.insurance!.takeEv).toBeCloseTo(0, 10)
    expect(d.insurance!.recommend).toBe(false)
  })

  it('never offers insurance when the dealer does not show an Ace', () => {
    expect(decide([9, 7], 10).insurance).toBeUndefined()
  })
})

// ---- Natural blackjack -----------------------------------------------------

describe('evaluate — natural blackjack', () => {
  it('a natural stands and is worth the 3:2 payout when the dealer cannot match', () => {
    const d = decide([1, 10], 6)
    expect(d.best).toBe('stand')
    expect(d.ranked[0].ev).toBeCloseTo(1.5, 5)
  })

  it('a natural vs an Ace is discounted by the dealer-natural push', () => {
    const d = decide([1, 10], 1)
    expect(d.best).toBe('stand')
    expect(d.ranked[0].ev).toBeGreaterThan(1.0)
    expect(d.ranked[0].ev).toBeLessThan(1.5)
  })
})

// ---- Double EV magnitude ---------------------------------------------------

describe('evaluate — double EV', () => {
  it('doubling 11 vs 6 is strongly positive and stays within [-2, 2]', () => {
    const dbl = decide([5, 6], 6).ranked.find((r) => r.action === 'double')!
    expect(dbl.ev).toBeGreaterThan(0.5)
    expect(dbl.ev).toBeLessThanOrEqual(2)
  })

  it('a losing double (9 vs 7) roughly halves to a plain hit twice over', () => {
    const d = decide([4, 5], 7)
    const hit = d.ranked.find((r) => r.action === 'hit')!.ev
    const dbl = d.ranked.find((r) => r.action === 'double')!.ev
    // Doubling can only draw one card, so vs a strong upcard it trails hitting.
    expect(dbl).toBeLessThan(hit)
  })
})

// ---- Full chart parity vs the canonical Wizard-of-Odds chart ---------------

describe('basicStrategyChart — cell-for-cell parity (6-deck S17 DAS, late surrender)', () => {
  // Columns are dealer 2,3,4,5,6,7,8,9,10,A. Codes: H hit, S stand, D double,
  // P split, R surrender. Source: canonical Wizard-of-Odds basic strategy.
  const CODE: Record<string, Action> = {
    H: 'hit',
    S: 'stand',
    D: 'double',
    P: 'split',
    R: 'surrender',
  }
  const HARD: Record<number, string> = {
    5: 'H H H H H H H H H H',
    6: 'H H H H H H H H H H',
    7: 'H H H H H H H H H H',
    8: 'H H H H H H H H H H',
    9: 'H D D D D H H H H H',
    10: 'D D D D D D D D H H',
    11: 'D D D D D D D D D H',
    12: 'H H S S S H H H H H',
    13: 'S S S S S H H H H H',
    14: 'S S S S S H H H H H',
    15: 'S S S S S H H H R H',
    16: 'S S S S S H H R R R',
    17: 'S S S S S S S S S S',
    18: 'S S S S S S S S S S',
    19: 'S S S S S S S S S S',
    20: 'S S S S S S S S S S',
    21: 'S S S S S S S S S S',
  }
  const SOFT: Record<number, string> = {
    13: 'H H H D D H H H H H',
    14: 'H H H D D H H H H H',
    15: 'H H D D D H H H H H',
    16: 'H H D D D H H H H H',
    17: 'H D D D D H H H H H',
    18: 'S D D D D S S H H H',
    19: 'S S S S S S S S S S',
    20: 'S S S S S S S S S S',
    21: 'S S S S S S S S S S',
  }
  const PAIRS: Record<number, string> = {
    1: 'P P P P P P P P P P',
    2: 'P P P P P P H H H H',
    3: 'P P P P P P H H H H',
    4: 'H H H P P H H H H H',
    5: 'D D D D D D D D H H',
    6: 'P P P P P H H H H H',
    7: 'P P P P P P H H H H',
    8: 'P P P P P P P P P P',
    9: 'P P P P P S P P S S',
    10: 'S S S S S S S S S S',
  }

  const expand = (s: string): Action[] => s.trim().split(/\s+/).map((c) => CODE[c])
  const chart = basicStrategyChart(DEFAULT_RULES)

  const parity = (label: string, grid: Record<number, Record<number, Action>>, spec: Record<number, string>) => {
    it(`${label} rows match the canonical chart`, () => {
      const mismatches: string[] = []
      for (const key of Object.keys(spec).map(Number)) {
        const want = expand(spec[key])
        UPS.forEach((up, i) => {
          if (grid[key][up] !== want[i]) {
            mismatches.push(`${label}[${key}] vs ${up === 1 ? 'A' : up}: got ${grid[key][up]}, want ${want[i]}`)
          }
        })
      }
      expect(mismatches).toEqual([])
    })
  }

  parity('hard', chart.hard, HARD)
  parity('soft', chart.soft, SOFT)
  parity('pairs', chart.pairs, PAIRS)
})

// ---- Rule sensitivity ------------------------------------------------------

describe('basicStrategyChart — reacts to rule changes', () => {
  it('H17 makes A,8 (soft 19) double against a dealer 6', () => {
    expect(basicStrategyChart(S17).soft[19][6]).toBe('stand')
    expect(basicStrategyChart(H17).soft[19][6]).toBe('double')
  })

  it('removing surrender turns 15 vs 10 into a hit', () => {
    expect(basicStrategyChart(S17).hard[15][10]).toBe('surrender')
    // Without surrender the razor-thin stiff falls to a draw.
    expect(basicStrategyChart(NO_SURRENDER).hard[15][10]).toBe('hit')
  })
})

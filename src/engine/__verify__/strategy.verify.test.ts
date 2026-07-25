/**
 * ADVERSARIAL VERIFICATION — basic strategy & house edge (SPEC §4.2, §11).
 *
 * This file is intentionally INDEPENDENT of `ev.test.ts`. The canonical
 * Wizard-of-Odds basic-strategy chart below is re-encoded from published
 * authoritative knowledge (6-deck, dealer stands on soft 17, double any two,
 * double after split, late surrender, 3:2) rather than copied from any source
 * file. `basicStrategyChart(DEFAULT_RULES)` is generated purely through the
 * engine's own `evaluate()` solver and compared to that chart CELL-BY-CELL.
 *
 * It also estimates the overall house edge by exactly enumerating every
 * off-the-top three-card opening (player's two cards + dealer upcard), weighting
 * each by its fresh-shoe probability, taking the engine's best-action EV, and
 * folding in the peeked dealer-blackjack loss that `evaluate()` factors out of
 * its conditional EVs. The result must land on the published ~0.33% (LS included).
 *
 * Does NOT modify ev.ts.
 */
import { describe, expect, it } from 'vitest'
import {
  compositionFromDecks,
  isBlackjack,
  removeFromComposition,
  totalCards,
} from '../cards'
import { basicStrategyChart, evaluate } from '../ev'
import { DEFAULT_RULES } from '../rules'
import type { Action, Card, Rank } from '../types'

// Dealer upcards in canonical chart column order: 2..10 then Ace (bucket 1).
const UPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]

const CODE: Record<string, Action> = {
  H: 'hit',
  S: 'stand',
  D: 'double',
  P: 'split',
  R: 'surrender',
}

const upLabel = (u: number): string => (u === 1 ? 'A' : String(u))

function mkCard(value: number): Card {
  const rank: Rank = value === 1 ? 'A' : value === 10 ? 'T' : (String(value) as Rank)
  return { rank, suit: 'S', id: `verify-${value}` }
}

// ---------------------------------------------------------------------------
// Canonical Wizard-of-Odds basic strategy — 6-deck, S17, DAS, late surrender.
// Columns are dealer 2  3  4  5  6  7  8  9  10  A.
// H = hit, S = stand, D = double (else hit), P = split, R = surrender (else hit).
// ---------------------------------------------------------------------------

// Hard totals 5..21 (no usable ace). Stiffs 15/16 carry the S17 late-surrender
// exceptions: 15 surrenders only vs 10; 16 surrenders vs 9, 10 and A.
const HARD: Record<number, string> = {
  5:  'H H H H H H H H H H',
  6:  'H H H H H H H H H H',
  7:  'H H H H H H H H H H',
  8:  'H H H H H H H H H H',
  9:  'H D D D D H H H H H',
  10: 'D D D D D D D D H H',
  11: 'D D D D D D D D D H', // S17: 11 vs A is a HIT (H17 would double)
  12: 'H H S S S H H H H H',
  13: 'S S S S S H H H H H',
  14: 'S S S S S H H H H H',
  15: 'S S S S S H H H R H', // surrender vs 10 only
  16: 'S S S S S H H R R R', // surrender vs 9, 10, A
  17: 'S S S S S S S S S S',
  18: 'S S S S S S S S S S',
  19: 'S S S S S S S S S S',
  20: 'S S S S S S S S S S',
  21: 'S S S S S S S S S S',
}

// Soft totals: A2 (13) .. A9 (20), plus the trivial A,10 natural (21).
const SOFT: Record<number, string> = {
  13: 'H H H D D H H H H H', // A,2
  14: 'H H H D D H H H H H', // A,3
  15: 'H H D D D H H H H H', // A,4
  16: 'H H D D D H H H H H', // A,5
  17: 'H D D D D H H H H H', // A,6
  18: 'S D D D D S S H H H', // A,7  (S17: stand vs 2, hit vs 9/10/A)
  19: 'S S S S S S S S S S', // A,8  (S17: no double vs 6)
  20: 'S S S S S S S S S S', // A,9
  21: 'S S S S S S S S S S', // A,10 (natural)
}

// Pairs keyed by bucket 1..10 (1 = Aces, 10 = tens). DAS is on.
const PAIRS: Record<number, string> = {
  2:  'P P P P P P H H H H', // 2,2  split vs 2-7 (DAS)
  3:  'P P P P P P H H H H', // 3,3  split vs 2-7 (DAS)
  4:  'H H H P P H H H H H', // 4,4  split vs 5,6 (DAS)
  5:  'D D D D D D D D H H', // 5,5  never split — play as a 10
  6:  'P P P P P H H H H H', // 6,6  split vs 2-6 (DAS)
  7:  'P P P P P P H H H H', // 7,7  split vs 2-7
  8:  'P P P P P P P P P P', // 8,8  always split
  9:  'P P P P P S P P S S', // 9,9  split vs 2-6,8,9 · stand vs 7,10,A
  10: 'S S S S S S S S S S', // 10,10 always stand
  1:  'P P P P P P P P P P', // A,A  always split
}

const expand = (s: string): Action[] => s.trim().split(/\s+/).map((c) => CODE[c])

// Generate the engine's chart once for the whole suite.
const chart = basicStrategyChart(DEFAULT_RULES)

interface Mismatch {
  group: 'hard' | 'soft' | 'pairs'
  row: number
  up: number
  got: Action
  want: Action
}

function collect(
  group: 'hard' | 'soft' | 'pairs',
  grid: Record<number, Record<number, Action>>,
  spec: Record<number, string>,
): Mismatch[] {
  const out: Mismatch[] = []
  for (const row of Object.keys(spec).map(Number)) {
    const want = expand(spec[row])
    UPS.forEach((up, i) => {
      if (grid[row][up] !== want[i]) {
        out.push({ group, row, up, got: grid[row][up], want: want[i] })
      }
    })
  }
  return out
}

const allMismatches: Mismatch[] = [
  ...collect('hard', chart.hard, HARD),
  ...collect('soft', chart.soft, SOFT),
  ...collect('pairs', chart.pairs, PAIRS),
]

function fmt(m: Mismatch): string {
  const label =
    m.group === 'pairs' ? `${m.group}[${m.row === 1 ? 'A,A' : m.row + ',' + m.row}]` : `${m.group}[${m.row}]`
  return `${label} vs ${upLabel(m.up)}: engine=${m.got}, canonical=${m.want}`
}

// ---------------------------------------------------------------------------
// Cell-by-cell chart parity
// ---------------------------------------------------------------------------

describe('basic strategy — cell-by-cell vs canonical Wizard-of-Odds (6D S17 DAS LS)', () => {
  const totalCells =
    Object.keys(HARD).length * 10 + Object.keys(SOFT).length * 10 + Object.keys(PAIRS).length * 10

  it('reports the mismatch tally', () => {
    // eslint-disable-next-line no-console
    console.log(
      `\n[VERIFY] chart parity: ${allMismatches.length} mismatched cell(s) out of ${totalCells}`,
    )
    for (const m of allMismatches) console.log(`[VERIFY]   MISMATCH ${fmt(m)}`)
  })

  it('hard totals 5-21 match every cell', () => {
    expect(collect('hard', chart.hard, HARD).map(fmt)).toEqual([])
  })

  it('soft totals A2-A9 (and A,10) match every cell', () => {
    expect(collect('soft', chart.soft, SOFT).map(fmt)).toEqual([])
  })

  it('pairs 2,2 .. A,A match every cell', () => {
    expect(collect('pairs', chart.pairs, PAIRS).map(fmt)).toEqual([])
  })

  it('has zero mismatches across the whole chart', () => {
    expect(allMismatches.map(fmt)).toEqual([])
  })

  // Spotlight the surrender cells the task calls out explicitly.
  it('late-surrender cells: 16 vs 9/10/A and 15 vs 10 surrender', () => {
    expect(chart.hard[16][9]).toBe('surrender')
    expect(chart.hard[16][10]).toBe('surrender')
    expect(chart.hard[16][1]).toBe('surrender')
    expect(chart.hard[15][10]).toBe('surrender')
    // And the neighbours that must NOT surrender under S17:
    expect(chart.hard[15][9]).toBe('hit')
    expect(chart.hard[15][1]).toBe('hit')
    expect(chart.hard[16][8]).toBe('hit')
  })
})

// ---------------------------------------------------------------------------
// House-edge estimate by exact off-the-top enumeration
// ---------------------------------------------------------------------------

describe('house edge — DEFAULT_RULES ≈ 0.33% (±0.04%)', () => {
  it('enumerates every opening and lands on the published edge', () => {
    const rules = DEFAULT_RULES
    const decks = rules.decks
    const N0 = 52 * decks
    const counts = new Array(11).fill(0)
    for (let b = 1; b <= 9; b++) counts[b] = 4 * decks
    counts[10] = 16 * decks

    // Probability of drawing the ordered value sequence `values` off a fresh shoe
    // (without replacement — coincident values deplete correctly).
    const seqProb = (values: number[]): number => {
      const work = counts.slice()
      let n = N0
      let p = 1
      for (const v of values) {
        p *= work[v] / n
        work[v] -= 1
        n -= 1
      }
      return p
    }

    let probMass = 0
    let evSum = 0 // true expected result per unit of the original bet
    let condSum = 0 // engine's conditional EV, ignoring dealer naturals (diagnostic)

    for (let a = 1; a <= 10; a++) {
      for (let b = a; b <= 10; b++) {
        // Fresh shoe minus the two player cards.
        let base = removeFromComposition(compositionFromDecks(decks), a)
        base = removeFromComposition(base, b)
        const playerNatural = isBlackjack([mkCard(a), mkCard(b)])
        for (const up of UPS) {
          const comp = removeFromComposition(base, up)
          const weight =
            a === b ? seqProb([a, a, up]) : seqProb([a, b, up]) + seqProb([b, a, up])
          if (weight === 0) continue

          const E = evaluate([mkCard(a), mkCard(b)], up, comp, rules).ranked[0].ev

          // `evaluate` returns EV CONDITIONAL on no dealer blackjack whenever the
          // dealer shows A/10 and peeks (player naturals already carry the full
          // unconditional payout). Fold the peeked-natural loss back in here.
          let trueEV = E
          if ((up === 1 || up === 10) && !playerNatural) {
            const nComp = totalCards(comp)
            const pBJ = nComp > 0 ? (up === 1 ? comp[10] : comp[1]) / nComp : 0
            trueEV = pBJ * -1 + (1 - pBJ) * E
          }

          probMass += weight
          evSum += weight * trueEV
          condSum += weight * E
        }
      }
    }

    const houseEdge = -evSum // fraction of the original bet lost per round
    const uncorrected = -condSum

    // eslint-disable-next-line no-console
    console.log(
      `\n[VERIFY] house edge = ${(houseEdge * 100).toFixed(4)}% ` +
        `(player EV ${(evSum * 100).toFixed(4)}% per unit)\n` +
        `[VERIFY]   probability mass covered = ${probMass.toFixed(10)} (want 1)\n` +
        `[VERIFY]   edge ignoring dealer naturals = ${(uncorrected * 100).toFixed(4)}% (diagnostic)`,
    )

    // Sanity: the enumeration must cover the whole opening distribution.
    expect(probMass).toBeCloseTo(1, 9)

    // Published 6D S17 DAS LS 3:2 basic-strategy house edge ≈ 0.33% (exact off-the-top).
    // (The no-surrender variant of these rules is ≈0.40% — do not conflate.)
    expect(houseEdge).toBeGreaterThan(0.0030)
    expect(houseEdge).toBeLessThan(0.0037)
  }, 120000)
})

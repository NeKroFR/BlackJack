import type { Card, Rank, Rules } from './types'
import {
  compositionFromDecks,
  isBlackjack,
  mulberry32,
  removeFromComposition,
  totalCards,
  type Rng,
} from './cards'
import { evaluate } from './ev'

/**
 * Betting, bankroll & risk math plus a seeded Monte-Carlo session simulator (SPEC §7).
 *
 * All edges are expressed as a fraction of one unit bet (e.g. 0.005 = +0.5%).
 * Per-hand variance at flat bet is ~1.3 (SD ~1.15). The extra spread over a
 * plain even-money bet (variance 1.0) comes from blackjacks (3:2), doubles, splits.
 */

/** Variance of the result of one hand at flat bet, in units^2. */
export const VARIANCE_PER_HAND = 1.3
/** Standard deviation of the result of one hand at flat bet, in units. */
export const SD_PER_HAND = 1.15
/** Player edge gained per +1 true count above the pivot (typical Hi-Lo / 6-deck). */
export const EDGE_PER_TRUE_COUNT = 0.005

// ---- Bet ramp --------------------------------------------------------------

/** One rung of a bet ramp: bet `units` when the true count is at least `minTrueCount`. */
export interface BetTier {
  minTrueCount: number
  units: number
}

/**
 * Maps a true count to units: pick the highest `minTrueCount` not exceeding the
 * current true count. Below every tier means sit out, bet 0 (Wonging).
 */
export type BetRamp = BetTier[]

/** Units to wager at the given true count for a ramp. Ramp need not be pre-sorted. */
export function betForTrueCount(ramp: BetRamp, tc: number): number {
  let units = 0
  let bestMin = -Infinity
  for (const tier of ramp) {
    if (tier.minTrueCount <= tc && tier.minTrueCount >= bestMin) {
      bestMin = tier.minTrueCount
      units = tier.units
    }
  }
  return units
}

// ---- Edge model ------------------------------------------------------------

// Dealer upcards in canonical column order: 2..10 then Ace (bucket 1).
const UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]

/** Build a nominal Card for a bucket value (1 = Ace, 10 = ten). */
function mkCard(value: number): Card {
  const rank: Rank = value === 1 ? 'A' : value === 10 ? 'T' : (String(value) as Rank)
  return { rank, suit: 'S', id: `edge-${value}` }
}

/** Cache key over every rule field that moves the off-the-top edge. */
function edgeKey(r: Rules): string {
  return [
    r.decks,
    r.soft17,
    r.das,
    r.double,
    r.maxSplitHands,
    r.resplitAces,
    r.hitSplitAces,
    r.surrender,
    r.blackjackPayout,
    r.dealerPeek,
  ].join('|')
}

const offTheTopCache = new Map<string, number>()

/**
 * Exact off-the-top house edge (positive fraction) from the EV SOLVER.
 *
 * Enumerates all 55 distinct opening two-card player hands × 10 dealer upcards,
 * weights each by its fresh-shoe without-replacement probability, takes
 * `evaluate()`'s best-action EV, and folds the peeked dealer-blackjack loss back
 * in for A/10 upcards (which `evaluate()` factors out of its conditional EVs).
 * Same method as src/engine/__verify__/strategy.verify.test.ts. ~0.33% for
 * DEFAULT_RULES. Memoized per rule set. Costs 550 solver evaluations.
 */
export function offTheTopEdge(rules: Rules): number {
  const key = edgeKey(rules)
  const cached = offTheTopCache.get(key)
  if (cached !== undefined) return cached

  const decks = rules.decks
  const N0 = 52 * decks
  const counts = new Array(11).fill(0)
  for (let b = 1; b <= 9; b++) counts[b] = 4 * decks
  counts[10] = 16 * decks

  // Probability of drawing the ordered value sequence off a fresh shoe,
  // without replacement (coincident values deplete correctly).
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

  let evSum = 0
  for (let a = 1; a <= 10; a++) {
    for (let b = a; b <= 10; b++) {
      let base = removeFromComposition(compositionFromDecks(decks), a)
      base = removeFromComposition(base, b)
      const playerNatural = isBlackjack([mkCard(a), mkCard(b)])
      for (const up of UPCARDS) {
        const comp = removeFromComposition(base, up)
        const weight =
          a === b ? seqProb([a, a, up]) : seqProb([a, b, up]) + seqProb([b, a, up])
        if (weight === 0) continue

        const E = evaluate([mkCard(a), mkCard(b)], up, comp, rules).ranked[0].ev

        // `evaluate` returns EV CONDITIONAL on no dealer blackjack when the dealer
        // peeks on A/10 (player naturals already carry the full payout). Fold the
        // peeked-natural loss back in for the true unconditional EV.
        let trueEV = E
        if (rules.dealerPeek && (up === 1 || up === 10) && !playerNatural) {
          const nComp = totalCards(comp)
          const pBJ = nComp > 0 ? (up === 1 ? comp[10] : comp[1]) / nComp : 0
          trueEV = pBJ * -1 + (1 - pBJ) * E
        }

        evSum += weight * trueEV
      }
    }
  }

  const edge = -evSum
  offTheTopCache.set(key, edge)
  return edge
}

/**
 * Off-the-top house edge (positive fraction) via {@link offTheTopEdge}.
 * ~0.33% for DEFAULT_RULES.
 */
export function houseEdge(rules: Rules): number {
  return offTheTopEdge(rules)
}

/**
 * Player edge (as a fraction of the bet) at a given Hi-Lo true count.
 * Off the top the player faces the house edge. Each +1 true count adds
 * roughly +0.5%. Below the pivot the edge goes more negative.
 */
export function advantagePerTrueCount(tc: number, rules: Rules): number {
  return -houseEdge(rules) + EDGE_PER_TRUE_COUNT * tc
}

// ---- Bankroll math ---------------------------------------------------------

/**
 * Kelly-optimal bet size (in dollars) for a positive edge.
 * Optimal fraction of bankroll f* = edge / variance, so wager = bankroll * f*.
 * Non-positive edge means no bet.
 */
export function kellyBet(bankroll: number, edge: number, variancePerHand: number = VARIANCE_PER_HAND): number {
  if (edge <= 0 || bankroll <= 0) return 0
  return (bankroll * edge) / variancePerHand
}

/**
 * Lifetime risk of ruin using the standard continuous (diffusion) approximation:
 *
 *   RoR = exp( -2 * edge * (bankroll / unit) / sd^2 )
 *
 * where `bankroll / unit` is bankroll in betting units, `edge` the per-hand
 * advantage in units, `sd` the per-hand SD in units. Non-positive edge means
 * eventual ruin (RoR = 1).
 */
export function riskOfRuin(bankroll: number, unit: number, edge: number, sd: number): number {
  if (edge <= 0) return 1
  if (bankroll <= 0 || unit <= 0) return 1
  const ror = Math.exp((-2 * edge * bankroll) / (sd * sd * unit))
  return Math.min(1, Math.max(0, ror))
}

/**
 * N0: hands after which cumulative expected win equals one SD of the cumulative
 * result, where advantage overcomes variance:
 *
 *   N * edge = sqrt(N) * sd   =>   N0 = (sd / edge)^2
 */
export function n0(edge: number, sd: number): number {
  if (edge <= 0) return Infinity
  const ratio = sd / edge
  return ratio * ratio
}

// ---- True-count distribution (for EV/hr and simulation) --------------------

/**
 * Approximate frequency of each integer true count (Hi-Lo 6-deck). Normal
 * centred at 0, spread widening with penetration (deeper = more time at extremes).
 * Documented approximation, adequate for EV/hr and bankroll sims.
 */
export function trueCountDistribution(pen: number): { tc: number; freq: number }[] {
  const sigma = 0.9 + 0.7 * Math.max(0, Math.min(1, pen))
  const dist: { tc: number; freq: number }[] = []
  let sum = 0
  for (let tc = -15; tc <= 15; tc++) {
    const z = tc / sigma
    const freq = Math.exp(-0.5 * z * z)
    dist.push({ tc, freq })
    sum += freq
  }
  for (const d of dist) d.freq /= sum
  return dist
}

/**
 * Expected value per hour, in units, for a bet ramp. Weights each true count by its
 * frequency, wagers per the ramp and earns that true count's edge:
 *
 *   EV/hr = handsPerHour * Σ freq(tc) * bet(tc) * edge(tc)
 */
export function evPerHour(spread: BetRamp, handsPerHour: number, rules: Rules, pen: number): number {
  const dist = trueCountDistribution(pen)
  let evPerHand = 0
  for (const { tc, freq } of dist) {
    const units = betForTrueCount(spread, tc)
    if (units === 0) continue
    evPerHand += freq * units * advantagePerTrueCount(tc, rules)
  }
  return evPerHand * handsPerHour
}

// ---- Monte-Carlo session simulator -----------------------------------------

export interface SimConfig {
  rules: Rules
  /** Bet ramp mapping true count -> units. */
  ramp: BetRamp
  /** Dollar value of one betting unit. */
  unit: number
  /** Starting bankroll in dollars. */
  bankroll: number
  /** Hands dealt per session. */
  handsPerSession: number
  /** Number of independent sessions to simulate. */
  sessions: number
  /** Seed for the reproducible RNG. */
  seed: number
  /** Shoe penetration (drives the true-count distribution). Defaults to rules.penetration. */
  pen?: number
  /** Bankroll at or below which the session is considered busted. Default 0. */
  ruinThreshold?: number
}

export interface SimResult {
  /** Final bankroll of every session. */
  finalBankrolls: number[]
  /** Profit (final - starting) of every session. */
  profits: number[]
  /** Mean profit across sessions. */
  mean: number
  /** Standard deviation of profit across sessions. */
  sd: number
  /** Median final bankroll. */
  median: number
  /** Final-bankroll percentiles. */
  percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number }
  /** Fraction of sessions that hit the ruin threshold. */
  bustRate: number
  /** A handful of full per-hand bankroll trajectories for charting. */
  sampleTrajectories: number[][]
}

/** Standard-normal sample via Box-Muller from a uniform RNG. */
function nextNormal(rng: Rng): number {
  let u1 = rng()
  const u2 = rng()
  if (u1 < 1e-12) u1 = 1e-12
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/**
 * Seeded Monte-Carlo of betting sessions. Each hand samples a true count from the
 * penetration-driven distribution, wagers per the ramp, and draws a result from a
 * Normal(edge*bet, sd*bet) approximation of a blackjack round. Deterministic: a given
 * seed always reproduces identical output.
 */
export function simulateSessions(cfg: SimConfig): SimResult {
  const pen = cfg.pen ?? cfg.rules.penetration
  const ruin = cfg.ruinThreshold ?? 0
  const dist = trueCountDistribution(pen)
  // Precompute a cumulative distribution for fast sampling.
  const cdf: number[] = []
  let acc = 0
  for (const d of dist) {
    acc += d.freq
    cdf.push(acc)
  }

  const rng = mulberry32(cfg.seed)
  const sampleTc = (): number => {
    const r = rng()
    for (let i = 0; i < cdf.length; i++) {
      if (r <= cdf[i]) return dist[i].tc
    }
    return dist[dist.length - 1].tc
  }

  const finalBankrolls: number[] = []
  const profits: number[] = []
  let busts = 0
  const maxTrajectories = Math.min(cfg.sessions, 12)
  const sampleTrajectories: number[][] = []

  for (let s = 0; s < cfg.sessions; s++) {
    let bankroll = cfg.bankroll
    const keepTrajectory = s < maxTrajectories
    const traj: number[] = keepTrajectory ? [bankroll] : []
    let busted = false

    for (let h = 0; h < cfg.handsPerSession; h++) {
      const tc = sampleTc()
      const units = betForTrueCount(cfg.ramp, tc)
      if (units > 0) {
        const bet = units * cfg.unit
        const edge = advantagePerTrueCount(tc, cfg.rules)
        const result = edge * bet + SD_PER_HAND * bet * nextNormal(rng)
        bankroll += result
      }
      if (keepTrajectory) traj.push(bankroll)
      if (bankroll <= ruin) {
        busted = true
        if (keepTrajectory) {
          // Pad the remaining hands with the busted bankroll for uniform charting.
          for (let k = h + 1; k < cfg.handsPerSession; k++) traj.push(bankroll)
        }
        break
      }
    }

    if (busted) busts++
    if (keepTrajectory) sampleTrajectories.push(traj)
    finalBankrolls.push(bankroll)
    profits.push(bankroll - cfg.bankroll)
  }

  const n = profits.length || 1
  const mean = profits.reduce((a, b) => a + b, 0) / n
  const variance = profits.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n
  const sd = Math.sqrt(variance)

  const sortedFinal = finalBankrolls.slice().sort((a, b) => a - b)

  return {
    finalBankrolls,
    profits,
    mean,
    sd,
    median: percentile(sortedFinal, 0.5),
    percentiles: {
      p5: percentile(sortedFinal, 0.05),
      p25: percentile(sortedFinal, 0.25),
      p50: percentile(sortedFinal, 0.5),
      p75: percentile(sortedFinal, 0.75),
      p95: percentile(sortedFinal, 0.95),
    },
    bustRate: busts / n,
    sampleTrajectories,
  }
}

// Pure betting-math helpers for the Betting & Bankroll sim mode.
//
// Everything here builds on the engine's exported primitives (advantagePerTrueCount,
// betForTrueCount, kellyBet, riskOfRuin, n0, evPerHour, trueCountDistribution,
// SD_PER_HAND). We never re-derive the edge model, we only aggregate it over a
// ramp so the UI can show scannable risk numbers and a growth chart.

import type { Rules } from '../../engine/types'
import {
  SD_PER_HAND,
  advantagePerTrueCount,
  betForTrueCount,
  evPerHour,
  kellyBet,
  n0,
  riskOfRuin,
  trueCountDistribution,
  type BetRamp,
  type SimResult,
} from '../../engine/betting'

export type RiskTolerance = 'low' | 'med' | 'high'

/** Aggregated per-hand statistics for a bet ramp under a rule set + penetration. */
export interface RampStats {
  /** Expected profit per hand, in betting units. */
  edgePerHandUnits: number
  /** Standard deviation of one hand's result, in betting units. */
  sdPerHandUnits: number
  /** Average amount wagered per hand, in betting units (includes sit-out hands as 0). */
  avgBetUnits: number
  /** Fraction of hands the ramp actually plays (bet > 0). */
  playRate: number
  /** Expected profit per hour, in dollars. */
  evHourDollars: number
  /** Lifetime risk of ruin for the bankroll under this ramp (0..1). */
  riskOfRuin: number
  /** Hands to overcome one SD of variance (N0). Infinity for a non-positive edge. */
  n0: number
}

/**
 * Aggregate a ramp into per-hand edge/variance and the headline risk metrics.
 * `bankroll` and `unit` are in dollars, the ramp's tiers are in betting units.
 */
export function computeRampStats(
  ramp: BetRamp,
  rules: Rules,
  bankroll: number,
  unit: number,
  pen: number,
  handsPerHour: number,
): RampStats {
  const dist = trueCountDistribution(pen)

  let mean = 0 // E[result] per hand, in units
  let secondMoment = 0 // E[result^2] per hand, in units^2
  let avgBet = 0
  let playFreq = 0

  for (const { tc, freq } of dist) {
    const betUnits = betForTrueCount(ramp, tc)
    avgBet += freq * betUnits
    if (betUnits <= 0) continue
    playFreq += freq
    const edge = advantagePerTrueCount(tc, rules)
    const m = edge * betUnits // per-hand mean given this tc
    const variance = SD_PER_HAND * betUnits * (SD_PER_HAND * betUnits) // (sd*bet)^2
    mean += freq * m
    secondMoment += freq * (variance + m * m)
  }

  const variance = Math.max(0, secondMoment - mean * mean)
  const sd = Math.sqrt(variance)

  return {
    edgePerHandUnits: mean,
    sdPerHandUnits: sd,
    avgBetUnits: avgBet,
    playRate: playFreq,
    evHourDollars: evPerHour(ramp, handsPerHour, rules, pen) * unit,
    riskOfRuin: riskOfRuin(bankroll, unit, mean, sd),
    n0: n0(mean, sd),
  }
}

// ---- Spread recommender -----------------------------------------------------

const KELLY_FRACTION: Record<RiskTolerance, number> = { low: 0.3, med: 0.55, high: 0.9 }
const MAX_UNITS: Record<RiskTolerance, number> = { low: 8, med: 12, high: 20 }

/**
 * Recommend a bet ramp that fits a bankroll and risk appetite.
 *
 * Sizing is fractional-Kelly: at each true count the Kelly-optimal wager is scaled
 * by a risk-tolerance factor, converted to whole units, clamped to a per-tolerance
 * cap and forced non-decreasing. Redundant equal tiers are collapsed so the ramp
 * stays readable. This uses the engine's own edge (`advantagePerTrueCount`) and
 * Kelly (`kellyBet`) so the recommendation stays consistent with the sim.
 */
export function recommendSpread(
  bankroll: number,
  unit: number,
  rules: Rules,
  riskTol: RiskTolerance,
): BetRamp {
  const fraction = KELLY_FRACTION[riskTol]
  const cap = MAX_UNITS[riskTol]
  const ramp: BetRamp = []
  let prev = 0

  for (let tc = 1; tc <= 6; tc++) {
    const edge = advantagePerTrueCount(tc, rules)
    const kellyDollars = kellyBet(bankroll, edge) * fraction
    const raw = unit > 0 ? Math.round(kellyDollars / unit) : 1
    let units = Math.max(1, Math.min(cap, raw))
    if (units < prev) units = prev // enforce a non-decreasing ramp
    if (units === prev && ramp.length > 0) continue // collapse redundant tier
    ramp.push({ minTrueCount: tc, units })
    prev = units
  }

  if (ramp.length === 0) ramp.push({ minTrueCount: 1, units: 1 })
  return ramp
}

// ---- Percentile growth bands ------------------------------------------------

/** Standard-normal quantiles for the five percentile bands. */
const Z: Record<'p5' | 'p25' | 'p50' | 'p75' | 'p95', number> = {
  p5: -1.6449,
  p25: -0.6745,
  p50: 0,
  p75: 0.6745,
  p95: 1.6449,
}

export interface GrowthBands {
  /** Hand index at each sampled point (x-axis). */
  hands: number[]
  p5: number[]
  p25: number[]
  p50: number[]
  p75: number[]
  p95: number[]
}

/**
 * Bankroll-growth percentile bands over the session, anchored to a Monte-Carlo run.
 *
 * The median drifts linearly from the starting bankroll to the simulated median
 * final bankroll. Each band's spread from the median grows as sqrt(time), the
 * signature of a random walk, and is scaled so the endpoints exactly match the
 * simulation's final p5/p25/p75/p95. So the curve is a smooth, honest read of the
 * MC result rather than an independent model.
 */
export function growthBands(
  result: SimResult,
  startBankroll: number,
  handsPerSession: number,
  points = 40,
): GrowthBands {
  const { percentiles } = result
  const median = percentiles.p50
  const dev = {
    p5: percentiles.p5 - median,
    p25: percentiles.p25 - median,
    p50: 0,
    p75: percentiles.p75 - median,
    p95: percentiles.p95 - median,
  }

  const hands: number[] = []
  const out: GrowthBands = { hands, p5: [], p25: [], p50: [], p75: [], p95: [] }

  const steps = Math.max(1, points)
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps
    const h = Math.round(frac * handsPerSession)
    const centre = startBankroll + frac * (median - startBankroll)
    const shape = Math.sqrt(frac)
    hands.push(h)
    out.p5.push(Math.max(0, centre + dev.p5 * shape))
    out.p25.push(Math.max(0, centre + dev.p25 * shape))
    out.p50.push(Math.max(0, centre))
    out.p75.push(Math.max(0, centre + dev.p75 * shape))
    out.p95.push(Math.max(0, centre + dev.p95 * shape))
  }
  return out
}

// Re-export the z-table only for tests / debugging.
export const BAND_Z = Z

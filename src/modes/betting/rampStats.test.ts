import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '../../engine/rules'
import type { BetRamp, SimResult } from '../../engine/betting'
import { computeRampStats, recommendSpread, growthBands } from './rampStats'

const RAMP: BetRamp = [
  { minTrueCount: 1, units: 1 },
  { minTrueCount: 2, units: 2 },
  { minTrueCount: 3, units: 4 },
  { minTrueCount: 4, units: 8 },
]

describe('computeRampStats', () => {
  it('produces sane per-hand aggregates for a positive-edge ramp', () => {
    const s = computeRampStats(RAMP, DEFAULT_RULES, 10_000, 25, 0.75, 100)
    expect(s.sdPerHandUnits).toBeGreaterThan(0)
    expect(s.avgBetUnits).toBeGreaterThan(0)
    expect(s.playRate).toBeGreaterThan(0)
    expect(s.playRate).toBeLessThanOrEqual(1)
    // A workable Wong ramp is +EV, so EV/hr is positive and RoR is a real probability.
    expect(s.evHourDollars).toBeGreaterThan(0)
    expect(s.riskOfRuin).toBeGreaterThan(0)
    expect(s.riskOfRuin).toBeLessThan(1)
    expect(Number.isFinite(s.n0)).toBe(true)
  })

  it('has a lower risk of ruin with a larger bankroll', () => {
    const small = computeRampStats(RAMP, DEFAULT_RULES, 2_000, 25, 0.75, 100)
    const big = computeRampStats(RAMP, DEFAULT_RULES, 20_000, 25, 0.75, 100)
    expect(big.riskOfRuin).toBeLessThan(small.riskOfRuin)
  })
})

describe('recommendSpread', () => {
  it('returns a non-decreasing ramp whose rungs start at TC ≥ 1', () => {
    const ramp = recommendSpread(10_000, 25, DEFAULT_RULES, 'med')
    expect(ramp.length).toBeGreaterThan(0)
    expect(ramp[0].minTrueCount).toBe(1)
    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i].units).toBeGreaterThanOrEqual(ramp[i - 1].units)
      expect(ramp[i].minTrueCount).toBeGreaterThan(ramp[i - 1].minTrueCount)
    }
  })

  it('bets more aggressively at higher risk tolerance', () => {
    const maxUnits = (r: BetRamp) => Math.max(...r.map((t) => t.units))
    const low = recommendSpread(20_000, 25, DEFAULT_RULES, 'low')
    const high = recommendSpread(20_000, 25, DEFAULT_RULES, 'high')
    expect(maxUnits(high)).toBeGreaterThanOrEqual(maxUnits(low))
  })

  it('scales bet size with bankroll', () => {
    const maxUnits = (r: BetRamp) => Math.max(...r.map((t) => t.units))
    const poor = recommendSpread(1_000, 25, DEFAULT_RULES, 'med')
    const rich = recommendSpread(50_000, 25, DEFAULT_RULES, 'med')
    expect(maxUnits(rich)).toBeGreaterThanOrEqual(maxUnits(poor))
  })
})

describe('growthBands', () => {
  const fakeResult = (): SimResult => ({
    finalBankrolls: [],
    profits: [],
    mean: 300,
    sd: 800,
    median: 1_200,
    percentiles: { p5: 400, p25: 900, p50: 1_200, p75: 1_600, p95: 2_300 },
    bustRate: 0.03,
    sampleTrajectories: [],
  })

  it('starts every band at the starting bankroll and ends at the sim percentiles', () => {
    const bands = growthBands(fakeResult(), 1_000, 500, 40)
    expect(bands.hands[0]).toBe(0)
    expect(bands.hands[bands.hands.length - 1]).toBe(500)
    // Start: all bands equal the starting bankroll.
    expect(bands.p5[0]).toBeCloseTo(1_000, 6)
    expect(bands.p95[0]).toBeCloseTo(1_000, 6)
    // End: bands land on the simulated final percentiles.
    const last = bands.p5.length - 1
    expect(bands.p5[last]).toBeCloseTo(400, 6)
    expect(bands.p50[last]).toBeCloseTo(1_200, 6)
    expect(bands.p95[last]).toBeCloseTo(2_300, 6)
  })

  it('keeps the percentile bands ordered at every sampled point', () => {
    const bands = growthBands(fakeResult(), 1_000, 500, 40)
    for (let i = 0; i < bands.hands.length; i++) {
      expect(bands.p5[i]).toBeLessThanOrEqual(bands.p25[i] + 1e-9)
      expect(bands.p25[i]).toBeLessThanOrEqual(bands.p50[i] + 1e-9)
      expect(bands.p50[i]).toBeLessThanOrEqual(bands.p75[i] + 1e-9)
      expect(bands.p75[i]).toBeLessThanOrEqual(bands.p95[i] + 1e-9)
    }
  })
})

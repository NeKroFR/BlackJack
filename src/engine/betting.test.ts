import { describe, it, expect } from 'vitest'
import { DEFAULT_RULES } from './rules'
import {
  VARIANCE_PER_HAND,
  SD_PER_HAND,
  advantagePerTrueCount,
  houseEdge,
  kellyBet,
  riskOfRuin,
  n0,
  evPerHour,
  betForTrueCount,
  trueCountDistribution,
  simulateSessions,
  type BetRamp,
  type SimConfig,
} from './betting'

const RAMP: BetRamp = [
  { minTrueCount: 1, units: 1 },
  { minTrueCount: 2, units: 2 },
  { minTrueCount: 3, units: 4 },
  { minTrueCount: 4, units: 8 },
  { minTrueCount: 5, units: 12 },
]

describe('houseEdge', () => {
  it('matches the solver off-the-top edge (~0.33%) for DEFAULT_RULES', () => {
    expect(houseEdge(DEFAULT_RULES)).toBeCloseTo(0.0033, 3)
  })

  it('H17 is worse for the player than S17', () => {
    const h17 = houseEdge({ ...DEFAULT_RULES, soft17: 'H17' })
    expect(h17).toBeGreaterThan(houseEdge(DEFAULT_RULES))
  })

  it('6:5 blackjack is worse for the player than 3:2', () => {
    const badPay = houseEdge({ ...DEFAULT_RULES, blackjackPayout: '6:5' })
    expect(badPay).toBeGreaterThan(houseEdge(DEFAULT_RULES))
  })

  it('a single deck is better for the player than six decks', () => {
    expect(houseEdge({ ...DEFAULT_RULES, decks: 1 })).toBeLessThan(
      houseEdge({ ...DEFAULT_RULES, decks: 6 }),
    )
  })
})

describe('advantagePerTrueCount', () => {
  it('is the negative house edge at true count 0', () => {
    expect(advantagePerTrueCount(0, DEFAULT_RULES)).toBeCloseTo(-houseEdge(DEFAULT_RULES), 6)
  })

  it('gains ~0.5% per +1 true count', () => {
    const e0 = advantagePerTrueCount(0, DEFAULT_RULES)
    const e1 = advantagePerTrueCount(1, DEFAULT_RULES)
    const e2 = advantagePerTrueCount(2, DEFAULT_RULES)
    expect(e1 - e0).toBeCloseTo(0.005, 6)
    expect(e2 - e1).toBeCloseTo(0.005, 6)
  })

  it('crosses into player advantage around +1 true count', () => {
    expect(advantagePerTrueCount(1, DEFAULT_RULES)).toBeGreaterThan(0)
    expect(advantagePerTrueCount(0, DEFAULT_RULES)).toBeLessThan(0)
  })
})

describe('kellyBet', () => {
  it('is bankroll * edge / variance', () => {
    expect(kellyBet(10000, 0.01)).toBeCloseTo((10000 * 0.01) / VARIANCE_PER_HAND, 6)
    expect(kellyBet(10000, 0.02, 1.3)).toBeCloseTo((10000 * 0.02) / 1.3, 6)
  })

  it('bets nothing at a non-positive edge', () => {
    expect(kellyBet(10000, 0)).toBe(0)
    expect(kellyBet(10000, -0.01)).toBe(0)
  })

  it('scales linearly with bankroll and edge', () => {
    expect(kellyBet(20000, 0.01)).toBeCloseTo(2 * kellyBet(10000, 0.01), 9)
    expect(kellyBet(10000, 0.02)).toBeCloseTo(2 * kellyBet(10000, 0.01), 9)
  })
})

describe('riskOfRuin', () => {
  it('matches the exp(-2*edge*B/(sd^2*unit)) formula', () => {
    const expected = Math.exp((-2 * 0.01 * 10000) / (1.15 * 1.15 * 100))
    expect(riskOfRuin(10000, 100, 0.01, 1.15)).toBeCloseTo(expected, 9)
  })

  it('is 1 for a non-positive edge', () => {
    expect(riskOfRuin(10000, 100, 0, 1.15)).toBe(1)
    expect(riskOfRuin(10000, 100, -0.01, 1.15)).toBe(1)
  })

  it('stays within [0,1] and falls as bankroll grows', () => {
    const small = riskOfRuin(5000, 100, 0.01, 1.15)
    const big = riskOfRuin(20000, 100, 0.01, 1.15)
    expect(big).toBeGreaterThanOrEqual(0)
    expect(small).toBeLessThanOrEqual(1)
    expect(big).toBeLessThan(small)
  })

  it('is a plausible fraction for a typical bankroll', () => {
    const ror = riskOfRuin(10000, 100, 0.01, 1.15)
    expect(ror).toBeGreaterThan(0.15)
    expect(ror).toBeLessThan(0.3)
  })
})

describe('n0', () => {
  it('is (sd/edge)^2', () => {
    expect(n0(0.01, 1.15)).toBeCloseTo((1.15 / 0.01) ** 2, 6)
  })

  it('is Infinity for a non-positive edge', () => {
    expect(n0(0, 1.15)).toBe(Infinity)
    expect(n0(-0.005, 1.15)).toBe(Infinity)
  })

  it('grows as edge shrinks', () => {
    expect(n0(0.005, 1.15)).toBeGreaterThan(n0(0.01, 1.15))
  })
})

describe('betForTrueCount', () => {
  it('sits out below the ramp and picks the highest applicable tier', () => {
    expect(betForTrueCount(RAMP, 0)).toBe(0)
    expect(betForTrueCount(RAMP, 1)).toBe(1)
    expect(betForTrueCount(RAMP, 2)).toBe(2)
    expect(betForTrueCount(RAMP, 4)).toBe(8)
    expect(betForTrueCount(RAMP, 10)).toBe(12)
  })
})

describe('trueCountDistribution', () => {
  it('is a normalised pmf centred at 0', () => {
    const dist = trueCountDistribution(0.75)
    const total = dist.reduce((a, d) => a + d.freq, 0)
    expect(total).toBeCloseTo(1, 9)
    const peak = dist.reduce((m, d) => (d.freq > m.freq ? d : m))
    expect(peak.tc).toBe(0)
  })

  it('deeper penetration widens the spread', () => {
    const shallow = trueCountDistribution(0.5)
    const deep = trueCountDistribution(0.9)
    const tailFreq = (dist: { tc: number; freq: number }[]) =>
      dist.filter((d) => Math.abs(d.tc) >= 3).reduce((a, d) => a + d.freq, 0)
    expect(tailFreq(deep)).toBeGreaterThan(tailFreq(shallow))
  })
})

describe('evPerHour', () => {
  it('is positive for a real spread and scales with hands/hour', () => {
    const ev100 = evPerHour(RAMP, 100, DEFAULT_RULES, 0.75)
    const ev200 = evPerHour(RAMP, 200, DEFAULT_RULES, 0.75)
    expect(ev100).toBeGreaterThan(0)
    expect(ev200).toBeCloseTo(2 * ev100, 9)
  })

  it('a wider spread earns more than a flat bet', () => {
    const flat: BetRamp = [{ minTrueCount: -99, units: 1 }]
    const flatEv = evPerHour(flat, 100, DEFAULT_RULES, 0.75)
    const rampEv = evPerHour(RAMP, 100, DEFAULT_RULES, 0.75)
    expect(rampEv).toBeGreaterThan(flatEv)
  })
})

describe('simulateSessions', () => {
  const baseCfg: SimConfig = {
    rules: DEFAULT_RULES,
    ramp: RAMP,
    unit: 25,
    bankroll: 5000,
    handsPerSession: 200,
    sessions: 400,
    seed: 12345,
  }

  it('reproduces identical results for the same seed', () => {
    const a = simulateSessions(baseCfg)
    const b = simulateSessions(baseCfg)
    expect(b.finalBankrolls).toEqual(a.finalBankrolls)
    expect(b.mean).toBe(a.mean)
    expect(b.sd).toBe(a.sd)
    expect(b.bustRate).toBe(a.bustRate)
    expect(b.percentiles).toEqual(a.percentiles)
  })

  it('produces different results for a different seed', () => {
    const a = simulateSessions(baseCfg)
    const b = simulateSessions({ ...baseCfg, seed: 999 })
    expect(b.finalBankrolls).not.toEqual(a.finalBankrolls)
  })

  it('reports a bust rate in [0,1] and ordered percentiles', () => {
    const r = simulateSessions(baseCfg)
    expect(r.bustRate).toBeGreaterThanOrEqual(0)
    expect(r.bustRate).toBeLessThanOrEqual(1)
    expect(r.percentiles.p5).toBeLessThanOrEqual(r.percentiles.p25)
    expect(r.percentiles.p25).toBeLessThanOrEqual(r.percentiles.p50)
    expect(r.percentiles.p50).toBeLessThanOrEqual(r.percentiles.p75)
    expect(r.percentiles.p75).toBeLessThanOrEqual(r.percentiles.p95)
  })

  it('gives positive expectation over many hands with an advantage spread', () => {
    const r = simulateSessions({ ...baseCfg, handsPerSession: 1000, sessions: 600 })
    expect(r.mean).toBeGreaterThan(0)
  })

  it('trajectories start at the bankroll and match hand count', () => {
    const r = simulateSessions(baseCfg)
    expect(r.sampleTrajectories.length).toBeGreaterThan(0)
    for (const traj of r.sampleTrajectories) {
      expect(traj[0]).toBe(baseCfg.bankroll)
      expect(traj.length).toBe(baseCfg.handsPerSession + 1)
    }
  })

  it('a tiny bankroll busts more often than a large one', () => {
    const tiny = simulateSessions({ ...baseCfg, bankroll: 200, unit: 100 })
    const large = simulateSessions({ ...baseCfg, bankroll: 50000, unit: 25 })
    expect(tiny.bustRate).toBeGreaterThan(large.bustRate)
  })
})

describe('SD_PER_HAND / VARIANCE_PER_HAND constants', () => {
  it('are in the expected blackjack range', () => {
    expect(VARIANCE_PER_HAND).toBeCloseTo(1.3, 6)
    expect(SD_PER_HAND).toBeCloseTo(1.15, 6)
  })
})

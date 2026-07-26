import { describe, expect, it } from 'vitest'
import { nextHeat, heatLevel, HEAT_META, DEFAULT_HEAT_CONFIG } from './heat'

describe('nextHeat', () => {
  it('adds no heat on the opening bet (no previous wager)', () => {
    expect(nextHeat(0, 0, 100)).toBe(0)
    expect(nextHeat(0.4, 0, 100)).toBeCloseTo(0.4 * DEFAULT_HEAT_CONFIG.cool, 5)
  })

  it('rises with the size of a bet jump', () => {
    const small = nextHeat(0, 10, 20) // 2x
    const big = nextHeat(0, 10, 80) // 8x
    expect(small).toBeGreaterThan(0)
    expect(big).toBeGreaterThan(small)
    // A 2x jump adds exactly `rise`.
    expect(small).toBeCloseTo(DEFAULT_HEAT_CONFIG.rise, 5)
  })

  it('cools on a flat or lower bet', () => {
    const hot = 0.8
    expect(nextHeat(hot, 100, 100)).toBeCloseTo(hot * DEFAULT_HEAT_CONFIG.cool, 5)
    expect(nextHeat(hot, 100, 50)).toBeCloseTo(hot * DEFAULT_HEAT_CONFIG.cool, 5)
  })

  it('clamps to the 0..1 range', () => {
    expect(nextHeat(0.9, 10, 200)).toBe(1) // huge jump saturates
    expect(nextHeat(0, 100, 100)).toBe(0)
  })

  it('cools back down over several flat bets', () => {
    let h = 1
    for (let i = 0; i < 5; i++) h = nextHeat(h, 100, 100)
    expect(h).toBeLessThan(0.33)
  })
})

describe('heatLevel', () => {
  it('buckets by threshold', () => {
    expect(heatLevel(0)).toBe('cool')
    expect(heatLevel(0.32)).toBe('cool')
    expect(heatLevel(0.33)).toBe('warm')
    expect(heatLevel(0.65)).toBe('warm')
    expect(heatLevel(0.66)).toBe('hot')
    expect(heatLevel(1)).toBe('hot')
  })

  it('every level has display metadata', () => {
    for (const level of ['cool', 'warm', 'hot'] as const) {
      expect(HEAT_META[level].label).toBeTruthy()
      expect(HEAT_META[level].tip).toBeTruthy()
    }
  })
})

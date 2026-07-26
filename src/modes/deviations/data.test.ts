import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '../../engine/rules'
import type { Rules } from '../../engine/types'
import {
  buildDrills,
  buildRecallItems,
  complementAction,
  correctActionAt,
  gradeRecall,
  insuranceCorrect,
  isAscendingDeviation,
  offeredActions,
  recallCorrect,
  signed,
  type DeviationDrill,
} from './data'

const NO_SURRENDER: Rules = { ...DEFAULT_RULES, surrender: 'none' }

function find(drills: DeviationDrill[], hand: string, up: number): DeviationDrill {
  const d = drills.find((x) => x.hand === hand && x.dealerUpValue === up)
  if (!d) throw new Error(`no drill for ${hand} v ${up}`)
  return d
}

describe('complementAction', () => {
  it('pairs each action with the play on the far side of the index', () => {
    expect(complementAction('stand')).toBe('hit')
    expect(complementAction('hit')).toBe('stand')
    expect(complementAction('double')).toBe('hit')
    expect(complementAction('surrender')).toBe('hit')
    expect(complementAction('split')).toBe('stand')
  })
})

describe('signed', () => {
  it('formats counts with an explicit sign', () => {
    expect(signed(0)).toBe('0')
    expect(signed(3)).toBe('+3')
    expect(signed(-2)).toBe('-2')
  })
})

describe('buildDrills', () => {
  it('every drill has basic + deviation as the two sides of the index', () => {
    for (const d of buildDrills(DEFAULT_RULES)) {
      const sides = [d.aboveAction, d.belowAction]
      expect(sides).toContain(d.basicAction)
      expect(sides).toContain(d.deviationAction)
      expect(d.basicAction).not.toBe(d.deviationAction)
      expect(d.cards).toHaveLength(2)
    }
  })

  it('includes the Fab 4 and drops the Illustrious 15v10 when surrender is on', () => {
    const drills = buildDrills(DEFAULT_RULES)
    expect(drills.some((d) => d.set === 'fab4')).toBe(true)
    const fifteens = drills.filter((d) => d.hand === '15' && d.dealerUpValue === 10)
    // Only the Fab-4 surrender version survives (the Illustrious stand is dropped).
    expect(fifteens).toHaveLength(1)
    expect(fifteens[0].set).toBe('fab4')
  })

  it('excludes the Fab 4 and keeps the Illustrious 15v10 when surrender is off', () => {
    const drills = buildDrills(NO_SURRENDER)
    expect(drills.some((d) => d.set === 'fab4')).toBe(false)
    const fifteen = find(drills, '15', 10)
    expect(fifteen.set).toBe('illustrious')
    expect(fifteen.aboveAction).toBe('stand')
  })
})

describe('correctActionAt', () => {
  it('16 v 10 stands at TC >= 0 and hits below', () => {
    const d = find(buildDrills(NO_SURRENDER), '16', 10)
    expect(d.index).toBe(0)
    expect(correctActionAt(d, -1)).toBe('hit')
    expect(correctActionAt(d, 0)).toBe('stand')
    expect(correctActionAt(d, 3)).toBe('stand')
  })

  it('negative-index 13 v 2 stands down to the index and hits only far below it', () => {
    const d = find(buildDrills(DEFAULT_RULES), '13', 2)
    expect(d.index).toBe(-1)
    expect(d.basicAction).toBe('stand')
    expect(d.deviationAction).toBe('hit')
    expect(correctActionAt(d, 2)).toBe('stand')
    expect(correctActionAt(d, -1)).toBe('stand')
    expect(correctActionAt(d, -3)).toBe('hit')
  })

  it('TT v 5 splits at TC >= 5, stands below', () => {
    const d = find(buildDrills(DEFAULT_RULES), 'TT', 5)
    expect(correctActionAt(d, 4)).toBe('stand')
    expect(correctActionAt(d, 5)).toBe('split')
  })
})

describe('offeredActions', () => {
  it('offers surrender only when the rules allow it', () => {
    const withSr = find(buildDrills(DEFAULT_RULES), '14', 10) // Fab 4 surrender play
    expect(offeredActions(withSr, DEFAULT_RULES).has('surrender')).toBe(true)

    const stand = find(buildDrills(DEFAULT_RULES), '16', 10)
    expect([...offeredActions(stand, DEFAULT_RULES)].sort()).toEqual(['hit', 'stand'])

    const dbl = find(buildDrills(DEFAULT_RULES), '10', 10)
    expect(offeredActions(dbl, DEFAULT_RULES).has('double')).toBe(true)
  })
})

describe('index recall', () => {
  it('pools insurance plus only ascending departures', () => {
    const items = buildRecallItems(DEFAULT_RULES)
    expect(items.some((i) => i.key === 'insurance')).toBe(true)
    // 12 v 4 is a descending (hit-below) departure — never a recall prompt.
    expect(items.some((i) => i.matchup === '12 v 4')).toBe(false)
    // and every non-insurance item is a genuine ascending deviation
    for (const d of buildDrills(DEFAULT_RULES)) {
      const present = items.some((i) => i.key === d.key)
      expect(present).toBe(isAscendingDeviation(d))
    }
  })

  it('grades exact, close (±1) and wrong', () => {
    expect(gradeRecall(4, 4)).toBe('exact')
    expect(gradeRecall(5, 4)).toBe('close')
    expect(gradeRecall(3, 4)).toBe('close')
    expect(gradeRecall(6, 4)).toBe('wrong')
    expect(recallCorrect('exact')).toBe(true)
    expect(recallCorrect('close')).toBe(true)
    expect(recallCorrect('wrong')).toBe(false)
  })
})

describe('insuranceCorrect', () => {
  it('takes at TC >= +3, declines below', () => {
    expect(insuranceCorrect(3, true)).toBe(true)
    expect(insuranceCorrect(3, false)).toBe(false)
    expect(insuranceCorrect(2, false)).toBe(true)
    expect(insuranceCorrect(2, true)).toBe(false)
    expect(insuranceCorrect(6, true)).toBe(true)
  })
})

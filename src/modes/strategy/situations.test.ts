import { describe, expect, it } from 'vitest'
import { evaluate } from '../../engine/ev'
import { basicStrategyChart } from '../../engine/ev'
import { DEFAULT_RULES } from '../../engine/rules'
import { handTotal, isPair, bucket, mulberry32, totalCards } from '../../engine/cards'
import type { Rules } from '../../engine/types'
import {
  categoryFor,
  dealSituation,
  doubleAllowed,
  gradeChoice,
  legalActions,
  parseSituationKey,
  poolFor,
  situationKey,
  type Situation,
} from './situations'

const rng = mulberry32(12345)

describe('situation keys', () => {
  it('round-trips through encode/decode', () => {
    const cases: Situation[] = [
      { kind: 'pair', value: 8, up: 1 },
      { kind: 'soft', value: 18, up: 6 },
      { kind: 'hard', value: 16, up: 10 },
    ]
    for (const sit of cases) {
      expect(parseSituationKey(situationKey(sit))).toEqual(sit)
    }
  })

  it('rejects malformed keys', () => {
    expect(parseSituationKey('nope')).toBeNull()
    expect(parseSituationKey('X5v2')).toBeNull()
  })
})

describe('pools', () => {
  it('pairs pool contains only pair situations', () => {
    for (const key of poolFor('pairs')) {
      expect(parseSituationKey(key)?.kind).toBe('pair')
    }
  })

  it('stiff pool covers hard 12..16 vs every upcard', () => {
    const pool = poolFor('stiff')
    expect(pool).toHaveLength(5 * 10)
    for (const key of pool) {
      const sit = parseSituationKey(key)!
      expect(sit.kind).toBe('hard')
      expect(sit.value).toBeGreaterThanOrEqual(12)
      expect(sit.value).toBeLessThanOrEqual(16)
    }
  })

  it('all pool mixes every kind', () => {
    const kinds = new Set(poolFor('all').map((k) => parseSituationKey(k)!.kind))
    expect(kinds).toEqual(new Set(['hard', 'soft', 'pair']))
  })
})

describe('dealSituation', () => {
  it('deals cards matching the requested shape and upcard', () => {
    const cases: Situation[] = [
      { kind: 'pair', value: 8, up: 10 },
      { kind: 'soft', value: 18, up: 6 },
      { kind: 'hard', value: 16, up: 1 },
    ]
    for (const sit of cases) {
      const dealt = dealSituation(sit, DEFAULT_RULES, rng)
      const { total } = handTotal(dealt.playerCards)
      expect(bucket(dealt.dealerUpCard.rank)).toBe(sit.up)
      if (sit.kind === 'pair') {
        expect(isPair(dealt.playerCards)).toBe(true)
        expect(bucket(dealt.playerCards[0].rank)).toBe(sit.value)
      } else {
        expect(total).toBe(sit.value)
      }
      if (sit.kind === 'soft') {
        expect(handTotal(dealt.playerCards).soft).toBe(true)
      }
    }
  })

  it('produces a composition with the dealt cards removed', () => {
    const sit: Situation = { kind: 'hard', value: 16, up: 10 }
    const dealt = dealSituation(sit, DEFAULT_RULES, rng)
    // 6-deck shoe = 312 cards, minus 3 known cards.
    expect(totalCards(dealt.comp)).toBe(312 - 3)
  })
})

describe('legality', () => {
  const twoTens = dealSituation({ kind: 'pair', value: 10, up: 6 }, DEFAULT_RULES, rng).playerCards

  it('double rules gate the double action', () => {
    expect(doubleAllowed(11, false, DEFAULT_RULES)).toBe(true) // any2
    const nineEleven: Rules = { ...DEFAULT_RULES, double: '9-11' }
    expect(doubleAllowed(8, false, nineEleven)).toBe(false)
    expect(doubleAllowed(10, false, nineEleven)).toBe(true)
    expect(doubleAllowed(10, true, nineEleven)).toBe(false) // soft excluded by range rule
  })

  it('offers split only on a pair', () => {
    expect(legalActions(twoTens, DEFAULT_RULES).split).toBe(true)
    const nonPair = dealSituation({ kind: 'hard', value: 16, up: 6 }, DEFAULT_RULES, rng).playerCards
    expect(legalActions(nonPair, DEFAULT_RULES).split).toBe(false)
  })

  it('hides surrender when the rule is off', () => {
    const noSurr: Rules = { ...DEFAULT_RULES, surrender: 'none' }
    expect(legalActions(twoTens, noSurr).surrender).toBe(false)
    expect(legalActions(twoTens, DEFAULT_RULES).surrender).toBe(true)
  })
})

describe('categoryFor', () => {
  it('maps kinds to stat categories', () => {
    expect(categoryFor({ kind: 'pair', value: 8, up: 6 })).toBe('basicSplit')
    expect(categoryFor({ kind: 'soft', value: 18, up: 6 })).toBe('basicSoft')
    expect(categoryFor({ kind: 'hard', value: 16, up: 10 })).toBe('basicStiff')
  })
})

describe('gradeChoice', () => {
  it('grades the engine best action as correct', () => {
    const dealt = dealSituation({ kind: 'hard', value: 16, up: 10 }, DEFAULT_RULES, rng)
    const legal = legalActions(dealt.playerCards, DEFAULT_RULES)
    const decision = evaluate(dealt.playerCards, dealt.situation.up, dealt.comp, DEFAULT_RULES, {
      canDouble: legal.double,
      canSplit: legal.split,
      canSurrender: legal.surrender,
    })
    const good = gradeChoice(decision, decision.best)
    expect(good.correct).toBe(true)
    expect(good.evDelta).toBe(0)

    const wrongAction = decision.ranked[decision.ranked.length - 1].action
    if (wrongAction !== decision.best) {
      const bad = gradeChoice(decision, wrongAction)
      expect(bad.correct).toBe(false)
      expect(bad.evDelta).toBeLessThanOrEqual(0)
    }
  })

  it('scores a timeout (undefined choice) as incorrect', () => {
    const dealt = dealSituation({ kind: 'hard', value: 16, up: 10 }, DEFAULT_RULES, rng)
    const decision = evaluate(dealt.playerCards, dealt.situation.up, dealt.comp, DEFAULT_RULES)
    expect(gradeChoice(decision, undefined).correct).toBe(false)
  })
})

describe('grading matches the reference chart', () => {
  it('best action equals the basic-strategy chart cell for stiff totals', () => {
    const chart = basicStrategyChart(DEFAULT_RULES)
    for (const value of [12, 13, 14, 15, 16]) {
      for (const up of [2, 6, 9, 10, 1]) {
        const sit: Situation = { kind: 'hard', value, up }
        const dealt = dealSituation(sit, DEFAULT_RULES, rng)
        const legal = legalActions(dealt.playerCards, DEFAULT_RULES)
        const decision = evaluate(dealt.playerCards, up, dealt.comp, DEFAULT_RULES, {
          canDouble: legal.double,
          canSplit: legal.split,
          canSurrender: legal.surrender,
        })
        expect(decision.best).toBe(chart.hard[value][up])
      }
    }
  })
})

import { describe, expect, it } from 'vitest'
import {
  LESSONS,
  evalCriterion,
  lessonById,
  nextLesson,
  type CurriculumProgressInput,
} from './lessons'
import type { AccuracyMap } from '../../store'

function emptyAccuracy(): AccuracyMap {
  return {
    basicSplit: { correct: 0, total: 0 },
    basicSoft: { correct: 0, total: 0 },
    basicStiff: { correct: 0, total: 0 },
    counting: { correct: 0, total: 0 },
    deviations: { correct: 0, total: 0 },
    betting: { correct: 0, total: 0 },
  }
}

function input(partial?: Partial<CurriculumProgressInput>): CurriculumProgressInput {
  return { accuracy: emptyAccuracy(), sessions: [], ...partial }
}

describe('curriculum structure', () => {
  it('has six lessons ordered contiguously from 0', () => {
    expect(LESSONS).toHaveLength(6)
    LESSONS.forEach((l, i) => expect(l.order).toBe(i))
  })

  it('every lesson links a drill route and awards XP', () => {
    for (const l of LESSONS) {
      expect(l.drill.route.startsWith('/')).toBe(true)
      expect(l.xp).toBeGreaterThan(0)
    }
  })

  it('nextLesson walks the path and stops at the end', () => {
    expect(nextLesson('basic-strategy')?.id).toBe('running-count')
    expect(nextLesson(LESSONS[LESSONS.length - 1].id)).toBeUndefined()
    expect(lessonById('deviations')?.title).toBe('Deviations (Illustrious 18)')
  })
})

describe('evalCriterion — accuracy gate', () => {
  const basic = lessonById('basic-strategy')!.criterion

  it('is unmet with no attempts and reports zero progress', () => {
    const s = evalCriterion(basic, input())
    expect(s.met).toBe(false)
    expect(s.progress).toBe(0)
  })

  it('stays unmet below the attempt threshold even at 100% accuracy', () => {
    const acc = emptyAccuracy()
    acc.basicStiff = { correct: 10, total: 10 }
    const s = evalCriterion(basic, input({ accuracy: acc }))
    expect(s.met).toBe(false)
    expect(s.progress).toBeGreaterThan(0)
    expect(s.progress).toBeLessThan(1)
  })

  it('stays unmet at high volume but low accuracy', () => {
    const acc = emptyAccuracy()
    acc.basicStiff = { correct: 12, total: 30 } // 40%
    const s = evalCriterion(basic, input({ accuracy: acc }))
    expect(s.met).toBe(false)
  })

  it('is met once volume and accuracy targets are both cleared', () => {
    const acc = emptyAccuracy()
    acc.basicStiff = { correct: 9, total: 10 }
    acc.basicSoft = { correct: 9, total: 10 } // 18/20 = 90% over 20
    const s = evalCriterion(basic, input({ accuracy: acc }))
    expect(s.met).toBe(true)
    expect(s.progress).toBe(1)
  })

  it('true-count demands more volume than running-count in the same category', () => {
    const running = lessonById('running-count')!.criterion
    const trueCount = lessonById('true-count')!.criterion
    const acc = emptyAccuracy()
    acc.counting = { correct: 15, total: 18 } // ~83% over 18
    expect(evalCriterion(running, input({ accuracy: acc })).met).toBe(true)
    expect(evalCriterion(trueCount, input({ accuracy: acc })).met).toBe(false)
  })
})

describe('evalCriterion — sessions gate', () => {
  const live = lessonById('live-play')!.criterion

  it('is unmet with no matching sessions', () => {
    expect(evalCriterion(live, input()).met).toBe(false)
  })

  it('is met after a matching live session', () => {
    const s = evalCriterion(
      live,
      input({
        sessions: [
          { id: 's1', mode: 'play', startedAt: 0, endedAt: 1, hands: 10, correct: 8, total: 10 },
        ],
      }),
    )
    expect(s.met).toBe(true)
    expect(s.progress).toBe(1)
  })

  it('ignores sessions from other modes', () => {
    const s = evalCriterion(
      live,
      input({
        sessions: [
          { id: 's1', mode: 'betting', startedAt: 0, endedAt: 1, hands: 0, correct: 0, total: 0 },
        ],
      }),
    )
    expect(s.met).toBe(false)
  })
})

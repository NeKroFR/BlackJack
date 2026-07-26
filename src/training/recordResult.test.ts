import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { resetPersisted, useStore } from '../store'
import type { Card } from '../engine/types'
import {
  XP_CORRECT,
  XP_WRONG,
  awardXp,
  checkAchievements,
  isoDay,
  recordResult,
  useTraining,
  xpForAnswer,
  xpForLevel,
  xpToNextLevel,
} from './recordResult'
import { makeScheduler } from './spacedRepetition'

const card = (rank: Card['rank'], id: string): Card => ({ rank, suit: 'S', id })
const DAY = 86_400_000
const T0 = Date.UTC(2026, 6, 13) // a fixed midnight-UTC timestamp

beforeEach(() => {
  resetPersisted()
})

describe('xp helpers', () => {
  it('computes cumulative xp thresholds', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(100)
    expect(xpForLevel(5)).toBe(400)
  })

  it('reports xp remaining to the next level', () => {
    expect(xpToNextLevel(0)).toBe(100)
    expect(xpToNextLevel(30)).toBe(70)
    expect(xpToNextLevel(150)).toBe(50)
  })

  it('awards streak-bonused xp for correct, flat xp for wrong', () => {
    expect(xpForAnswer(false, 0)).toBe(XP_WRONG)
    expect(xpForAnswer(true, 1)).toBe(XP_CORRECT) // first in streak, no bonus
    expect(xpForAnswer(true, 4)).toBe(XP_CORRECT + 3)
    expect(xpForAnswer(true, 100)).toBe(XP_CORRECT + 10) // capped
  })

  it('awardXp reports level-ups', () => {
    const r = awardXp(150)
    expect(r.leveledUp).toBe(true)
    expect(r.toLevel).toBe(2)
    expect(useStore.getState().xp).toBe(150)
  })
})

describe('recordResult — correct answer', () => {
  it('bumps accuracy, streak, xp, level and daily streak', () => {
    const out = recordResult({ category: 'basicStiff', correct: true, now: T0 })
    const s = useStore.getState()
    expect(s.accuracy.basicStiff).toEqual({ correct: 1, total: 1 })
    expect(s.streak).toBe(1)
    expect(out.xpAwarded).toBe(XP_CORRECT)
    expect(s.xp).toBe(XP_CORRECT)
    expect(s.dailyStreak).toBe(1)
    expect(s.lastActiveDay).toBe(isoDay(T0))
    expect(out.loggedMistake).toBe(false)
    expect(out.achievementsUnlocked).toContain('first-steps')
  })
})

describe('recordResult — wrong answer', () => {
  it('logs a mistake with hand context and resets the streak', () => {
    // build a streak first
    recordResult({ category: 'basicStiff', correct: true, now: T0 })
    const out = recordResult({
      category: 'basicStiff',
      correct: false,
      now: T0 + 1000,
      handContext: { playerCards: [card('T', 'a'), card('6', 'b')], dealerUp: 10, trueCount: -1 },
      chosen: 'stand',
      best: 'hit',
      evDelta: -0.12,
    })
    const s = useStore.getState()
    expect(s.streak).toBe(0)
    expect(out.loggedMistake).toBe(true)
    expect(out.xpAwarded).toBe(XP_WRONG)
    expect(s.mistakeLog.length).toBe(1)
    const m = s.mistakeLog[0]
    expect(m.chosen).toBe('stand')
    expect(m.correct).toBe('hit')
    expect(m.dealerUp).toBe(10)
    expect(m.evDelta).toBe(-0.12)
    expect(m.timestamp).toBe(T0 + 1000)
  })

  it('clamps a positive evDelta to zero and skips logging without context', () => {
    const out = recordResult({ category: 'counting', correct: false, now: T0 })
    expect(out.loggedMistake).toBe(false)
    expect(useStore.getState().mistakeLog.length).toBe(0)

    recordResult({
      category: 'counting',
      correct: false,
      now: T0,
      handContext: { playerCards: [card('T', 'a')], dealerUp: 6 },
      chosen: 'hit',
      best: 'stand',
      evDelta: 0.5,
    })
    expect(useStore.getState().mistakeLog[0].evDelta).toBe(0)
  })
})

describe('recordResult — daily streak across days', () => {
  it('extends on consecutive days and resets on a gap', () => {
    recordResult({ category: 'counting', correct: true, now: T0 })
    recordResult({ category: 'counting', correct: true, now: T0 + DAY })
    expect(useStore.getState().dailyStreak).toBe(2)
    recordResult({ category: 'counting', correct: true, now: T0 + 5 * DAY })
    expect(useStore.getState().dailyStreak).toBe(1)
  })
})

describe('recordResult — spaced repetition + achievements', () => {
  it('advances the provided scheduler', () => {
    const sched = makeScheduler()
    recordResult({
      category: 'basicSoft',
      correct: true,
      now: T0,
      scheduler: sched,
      srKey: 'soft18-vs-9',
    })
    expect(sched.getState().items['soft18-vs-9'].reps).toBe(1)
  })

  it('unlocks streak achievements once qualified', () => {
    for (let i = 0; i < 10; i++) {
      recordResult({ category: 'basicSplit', correct: true, now: T0 + i })
    }
    expect(useStore.getState().achievements).toContain('streak-10')
  })
})

describe('checkAchievements', () => {
  it('awards each achievement at most once', () => {
    recordResult({ category: 'basicStiff', correct: true, now: T0 })
    const before = useStore.getState().achievements.length
    const again = checkAchievements()
    expect(again).toEqual([]) // nothing new
    expect(useStore.getState().achievements.length).toBe(before)
  })
})

describe('useTraining hook', () => {
  it('records results and advances its own scheduler', () => {
    let nowValue = T0
    const { result } = renderHook(() =>
      useTraining({ clock: () => nowValue, rng: () => 0 }),
    )
    act(() => {
      result.current.record({ category: 'basicStiff', correct: true })
    })
    expect(useStore.getState().accuracy.basicStiff.total).toBe(1)

    act(() => {
      nowValue = T0 + 1000
      result.current.record({ category: 'basicStiff', correct: true, srKey: 'hard12-vs-4' })
    })
    expect(result.current.scheduler.getState().items['hard12-vs-4'].reps).toBe(1)

    const picked = result.current.pickNext(['hard12-vs-4', 'hard16-vs-10'])
    expect(['hard12-vs-4', 'hard16-vs-10']).toContain(picked)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '../engine/rules'
import type { Card } from '../engine/types'
import {
  exportState,
  importState,
  isValidPersistedState,
  resetPersisted,
  useStore,
} from './index'
import { levelForXp } from './progressSlice'
import type { MistakeEntry } from './statsSlice'

beforeEach(() => {
  resetPersisted()
  useStore.getState().resetGame()
})

const card = (rank: Card['rank'], id: string): Card => ({ rank, suit: 'S', id })

describe('default shape', () => {
  it('initializes every slice with sensible defaults', () => {
    const s = useStore.getState()
    // settings
    expect(s.rules).toEqual(DEFAULT_RULES)
    expect(s.systemId).toBe('hilo')
    expect(s.themeMode).toBe('system')
    expect(s.adviceMode).toBe('mistakes')
    expect(s.tableSeats).toBe(0)
    // bankroll
    expect(s.bankroll).toBe(1000)
    expect(s.unit).toBe(25)
    expect(s.sessionPnl).toBe(0)
    expect(s.betRamp.length).toBeGreaterThan(0)
    // stats
    expect(s.accuracy.basicSplit).toEqual({ correct: 0, total: 0 })
    expect(s.streak).toBe(0)
    expect(s.mistakeLog).toEqual([])
    // progress
    expect(s.xp).toBe(0)
    expect(s.level).toBe(1)
    expect(s.unlockedModules).toContain('basic-strategy')
    // game (transient)
    expect(s.phase).toBe('idle')
    expect(s.shoe).toEqual([])
  })
})

describe('setter round-trip', () => {
  it('applies settings setters and clamps seats', () => {
    const s = useStore.getState()
    s.setSystemId('ko')
    s.setThemeMode('dark')
    s.setTableSeats(9)
    s.patchRules({ decks: 2, soft17: 'H17' })

    const next = useStore.getState()
    expect(next.systemId).toBe('ko')
    expect(next.themeMode).toBe('dark')
    expect(next.tableSeats).toBe(6) // clamped 0..6
    expect(next.rules.decks).toBe(2)
    expect(next.rules.soft17).toBe('H17')
    // untouched rule fields preserved
    expect(next.rules.das).toBe(DEFAULT_RULES.das)
  })

  it('volume defaults to 0.7 and its setter clamps to 0..1', () => {
    expect(useStore.getState().volume).toBe(0.7)
    useStore.getState().setVolume(2)
    expect(useStore.getState().volume).toBe(1)
    useStore.getState().setVolume(-0.5)
    expect(useStore.getState().volume).toBe(0)
    useStore.getState().setVolume(0.4)
    expect(useStore.getState().volume).toBe(0.4)
  })

  it('seenOnboarding defaults to false and round-trips through its setter', () => {
    expect(useStore.getState().seenOnboarding).toBe(false)
    useStore.getState().setSeenOnboarding(true)
    expect(useStore.getState().seenOnboarding).toBe(true)
  })

  it('bet/settle move bankroll and session P/L together', () => {
    const s = useStore.getState()
    s.bet(25)
    expect(useStore.getState().bankroll).toBe(975)
    expect(useStore.getState().sessionPnl).toBe(-25)
    s.settle(50) // even-money win returns 2x stake
    expect(useStore.getState().bankroll).toBe(1025)
    expect(useStore.getState().sessionPnl).toBe(25)
    useStore.getState().resetSession()
    expect(useStore.getState().sessionPnl).toBe(0)
    expect(useStore.getState().bankroll).toBe(1025)
  })
})

describe('recordAnswer accuracy math', () => {
  it('tracks per-category counters and streaks', () => {
    const s = useStore.getState()
    s.recordAnswer('basicSplit', true)
    s.recordAnswer('basicSplit', true)
    s.recordAnswer('basicSplit', false)
    s.recordAnswer('counting', true)

    const next = useStore.getState()
    expect(next.accuracy.basicSplit).toEqual({ correct: 2, total: 3 })
    expect(next.accuracy.counting).toEqual({ correct: 1, total: 1 })
    // streak reset by the wrong answer, then +1 for counting
    expect(next.streak).toBe(1)
    expect(next.bestStreak).toBe(2)
  })
})

describe('progress leveling', () => {
  it('recomputes level from xp', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(150)).toBe(2)
    useStore.getState().addXp(250)
    expect(useStore.getState().xp).toBe(250)
    expect(useStore.getState().level).toBe(3)
  })

  it('extends daily streak only on consecutive days', () => {
    const p = useStore.getState()
    p.markActiveDay('2026-07-11', '2026-07-10')
    expect(useStore.getState().dailyStreak).toBe(1)
    p.markActiveDay('2026-07-12', '2026-07-11')
    expect(useStore.getState().dailyStreak).toBe(2)
    p.markActiveDay('2026-07-12', '2026-07-11') // same day: no change
    expect(useStore.getState().dailyStreak).toBe(2)
    p.markActiveDay('2026-07-20', '2026-07-19') // gap: reset
    expect(useStore.getState().dailyStreak).toBe(1)
  })
})

describe('export/import round-trip', () => {
  it('restores persisted state and validates shape', () => {
    const s = useStore.getState()
    s.setSystemId('zen')
    s.setBankroll(2500)
    s.recordAnswer('deviations', true)
    const mistake: MistakeEntry = {
      id: 'm1',
      category: 'basicStiff',
      playerCards: [card('T', 'a'), card('6', 'b')],
      dealerUp: 10,
      trueCount: -1,
      chosen: 'stand',
      correct: 'hit',
      evDelta: -0.12,
      timestamp: 1_700_000_000_000,
    }
    s.logMistake(mistake)

    const json = exportState()
    expect(isValidPersistedState(JSON.parse(json).state)).toBe(true)

    resetPersisted()
    expect(useStore.getState().systemId).toBe('hilo')
    expect(useStore.getState().bankroll).toBe(1000)

    expect(importState(json)).toBe(true)
    const back = useStore.getState()
    expect(back.systemId).toBe('zen')
    expect(back.bankroll).toBe(2500)
    expect(back.accuracy.deviations).toEqual({ correct: 1, total: 1 })
    expect(back.mistakeLog[0]).toEqual(mistake)
  })

  it('accepts a bare persisted-state object without the envelope', () => {
    useStore.getState().setUnit(50)
    const bare = JSON.stringify(JSON.parse(exportState()).state)
    resetPersisted()
    expect(importState(bare)).toBe(true)
    expect(useStore.getState().unit).toBe(50)
  })

  it('rejects malformed json and bad shapes', () => {
    expect(importState('not json')).toBe(false)
    expect(importState('{"state":{"foo":1}}')).toBe(false)
    expect(importState('null')).toBe(false)
    expect(useStore.getState().systemId).toBe('hilo') // unchanged
  })
})

describe('game slice is transient', () => {
  it('is excluded from the persisted projection', () => {
    useStore.getState().newShoe([card('A', 'x')])
    expect(useStore.getState().shoe.length).toBe(1)
    const persisted = JSON.parse(exportState()).state
    expect('shoe' in persisted).toBe(false)
    expect('phase' in persisted).toBe(false)
  })
})

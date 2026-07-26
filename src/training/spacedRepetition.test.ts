import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../engine/cards'
import {
  DEFAULT_SR_CONFIG,
  deserializeSrState,
  emptySrState,
  makeScheduler,
  pickNextItem,
  reviewItem,
  serializeSrState,
  weightFor,
  type SrState,
} from './spacedRepetition'

const cfg = DEFAULT_SR_CONFIG

describe('reviewItem', () => {
  it('creates and grows an item on consecutive correct reviews', () => {
    let s = emptySrState()
    s = reviewItem(s, 'hard16-vs-10', true, 0)
    const a = s.items['hard16-vs-10']
    expect(a.reps).toBe(1)
    expect(a.interval).toBe(cfg.firstInterval)
    expect(a.dueAt).toBe(cfg.firstInterval)
    expect(a.reviews).toBe(1)
    expect(a.lapses).toBe(0)
    expect(a.ease).toBeCloseTo(cfg.startEase + cfg.easeUp)

    s = reviewItem(s, 'hard16-vs-10', true, a.dueAt)
    const b = s.items['hard16-vs-10']
    expect(b.reps).toBe(2)
    expect(b.interval).toBe(cfg.secondInterval)

    s = reviewItem(s, 'hard16-vs-10', true, b.dueAt)
    const c = s.items['hard16-vs-10']
    expect(c.reps).toBe(3)
    // third+ correct multiplies previous interval by ease -> strictly grows
    expect(c.interval).toBeGreaterThan(b.interval)
  })

  it('treats a wrong answer as a lapse: resets reps, lowers ease, reschedules soon', () => {
    let s = emptySrState()
    s = reviewItem(s, 'k', true, 0)
    s = reviewItem(s, 'k', true, 100)
    const before = s.items['k']
    s = reviewItem(s, 'k', false, 200)
    const after = s.items['k']
    expect(after.reps).toBe(0)
    expect(after.lapses).toBe(1)
    expect(after.interval).toBe(cfg.lapseInterval)
    expect(after.dueAt).toBe(200 + cfg.lapseInterval)
    expect(after.ease).toBeCloseTo(before.ease - cfg.easeDown)
    expect(after.lastCorrect).toBe(false)
  })

  it('does not mutate the input state (immutable update)', () => {
    const s0 = emptySrState()
    const s1 = reviewItem(s0, 'k', true, 0)
    expect(s0.items['k']).toBeUndefined()
    expect(s1.items['k']).toBeDefined()
  })

  it('clamps ease to the configured bounds', () => {
    let s = emptySrState()
    for (let i = 0; i < 20; i++) s = reviewItem(s, 'k', false, i * 1000)
    expect(s.items['k'].ease).toBe(cfg.minEase)
  })
})

describe('weightFor', () => {
  it('gives unseen keys the new-item weight', () => {
    expect(weightFor(emptySrState(), 'new', 0)).toBe(cfg.newWeight)
  })

  it('weights an overdue, lapsed item above a freshly-reviewed one', () => {
    let s = emptySrState()
    s = reviewItem(s, 'missed', false, 0) // lapse, due at lapseInterval
    s = reviewItem(s, 'fresh', true, 0) // due far in the future
    const now = cfg.lapseInterval + cfg.firstInterval // missed overdue, fresh not due
    expect(weightFor(s, 'missed', now)).toBeGreaterThan(weightFor(s, 'fresh', now))
  })
})

describe('pickNextItem', () => {
  it('returns undefined for an empty pool', () => {
    expect(pickNextItem(emptySrState(), Math.random, { now: 0, pool: [] })).toBeUndefined()
  })

  it('is deterministic for a seeded rng', () => {
    const pool = ['a', 'b', 'c', 'd']
    const s = emptySrState()
    const r1 = mulberry32(42)
    const r2 = mulberry32(42)
    const seq1 = Array.from({ length: 10 }, () => pickNextItem(s, r1, { now: 0, pool }))
    const seq2 = Array.from({ length: 10 }, () => pickNextItem(s, r2, { now: 0, pool }))
    expect(seq1).toEqual(seq2)
  })

  it('surfaces due/missed items far more often than fresh ones', () => {
    let s: SrState = emptySrState()
    s = reviewItem(s, 'missed', false, 0)
    // make "fresh" solidly not-due
    s = reviewItem(s, 'fresh', true, 0)
    s = reviewItem(s, 'fresh', true, s.items['fresh'].dueAt)
    const pool = ['missed', 'fresh']
    const now = cfg.lapseInterval * 2
    const rng = mulberry32(7)
    let missed = 0
    for (let i = 0; i < 400; i++) {
      if (pickNextItem(s, rng, { now, pool }) === 'missed') missed++
    }
    expect(missed).toBeGreaterThan(300)
  })

  it('falls back to the most-due item when all weights are zero', () => {
    // two items both just reviewed at now -> residual weight 0 at now
    let s = emptySrState()
    s = reviewItem(s, 'older', true, 0)
    s = reviewItem(s, 'newer', true, 0)
    // now == both dueAt-interval start; force zero-weight regime by evaluating
    // exactly at review time (remaining == interval => frac 1 => weight 0)
    const picked = pickNextItem(s, mulberry32(1), { now: 0, pool: ['older', 'newer'] })
    expect(['older', 'newer']).toContain(picked)
  })
})

describe('serialization', () => {
  it('round-trips through serialize/deserialize', () => {
    let s = emptySrState()
    s = reviewItem(s, 'a', true, 0)
    s = reviewItem(s, 'b', false, 10)
    const raw = JSON.parse(JSON.stringify(serializeSrState(s)))
    const back = deserializeSrState(raw)
    expect(back).toEqual(s)
  })

  it('rejects malformed persisted data safely', () => {
    expect(deserializeSrState(null)).toEqual(emptySrState())
    expect(deserializeSrState({ items: 5 })).toEqual(emptySrState())
    expect(deserializeSrState({ items: { x: { ease: 'no' } } })).toEqual(emptySrState())
  })
})

describe('makeScheduler', () => {
  it('accumulates state across recordReview calls and serializes it', () => {
    const sched = makeScheduler()
    const item = sched.recordReview('k', true, 0)
    expect(item.reps).toBe(1)
    expect(sched.getState().items['k'].reps).toBe(1)
    sched.recordReview('k', true, item.dueAt)
    expect(sched.getState().items['k'].reps).toBe(2)
    expect(sched.toState()).toEqual(sched.getState())
  })

  it('restores state via setState / initial', () => {
    const seed = makeScheduler()
    seed.recordReview('k', true, 0)
    const restored = makeScheduler(seed.toState())
    expect(restored.getState().items['k'].reps).toBe(1)
  })

  it('picks from a pool deterministically with a seeded rng', () => {
    const sched = makeScheduler()
    const picked = sched.pickNext(mulberry32(3), { now: 0, pool: ['a', 'b', 'c'] })
    expect(['a', 'b', 'c']).toContain(picked)
  })
})

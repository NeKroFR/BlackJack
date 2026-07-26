import { describe, expect, it } from 'vitest'
import type { Card, Rank, Suit } from '../../engine/types'
import { HILO, KO } from '../../engine/counting/systems'
import {
  achievedCpm,
  buildPlan,
  cardIntervalMs,
  cardsThrough,
  expectedRunning,
  expectedTrue,
  rampCpm,
  GROUPED_BEATS,
  SINGLE_BEATS,
  TABLE_ROUNDS,
} from './engine'

function card(rank: Rank, suit: Suit = 'S'): Card {
  return { rank, suit, id: `${suit}-${rank}-${Math.random()}` }
}

describe('buildPlan', () => {
  it('single mode: 16 one-card beats, no checkpoints', () => {
    const plan = buildPlan({ mode: 'single', decks: 6, seats: 0, seed: 1 })
    expect(plan.beats).toHaveLength(SINGLE_BEATS)
    expect(plan.totalCards).toBe(SINGLE_BEATS)
    expect(plan.beats.every((b) => b.cards.length === 1)).toBe(true)
    expect(plan.beats.some((b) => b.checkpoint)).toBe(false)
  })

  it('grouped mode: 12 beats of 2 or 3 cards', () => {
    const plan = buildPlan({ mode: 'grouped', decks: 6, seats: 0, seed: 7 })
    expect(plan.beats).toHaveLength(GROUPED_BEATS)
    expect(plan.beats.every((b) => b.cards.length === 2 || b.cards.length === 3)).toBe(true)
    expect(plan.beats.some((b) => b.checkpoint)).toBe(false)
  })

  it('table mode: one round per beat sized by seats, single mid checkpoint', () => {
    const plan = buildPlan({ mode: 'table', decks: 6, seats: 2, seed: 3 })
    expect(plan.beats).toHaveLength(TABLE_ROUNDS)
    // 2 others + hero = 3 players -> 3*2 + 1 dealer up = 7 cards / beat
    expect(plan.beats.every((b) => b.cards.length === 7)).toBe(true)
    expect(plan.beats.filter((b) => b.checkpoint)).toHaveLength(1)
    expect(plan.beats[Math.floor(TABLE_ROUNDS / 2)].checkpoint).toBe(true)
  })

  it('shoe mode: deals to the cut card with two mid-shoe checkpoints', () => {
    const plan = buildPlan({ mode: 'shoe', decks: 1, seats: 0, penetration: 0.5, seed: 9 })
    expect(plan.beats).toHaveLength(26) // floor(52 * 0.5)
    expect(plan.totalCards).toBe(26)
    expect(plan.beats.filter((b) => b.checkpoint)).toHaveLength(2)
  })

  it('is deterministic for a given seed', () => {
    const a = buildPlan({ mode: 'grouped', decks: 2, seats: 0, seed: 42 })
    const b = buildPlan({ mode: 'grouped', decks: 2, seats: 0, seed: 42 })
    expect(a.beats.map((x) => x.cards.map((c) => c.rank))).toEqual(
      b.beats.map((x) => x.cards.map((c) => c.rank)),
    )
  })
})

describe('cardsThrough', () => {
  it('accumulates cards up to and including the given beat', () => {
    const plan = buildPlan({ mode: 'single', decks: 6, seats: 0, seed: 5 })
    expect(cardsThrough(plan.beats, 0)).toHaveLength(1)
    expect(cardsThrough(plan.beats, 3)).toHaveLength(4)
    expect(cardsThrough(plan.beats, plan.beats.length - 1)).toHaveLength(plan.totalCards)
  })
})

describe('expectedRunning', () => {
  it('sums Hi-Lo tags (balanced, IRC 0)', () => {
    // 2,3 -> +1 +1 ; K -> -1 ; total +1
    expect(expectedRunning([card('2'), card('3'), card('K')], HILO, 6)).toBe(1)
  })

  it('folds the IRC into an unbalanced count (KO)', () => {
    // KO IRC for 6 decks = 4 - 24 = -20; two low cards (+1 each) -> -18
    expect(expectedRunning([card('2'), card('3')], KO, 6)).toBe(-20 + 2)
  })
})

describe('expectedTrue', () => {
  it('truncates running-per-deck toward zero', () => {
    // two tens in a single deck: RC -2, ~1 deck remaining -> TC trunc(-2) = -2
    expect(expectedTrue([card('K'), card('Q')], HILO, 1, 'full')).toBe(-2)
  })

  it('scales the running count by decks remaining', () => {
    // +6 running (6 low cards) with 26 of 1 deck seen -> ~0.5 decks left -> +12
    const crafted: Card[] = [
      ...Array.from({ length: 6 }, () => card('5')),
      ...Array.from({ length: 20 }, () => card('7')), // tag 0, pad to 26 seen
    ]
    expect(expectedTrue(crafted, HILO, 1, 'quarter')).toBe(12)
  })
})

describe('pacing + adaptive helpers', () => {
  it('cardIntervalMs is 60000 / cpm', () => {
    expect(cardIntervalMs(60)).toBe(1000)
    expect(cardIntervalMs(120)).toBe(500)
  })

  it('achievedCpm derives cards per minute from elapsed time', () => {
    expect(achievedCpm(60, 60000)).toBe(60)
    expect(achievedCpm(30, 30000)).toBe(60)
    expect(achievedCpm(10, 0)).toBe(0)
  })

  it('rampCpm speeds up only on a flawless round, capped', () => {
    expect(rampCpm(100, true)).toBe(110)
    expect(rampCpm(100, false)).toBe(100)
    expect(rampCpm(290, true, 300)).toBe(300)
  })
})

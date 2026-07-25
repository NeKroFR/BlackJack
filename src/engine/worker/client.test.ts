import { describe, it, expect } from 'vitest'
import { compositionFromDecks } from '../cards'
import { DEFAULT_RULES } from '../rules'
import type { Card } from '../types'
import {
  createEngineClient,
  createInProcessEngineClient,
  handleEngineRequest,
  type EngineRequest,
  type EngineResponse,
} from './client'

function card(rank: Card['rank'], suit: Card['suit'] = 'S'): Card {
  return { rank, suit, id: `${rank}${suit}` }
}

const rules = DEFAULT_RULES
const comp = compositionFromDecks(rules.decks)

describe('handleEngineRequest (pure dispatcher)', () => {
  it('evaluates a hand and returns a Decision', () => {
    const req: EngineRequest = {
      id: 1,
      kind: 'evaluate',
      playerCards: [card('T'), card('6')],
      dealerUpValue: 10,
      comp,
      rules,
    }
    const res = handleEngineRequest(req)
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('expected ok')
    expect(res.id).toBe(1)
    expect(res.kind).toBe('evaluate')
    const decision = res.result as import('../types').Decision
    expect(['stand', 'hit', 'double', 'split', 'surrender']).toContain(decision.best)
    expect(decision.ranked.length).toBeGreaterThan(0)
    expect(typeof decision.explanation).toBe('string')
  })

  it('computes dealer probabilities that sum to ~1', () => {
    const res = handleEngineRequest({ id: 2, kind: 'dealer', upcardValue: 6, comp, rules })
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('expected ok')
    const d = res.result as import('../types').DealerDist
    const sum = d.p17 + d.p18 + d.p19 + d.p20 + d.p21 + d.pBust
    expect(sum).toBeGreaterThan(0.99)
    expect(sum).toBeLessThan(1.01)
    expect(d.pBust).toBeGreaterThan(0.35)
  })

  it('runs a seeded Monte-Carlo simulation', () => {
    const res = handleEngineRequest({
      id: 3,
      kind: 'simulate',
      cfg: {
        rules,
        ramp: [
          { minTrueCount: -99, units: 1 },
          { minTrueCount: 2, units: 4 },
        ],
        unit: 25,
        bankroll: 10000,
        handsPerSession: 100,
        sessions: 50,
        seed: 123,
      },
    })
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('expected ok')
    const sim = res.result as import('../betting').SimResult
    expect(sim.finalBankrolls.length).toBe(50)
    expect(typeof sim.mean).toBe('number')
  })

  it('reports errors as a typed error response instead of throwing', () => {
    // dealerProbabilities on an empty composition drives the engine into a
    // failure path; the dispatcher must catch and report it.
    const bad: EngineRequest = {
      id: 4,
      kind: 'dealer',
      upcardValue: 6,
      comp: new Array(11).fill(0),
      rules,
    }
    const res: EngineResponse = handleEngineRequest(bad)
    // Either a valid response object with the right id — never a throw.
    expect(res.id).toBe(4)
    expect(typeof res.ok).toBe('boolean')
  })
})

describe('in-process engine client', () => {
  it('resolves evaluate/dealer/simulate as promises', async () => {
    const client = createInProcessEngineClient()
    const decision = await client.evaluate([card('A'), card('7')], 6, comp, rules)
    expect(decision.ranked.length).toBeGreaterThan(0)

    const dist = await client.dealer(6, comp, rules)
    expect(dist.pBust).toBeGreaterThan(0.35)

    const sim = await client.simulate({
      rules,
      ramp: [{ minTrueCount: -99, units: 1 }],
      unit: 10,
      bankroll: 5000,
      handsPerSession: 50,
      sessions: 20,
      seed: 7,
    })
    expect(sim.profits.length).toBe(20)
    client.dispose()
  })

  it('keeps concurrent calls independent (matched by id)', async () => {
    const client = createInProcessEngineClient()
    const [d16, d12] = await Promise.all([
      client.evaluate([card('T'), card('6')], 10, comp, rules),
      client.evaluate([card('T'), card('2')], 4, comp, rules),
    ])
    // 16 vs 10 and 12 vs 4 are genuinely different hands: their decisions must
    // not have been crossed over.
    expect(d16.ranked).not.toEqual(d12.ranked)
    client.dispose()
  })
})

describe('createEngineClient (jsdom fallback)', () => {
  it('falls back to the in-process engine when no real module worker exists', async () => {
    // jsdom has no working module worker; createEngineClient must still return a
    // functioning client rather than blocking forever.
    const client = createEngineClient()
    const dist = await client.dealer(6, comp, rules)
    expect(dist.pBust).toBeGreaterThan(0.35)
    client.dispose()
  })
})

import type { Card, Composition, Decision, DealerDist, Rules } from '../types'
import { evaluate, type EvaluateOptions } from '../ev'
import { dealerProbabilities } from '../dealer'
import { simulateSessions, type SimConfig, type SimResult } from '../betting'

// ---- Wire protocol ---------------------------------------------------------
//
// Every call carries a unique `id` so concurrent requests resolve to the right
// promise regardless of worker answer order. Requests are a discriminated
// union on `kind`. Responses echo the `id` and carry either a typed `result`
// (ok) or an `error` string.

export interface EvaluateRequest {
  id: number
  kind: 'evaluate'
  playerCards: Card[]
  dealerUpValue: number
  comp: Composition
  rules: Rules
  opts?: EvaluateOptions
}

export interface DealerRequest {
  id: number
  kind: 'dealer'
  upcardValue: number
  comp: Composition
  rules: Rules
}

export interface SimulateRequest {
  id: number
  kind: 'simulate'
  cfg: SimConfig
}

export type EngineRequest = EvaluateRequest | DealerRequest | SimulateRequest

export type EngineResult<K extends EngineRequest['kind']> = K extends 'evaluate'
  ? Decision
  : K extends 'dealer'
    ? DealerDist
    : SimResult

export interface EngineOkResponse {
  id: number
  ok: true
  kind: EngineRequest['kind']
  result: Decision | DealerDist | SimResult
}

export interface EngineErrResponse {
  id: number
  ok: false
  error: string
}

export type EngineResponse = EngineOkResponse | EngineErrResponse

// ---- Pure dispatcher (shared by worker and in-process fallback) ------------

/**
 * Execute one engine request synchronously in the current thread. Pure: it
 * touches no worker globals, so it powers both the real worker and the
 * in-process fallback (tests, SSR, or browsers without module workers).
 */
export function handleEngineRequest(req: EngineRequest): EngineResponse {
  try {
    switch (req.kind) {
      case 'evaluate': {
        const result = evaluate(req.playerCards, req.dealerUpValue, req.comp, req.rules, req.opts)
        return { id: req.id, ok: true, kind: 'evaluate', result }
      }
      case 'dealer': {
        const result = dealerProbabilities(req.upcardValue, req.comp, req.rules)
        return { id: req.id, ok: true, kind: 'dealer', result }
      }
      case 'simulate': {
        const result = simulateSessions(req.cfg)
        return { id: req.id, ok: true, kind: 'simulate', result }
      }
    }
  } catch (err) {
    return { id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ---- Public client interface -----------------------------------------------

export interface EngineClient {
  evaluate(
    playerCards: Card[],
    dealerUpValue: number,
    comp: Composition,
    rules: Rules,
    opts?: EvaluateOptions,
  ): Promise<Decision>
  dealer(upcardValue: number, comp: Composition, rules: Rules): Promise<DealerDist>
  simulate(cfg: SimConfig): Promise<SimResult>
  /** Terminate the underlying worker (no-op for the in-process client). */
  dispose(): void
}

let nextId = 1
function freshId(): number {
  return nextId++
}

/**
 * In-process client: runs the engine on the calling thread but keeps the exact
 * async surface of the worker client. Use in tests, SSR, or environments
 * without a real module worker.
 */
export function createInProcessEngineClient(): EngineClient {
  function call<T>(req: EngineRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const res = handleEngineRequest(req)
      if (res.ok) resolve(res.result as T)
      else reject(new Error(res.error))
    })
  }
  return {
    evaluate(playerCards, dealerUpValue, comp, rules, opts) {
      return call<Decision>({
        id: freshId(),
        kind: 'evaluate',
        playerCards,
        dealerUpValue,
        comp,
        rules,
        opts,
      })
    },
    dealer(upcardValue, comp, rules) {
      return call<DealerDist>({ id: freshId(), kind: 'dealer', upcardValue, comp, rules })
    },
    simulate(cfg) {
      return call<SimResult>({ id: freshId(), kind: 'simulate', cfg })
    },
    dispose() {
      // nothing to tear down
    },
  }
}

/**
 * Worker-backed client. Posts typed requests to `engine.worker.ts` and matches
 * responses to their originating promise by `id`, so concurrent calls stay
 * independent. Falls back to the in-process engine when the runtime has no
 * `Worker` (jsdom, SSR) or when spawning the worker throws.
 */
export function createEngineClient(): EngineClient {
  if (typeof Worker === 'undefined') {
    return createInProcessEngineClient()
  }

  let worker: Worker
  try {
    worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    return createInProcessEngineClient()
  }

  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

  worker.onmessage = (e: MessageEvent<EngineResponse>) => {
    const res = e.data
    const entry = pending.get(res.id)
    if (!entry) return
    pending.delete(res.id)
    if (res.ok) entry.resolve(res.result)
    else entry.reject(new Error(res.error))
  }

  worker.onerror = (e) => {
    const err = new Error(e.message || 'engine worker error')
    for (const [, entry] of pending) entry.reject(err)
    pending.clear()
  }

  function call<T>(req: EngineRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      pending.set(req.id, { resolve: resolve as (v: unknown) => void, reject })
      worker.postMessage(req)
    })
  }

  return {
    evaluate(playerCards, dealerUpValue, comp, rules, opts) {
      return call<Decision>({
        id: freshId(),
        kind: 'evaluate',
        playerCards,
        dealerUpValue,
        comp,
        rules,
        opts,
      })
    },
    dealer(upcardValue, comp, rules) {
      return call<DealerDist>({ id: freshId(), kind: 'dealer', upcardValue, comp, rules })
    },
    simulate(cfg) {
      return call<SimResult>({ id: freshId(), kind: 'simulate', cfg })
    },
    dispose() {
      for (const [, entry] of pending) entry.reject(new Error('engine client disposed'))
      pending.clear()
      worker.terminate()
    },
  }
}

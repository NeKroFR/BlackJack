// useEngine: the training modes' single door to the EV engine.
//
// Two performance tiers:
//   • evaluate() and dealer() run IN-PROCESS (synchronous). Single-hand advice
//     is cheap and modes want the answer during the same render/keypress, so
//     paying a worker round-trip would only add latency.
//   • simulate() runs the Monte-Carlo betting simulation OFF the main thread via
//     `createEngineClient` (a real module Worker when the runtime has one, with
//     a transparent in-process fallback for jsdom/SSR/older browsers).
//
// The worker client is created lazily on first `simulate` and disposed on
// unmount, so a mode that never simulates never spawns a worker.

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Card, Composition, DealerDist, Decision, Rules } from '../engine/types'
import { evaluate as evaluateInProcess, type EvaluateOptions } from '../engine/ev'
import { dealerProbabilities } from '../engine/dealer'
import { createEngineClient, type EngineClient } from '../engine/worker/client'
import type { SimConfig, SimResult } from '../engine/betting'

export interface EngineApi {
  /** Synchronous, in-process single-hand advice. */
  evaluate(
    playerCards: Card[],
    dealerUpValue: number,
    comp: Composition,
    rules: Rules,
    opts?: EvaluateOptions,
  ): Decision
  /** Synchronous, in-process dealer outcome distribution. */
  dealer(upcardValue: number, comp: Composition, rules: Rules): DealerDist
  /** Monte-Carlo betting simulation, off the main thread. */
  simulate(cfg: SimConfig): Promise<SimResult>
}

/**
 * React hook exposing the engine. Stable identity across renders (memoized).
 * Safe to list in effect/callback dependency arrays.
 */
export function useEngine(): EngineApi {
  const clientRef = useRef<EngineClient | null>(null)

  const getClient = useCallback((): EngineClient => {
    if (!clientRef.current) clientRef.current = createEngineClient()
    return clientRef.current
  }, [])

  useEffect(() => {
    return () => {
      clientRef.current?.dispose()
      clientRef.current = null
    }
  }, [])

  const evaluate = useCallback<EngineApi['evaluate']>(
    (playerCards, dealerUpValue, comp, rules, opts) =>
      evaluateInProcess(playerCards, dealerUpValue, comp, rules, opts),
    [],
  )

  const dealer = useCallback<EngineApi['dealer']>(
    (upcardValue, comp, rules) => dealerProbabilities(upcardValue, comp, rules),
    [],
  )

  const simulate = useCallback<EngineApi['simulate']>((cfg) => getClient().simulate(cfg), [
    getClient,
  ])

  return useMemo(() => ({ evaluate, dealer, simulate }), [evaluate, dealer, simulate])
}

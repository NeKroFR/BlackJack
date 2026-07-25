/**
 * Thin React hook wrapping the shared round state machine ({@link round.ts}).
 *
 * It owns a {@link RoundState} in component state and exposes bound transitions
 * plus the common selectors. The state machine does all the work. This hook is
 * only glue so a component can `const g = useGame({ rules })` and call
 * `g.startRound()`, `g.hit()`, read `g.state`, `g.legalActions`, etc.
 */

import { useCallback, useMemo, useState } from 'react'
import type { Action } from '../engine/types'
import {
  act,
  activeHand,
  createRound,
  dealerUpValue,
  decksRemaining,
  legalActions,
  playDealer,
  recommendation,
  reshuffle,
  startRound,
  takeInsurance,
  trueCountRounded,
  type RoundConfig,
  type RoundState,
} from './round'
import type { TrueCountRounding } from '../store/settingsSlice'

export interface UseGame {
  state: RoundState
  /** Deal a new round (reshuffles first if the cut card was passed). */
  startRound: (bet?: number) => void
  /** Accept / decline insurance during the `insurance` phase. */
  takeInsurance: (take: boolean) => void
  /** Apply an arbitrary hero action to the active hand. */
  act: (action: Action) => void
  hit: () => void
  stand: () => void
  double: () => void
  split: () => void
  surrender: () => void
  /** Play the dealer out and settle. */
  playDealer: () => void
  /** Reshuffle immediately. */
  reshuffle: () => void
  /** Replace the state directly (escape hatch for advanced flows). */
  setState: (next: RoundState) => void

  // Selectors (recomputed each render from the current state).
  legalActions: Action[]
  activeHand: ReturnType<typeof activeHand>
  dealerUpValue: number
  decksRemaining: number
  trueCount: number
  recommendation: ReturnType<typeof recommendation>
}

export function useGame(config: RoundConfig, rounding: TrueCountRounding = 'full'): UseGame {
  // The config only seeds the initial machine. Changing it later does not reset
  // the shoe mid-session (callers remount the hook to apply new rules/system).
  const [state, setState] = useState<RoundState>(() => createRound(config))

  const doStart = useCallback((bet = 1) => setState((s) => startRound(s, bet)), [])
  const doInsurance = useCallback((take: boolean) => setState((s) => takeInsurance(s, take)), [])
  const doAct = useCallback((action: Action) => setState((s) => act(s, action)), [])
  const doDealer = useCallback(() => setState((s) => playDealer(s)), [])
  const doReshuffle = useCallback(() => setState((s) => reshuffle(s)), [])

  return useMemo<UseGame>(
    () => ({
      state,
      startRound: doStart,
      takeInsurance: doInsurance,
      act: doAct,
      hit: () => doAct('hit'),
      stand: () => doAct('stand'),
      double: () => doAct('double'),
      split: () => doAct('split'),
      surrender: () => doAct('surrender'),
      playDealer: doDealer,
      reshuffle: doReshuffle,
      setState,
      legalActions: legalActions(state),
      activeHand: activeHand(state),
      dealerUpValue: dealerUpValue(state),
      decksRemaining: decksRemaining(state),
      trueCount: trueCountRounded(state, rounding),
      recommendation: recommendation(state),
    }),
    [state, rounding, doStart, doInsurance, doAct, doDealer, doReshuffle],
  )
}

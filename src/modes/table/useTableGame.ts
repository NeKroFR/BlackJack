// useTableGame: the live-table controller.
//
// It composes the shared round engine (useGame) with the persistent store
// (bankroll + settings + stats/progress via recordResult) and adds the things
// that make the felt game a *game*: chip betting against table limits and a
// bustable bankroll, an advice layer keyed off the user's advice-mode setting,
// per-decision EV grading, a heat / camouflage meter, paced dealer auto-play at
// the configured dealing speed, penetration/cut-card reshuffles, and periodic
// "what's the count?" checks. The screen stays presentational, all the wiring
// lives here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../../game/useGame'
import {
  activeHand as selectActiveHand,
  dealerUpValue as selectDealerUp,
  recommendation as selectRecommendation,
  type PlayerHand,
  type RoundState,
} from '../../game/round'
import { compositionFromCards, handTotal, isPair } from '../../engine/cards'
import { evaluate } from '../../engine/ev'
import type { Action, CountingSystem, Decision, Rules } from '../../engine/types'
import { useStore } from '../../store'
import type { AdviceMode, StatCategory, TrueCountRounding } from '../../store'
import { recordResult } from '../../training'
import { nextHeat, heatLevel, type HeatLevel } from './heat'

/** How many rounds between "what's the count?" checks. */
const COUNT_CHECK_EVERY = 5
/** Table wager bounds (currency units). Effective max is also capped by bankroll. */
export const TABLE_MIN = 5
export const TABLE_MAX = 5000
/** Chip denominations offered in the bet builder. */
export const CHIP_DENOMS = [5, 25, 100, 500] as const

function clampDelay(cpm: number): number {
  return Math.min(1500, Math.max(150, Math.round(60000 / Math.max(1, cpm))))
}

/** Which accuracy bucket a hand decision falls into. */
function categoryFor(cards: { rank: string }[]): StatCategory {
  if (cards.length === 2 && isPair(cards as never)) return 'basicSplit'
  const { soft } = handTotal(cards as never)
  if (soft) return 'basicSoft'
  return 'basicStiff'
}

/** A graded hero decision, kept for the post-hand feedback panel. */
export interface DecisionRecord {
  handIndex: number
  chosen: Action
  best: Action
  correct: boolean
  chosenEv: number
  bestEv: number
  evDelta: number
  explanation: string
}

/** The current advice to surface, given the advice mode + hint state. */
export interface AdviceView {
  action: Action
  ev: number
  explanation: string
}

export interface CountCheckState {
  open: boolean
  /** The correct running count the moment the check was raised. */
  expected: number
  /** Set once the player submits an answer, before the round is dealt. */
  answered: { correct: boolean; answer: number } | null
}

export interface TableController {
  state: RoundState
  rules: Rules
  system: CountingSystem
  adviceMode: AdviceMode

  // ---- betting ----
  pendingBet: number
  setPendingBet: (n: number) => void
  addChip: (denom: number) => void
  clearBet: () => void
  tableMin: number
  effectiveMax: number
  canDeal: boolean
  /** Out of chips: bankroll can't cover the table minimum. */
  busted: boolean
  rebuy: (amount: number) => void
  requestDeal: () => void

  // ---- insurance ----
  insuranceRecommend: boolean
  canAffordInsurance: boolean
  takeInsurance: (take: boolean) => void

  // ---- player turn ----
  legalActions: Action[]
  /** Actions that are legal but unaffordable (double/split beyond bankroll). */
  unaffordable: Action[]
  activeHand: PlayerHand | null
  doAction: (action: Action) => void
  recommendation: Decision | null
  /** Advice to display now (mode-aware: always, on-demand-after-hint). */
  advice: AdviceView | null
  hintShown: boolean
  showHint: () => void
  /** Set in `mistakes` mode after a suboptimal play, cleared on the next action. */
  mistakeFlag: DecisionRecord | null

  // ---- count (hidden until revealed) ----
  countRevealed: boolean
  toggleCount: () => void
  runningCount: number
  trueCount: number
  usesTrueCount: boolean
  decksRemaining: number
  /** 0..1 fraction of the shoe dealt, cut card sits at `penetration`. */
  shoeProgress: number
  penetration: number

  // ---- heat ----
  heat: number
  heatLevel: HeatLevel

  // ---- post-hand ----
  decisions: DecisionRecord[]
  lastPnl: number | null

  // ---- session ----
  bankroll: number
  /** Stake on the felt (hands + insurance). 0 between rounds. */
  committed: number
  /** Bankroll off the felt: what a double, split or insurance draws on. */
  available: number
  sessionPnl: number
  handsPlayed: number

  // ---- count check ----
  countCheck: CountCheckState
  submitCountCheck: (value: number) => boolean
  continueAfterCheck: () => void
  skipCountCheck: () => void
}

export interface UseTableGameOptions {
  rules: Rules
  systemId: CountingSystem['id']
  seats: number
  seed?: number
  /** Injectable clock (tests). */
  now?: () => number
}

export function useTableGame(opts: UseTableGameOptions): TableController {
  const { rules, systemId, seats } = opts
  const clock = opts.now ?? Date.now

  const adviceMode = useStore((s) => s.adviceMode)
  const dealingSpeed = useStore((s) => s.dealingSpeed)
  const trueCountRounding = useStore((s) => s.trueCountRounding) as TrueCountRounding
  const haptics = useStore((s) => s.haptics)
  const bankroll = useStore((s) => s.bankroll)
  const sessionPnl = useStore((s) => s.sessionPnl)
  const unit = useStore((s) => s.unit)
  const settle = useStore((s) => s.settle)
  const setBankroll = useStore((s) => s.setBankroll)

  const seed = useMemo(() => opts.seed ?? Math.floor(Math.random() * 0xffffffff), [opts.seed])
  const game = useGame({ rules, system: systemId, seats, seed }, trueCountRounding)
  const state = game.state

  const stepDelay = clampDelay(dealingSpeed)

  // ---- local UI state ----
  const effectiveMax = Math.min(TABLE_MAX, Math.max(0, Math.floor(bankroll)))
  const [pendingBet, setPendingBetRaw] = useState(() =>
    Math.min(Math.max(TABLE_MIN, unit), Math.max(TABLE_MIN, Math.floor(bankroll))),
  )
  const [heat, setHeat] = useState(0)
  const [decisions, setDecisions] = useState<DecisionRecord[]>([])
  const [mistakeFlag, setMistakeFlag] = useState<DecisionRecord | null>(null)
  const [hintShown, setHintShown] = useState(false)
  const [countRevealed, setCountRevealed] = useState(false)
  const [handsPlayed, setHandsPlayed] = useState(0)
  const [lastPnl, setLastPnl] = useState<number | null>(null)
  const [roundsSinceCheck, setRoundsSinceCheck] = useState(0)
  const [countCheck, setCountCheck] = useState<CountCheckState>({
    open: false,
    expected: 0,
    answered: null,
  })

  const setPendingBet = useCallback(
    (n: number) => setPendingBetRaw(Math.max(0, Math.min(effectiveMax, Math.round(n)))),
    [effectiveMax],
  )

  // A losing round can leave a bet the bankroll no longer covers, which greys
  // out every chip and Deal at once. Trim it to what is left instead.
  useEffect(() => {
    setPendingBetRaw((b) => Math.min(b, effectiveMax))
  }, [effectiveMax])
  const addChip = useCallback(
    (denom: number) =>
      setPendingBetRaw((b) => Math.min(effectiveMax, Math.max(0, b) + denom)),
    [effectiveMax],
  )
  const clearBet = useCallback(() => setPendingBetRaw(0), [])

  const busted = Math.floor(bankroll) < TABLE_MIN
  const canDeal =
    (state.phase === 'idle' || state.phase === 'settled') &&
    !countCheck.open &&
    pendingBet >= TABLE_MIN &&
    pendingBet <= effectiveMax

  // ---- committed stake / affordability ----
  const committed = useMemo(
    () => state.hero.hands.reduce((a, h) => a + h.bet, 0) + state.hero.insuranceBet,
    [state],
  )
  const canAfford = useCallback((extra: number) => committed + extra <= bankroll, [committed, bankroll])

  // Only the net P/L reaches `bankroll`, and only at settlement, so the raw
  // figure still counts the stake on the felt. This is what is spendable.
  const roundLive = state.phase !== 'idle' && state.phase !== 'settled'
  const available = Math.floor(bankroll - (roundLive ? committed : 0))

  const baseBet = state.hero.baseBet
  const legalActions = game.legalActions
  const unaffordable = useMemo<Action[]>(() => {
    const out: Action[] = []
    if (legalActions.includes('double') && !canAfford(baseBet)) out.push('double')
    if (legalActions.includes('split') && !canAfford(baseBet)) out.push('split')
    return out
  }, [legalActions, canAfford, baseBet])

  // ---- recommendation + advice ----
  const recommendation = game.recommendation
  const advice = useMemo<AdviceView | null>(() => {
    if (state.phase !== 'playerTurn' || !recommendation) return null
    if (adviceMode === 'mistakes') return null
    if (adviceMode === 'onDemand' && !hintShown) return null
    const best = recommendation.ranked[0]
    return { action: recommendation.best, ev: best?.ev ?? 0, explanation: recommendation.explanation }
  }, [state.phase, recommendation, adviceMode, hintShown])

  // ---- insurance recommendation (computed directly, recommendation() is null here) ----
  const insuranceDec = useMemo(() => {
    if (state.phase !== 'insurance') return null
    const hero = state.hero.hands[0]
    if (!hero) return null
    const comp = compositionFromCards(state.shoe)
    return evaluate(hero.cards, selectDealerUp(state), comp, state.rules).insurance ?? null
  }, [state])
  const insuranceRecommend = insuranceDec?.recommend ?? false
  const canAffordInsurance = canAfford(baseBet / 2)

  // ---- refs for effects ----
  const playDealerRef = useRef(game.playDealer)
  playDealerRef.current = game.playDealer
  const appliedResultRef = useRef<RoundState['result'] | null>(null)
  const prevBetRef = useRef(0)
  const reshuffleSeenRef = useRef(false)

  // ---- paced dealer auto-play ----
  useEffect(() => {
    if (state.phase !== 'dealerTurn') return
    const t = setTimeout(() => playDealerRef.current(), stepDelay)
    return () => clearTimeout(t)
  }, [state.phase, stepDelay])

  // ---- settlement: apply net P/L to the bankroll exactly once per round ----
  useEffect(() => {
    if (state.phase !== 'settled' || !state.result) return
    if (appliedResultRef.current === state.result) return
    appliedResultRef.current = state.result
    const pnl = state.result.totalPnl
    settle(pnl)
    setHandsPlayed((n) => n + 1)
    setLastPnl(pnl)
    if (haptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(pnl > 0 ? [12, 40, 12] : pnl < 0 ? 30 : 8)
    }
  }, [state.phase, state.result, settle, haptics])

  // ---- reshuffle notification hook (surfaced by the screen via `state.reshuffled`) ----
  useEffect(() => {
    reshuffleSeenRef.current = state.reshuffled
  }, [state.reshuffled])

  // ---- grading + actions ----
  const gradeAndRecord = useCallback(
    (action: Action, dec: Decision, hand: PlayerHand, handIndex: number): DecisionRecord => {
      // Grade against the best play they could reach: a double the bankroll
      // cannot cover is not one they passed up, so it is not a misplay.
      const reachable = dec.ranked.find((a) => !unaffordable.includes(a.action))
      const best = reachable?.action ?? dec.best
      const bestEv = reachable?.ev ?? dec.ranked[0]?.ev ?? 0
      const chosenEv = dec.ranked.find((a) => a.action === action)?.ev ?? bestEv
      const correct = action === best || Math.abs(chosenEv - bestEv) < 1e-9
      const evDelta = Math.min(0, chosenEv - bestEv)
      const rec: DecisionRecord = {
        handIndex,
        chosen: action,
        best,
        correct,
        chosenEv,
        bestEv,
        evDelta,
        explanation: dec.explanation,
      }
      recordResult({
        category: categoryFor(hand.cards),
        correct,
        chosen: action,
        best,
        evDelta,
        handContext: {
          playerCards: hand.cards,
          dealerUp: selectDealerUp(state),
          trueCount: state.trueCount,
        },
        now: clock(),
      })
      return rec
    },
    [state, clock, unaffordable],
  )

  const doAction = useCallback(
    (action: Action) => {
      if (state.phase !== 'playerTurn') return
      if (unaffordable.includes(action)) return
      const hand = selectActiveHand(state)
      const dec = selectRecommendation(state)
      if (hand && dec) {
        const rec = gradeAndRecord(action, dec, hand, state.hero.activeIndex)
        setDecisions((d) => [...d, rec])
        setMistakeFlag(adviceMode === 'mistakes' && !rec.correct ? rec : null)
      }
      setHintShown(false)
      game.act(action)
    },
    [state, unaffordable, gradeAndRecord, adviceMode, game],
  )

  const takeInsurance = useCallback(
    (take: boolean) => {
      if (state.phase !== 'insurance') return
      if (take && !canAffordInsurance) return
      const correct = take === insuranceRecommend
      const hero = state.hero.hands[0]
      recordResult({
        category: 'deviations',
        correct,
        handContext: hero
          ? { playerCards: hero.cards, dealerUp: selectDealerUp(state), trueCount: state.trueCount }
          : undefined,
        now: clock(),
      })
      game.takeInsurance(take)
    },
    [state, canAffordInsurance, insuranceRecommend, game, clock],
  )

  // ---- deal ----
  const actuallyDeal = useCallback(() => {
    setHeat((h) => nextHeat(h, prevBetRef.current, pendingBet))
    prevBetRef.current = pendingBet
    setDecisions([])
    setMistakeFlag(null)
    setHintShown(false)
    setLastPnl(null)
    setRoundsSinceCheck((n) => n + 1)
    game.startRound(pendingBet)
  }, [pendingBet, game])

  const requestDeal = useCallback(() => {
    if (!canDeal) return
    if (state.dealt > 0 && roundsSinceCheck >= COUNT_CHECK_EVERY) {
      setCountCheck({ open: true, expected: Math.round(state.running), answered: null })
      return
    }
    actuallyDeal()
  }, [canDeal, state.dealt, state.running, roundsSinceCheck, actuallyDeal])

  const submitCountCheck = useCallback(
    (value: number): boolean => {
      const correct = value === countCheck.expected
      recordResult({ category: 'counting', correct, now: clock() })
      setRoundsSinceCheck(0)
      setCountCheck((c) => ({ ...c, answered: { correct, answer: value } }))
      return correct
    },
    [countCheck.expected, clock],
  )

  const continueAfterCheck = useCallback(() => {
    setCountCheck((c) => ({ ...c, open: false, answered: null }))
    actuallyDeal()
  }, [actuallyDeal])

  const skipCountCheck = useCallback(() => {
    setRoundsSinceCheck(0)
    setCountCheck((c) => ({ ...c, open: false, answered: null }))
    actuallyDeal()
  }, [actuallyDeal])

  const rebuy = useCallback(
    (amount: number) => {
      const funded = Math.floor(bankroll) + amount
      setBankroll(funded)
      // Size against the new bankroll: `setPendingBet` clamps to this render's
      // `effectiveMax`, which is still the busted one.
      setPendingBetRaw(Math.min(Math.max(TABLE_MIN, unit), funded))
    },
    [bankroll, unit, setBankroll],
  )

  return {
    state,
    rules,
    system: state.system,
    adviceMode,

    pendingBet,
    setPendingBet,
    addChip,
    clearBet,
    tableMin: TABLE_MIN,
    effectiveMax,
    canDeal,
    busted,
    rebuy,
    requestDeal,

    insuranceRecommend,
    canAffordInsurance,
    takeInsurance,

    legalActions,
    unaffordable,
    activeHand: game.activeHand,
    doAction,
    recommendation,
    advice,
    hintShown,
    showHint: () => setHintShown(true),
    mistakeFlag,

    countRevealed,
    toggleCount: () => setCountRevealed((v) => !v),
    runningCount: Math.round(state.running * 2) / 2,
    trueCount: game.trueCount,
    usesTrueCount: state.system.usesTrueCount,
    decksRemaining: game.decksRemaining,
    shoeProgress: Math.min(1, state.dealt / (rules.decks * 52)),
    penetration: rules.penetration,

    heat,
    heatLevel: heatLevel(heat),

    decisions,
    lastPnl,

    bankroll: Math.floor(bankroll),
    committed: roundLive ? committed : 0,
    available,
    sessionPnl,
    handsPlayed,

    countCheck,
    submitCountCheck,
    continueAfterCheck,
    skipCountCheck,
  }
}

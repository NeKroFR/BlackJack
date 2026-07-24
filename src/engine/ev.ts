import {
  bucket,
  compKey,
  compositionFromDecks,
  handTotal,
  isBlackjack,
  isPair,
  removeFromComposition,
  totalCards,
} from './cards'
import { dealerProbabilities } from './dealer'
import { blackjackMultiplier } from './rules'
import type {
  Action,
  ActionEv,
  Card,
  Composition,
  DealerDist,
  Decision,
  InsuranceDecision,
  Rank,
  Rules,
} from './types'

/**
 * Composition-aware action-EV solver (SPEC §4.2).
 *
 * Given a player hand, the dealer upcard, the remaining shoe composition and the
 * rules, {@link evaluate} computes the expected value (in units of the base bet,
 * roughly [-2, +2]) of every legal action and returns the best one. Reading the
 * actual composition, the SAME code produces full-shoe basic strategy and
 * depleted-shoe count deviations.
 *
 * ## Modelling notes (documented approximations)
 *
 * - The dealer distribution is computed ONCE from the passed composition (which
 *   already excludes every known card) and reused for every stand comparison in
 *   the drawing recursion. Re-removing the player's hit cards from the dealer's
 *   own draws is a second-order effect that does not move published basic-
 *   strategy cells. Skipping it keeps the solver tractable. Peek conditioning is
 *   handled by {@link dealerProbabilities} (finite path) and reproduced here for
 *   the infinite path via the `s6` renormalisation in {@link standEv}.
 * - Splits are modelled as two independent hands drawn from the post-split shoe.
 *   Resplits are followed per-hand down to a depth of `maxSplitHands - 2`. The
 *   deep branches have probability ~(rank density)^k and contribute negligibly,
 *   so the result matches published split strategy without exactly enforcing the
 *   global hand cap.
 */

// ---- Hand arithmetic -------------------------------------------------------

/**
 * Add a card of bucket `b` (1 = Ace) to a running (total, soft) player state,
 * keeping the best non-busting interpretation. Mirrors the dealer's own hand
 * arithmetic: an Ace enters as 11 when it fits, and a soft ace is demoted to 1
 * before the hand is allowed to bust.
 */
function applyCard(
  total: number,
  soft: boolean,
  b: number,
): { total: number; soft: boolean; bust: boolean } {
  let t = total + b
  let s = soft
  if (b === 1 && t + 10 <= 21) {
    t += 10
    s = true
  }
  if (t > 21 && s) {
    t -= 10
    s = false
  }
  if (t > 21) return { total: t, soft: false, bust: true }
  return { total: t, soft: s, bust: false }
}

/**
 * Iterate the possible next cards from composition `c`. In infinite mode the
 * weights are fixed 1/13 rank frequencies and the composition is never depleted.
 * Otherwise weights come from actual counts and each drawn card is removed
 * before recursing.
 */
function forEachDraw(
  c: Composition,
  infinite: boolean,
  fn: (b: number, w: number, nc: Composition) => void,
): void {
  if (infinite) {
    for (let b = 1; b <= 10; b++) fn(b, (b === 10 ? 4 : 1) / 13, c)
    return
  }
  const n = totalCards(c)
  if (n <= 0) return
  for (let b = 1; b <= 10; b++) {
    if (c[b] <= 0) continue
    fn(b, c[b] / n, removeFromComposition(c, b))
  }
}

/**
 * EV of standing on `playerTotal` against a dealer outcome distribution. Win /
 * push / lose pay +1 / 0 / -1.
 *
 * When `peek` is true the dealer has already checked for a natural, so the EV is
 * taken CONDITIONAL on the dealer not having blackjack: the six non-blackjack
 * fields are renormalised by their own sum (which is 1 for the finite peek path,
 * already conditioned by dealer.ts, and `1 - pBlackjack` for the infinite path).
 * When `peek` is false (ENHC) the dealer may still turn a natural, which beats a
 * standing hand outright, so `pBlackjack` is charged as a full loss.
 */
function standEv(playerTotal: number, d: DealerDist, peek: boolean): number {
  let win = d.pBust
  let lose = 0
  const made = [d.p17, d.p18, d.p19, d.p20, d.p21]
  for (let i = 0; i < 5; i++) {
    const pr = made[i]
    if (pr === 0) continue
    const dealerTotal = 17 + i
    if (playerTotal > dealerTotal) win += pr
    else if (playerTotal < dealerTotal) lose += pr
    // equal totals push and contribute nothing
  }
  if (peek) {
    const s6 = d.p17 + d.p18 + d.p19 + d.p20 + d.p21 + d.pBust
    return s6 > 0 ? (win - lose) / s6 : 0
  }
  return win - lose - d.pBlackjack
}

/** Whether a two-card total may be doubled under the rules' double restriction. */
function canDoubleTotal(t: number, soft: boolean, rules: Rules): boolean {
  switch (rules.double) {
    case 'any2':
      return true
    case '9-11':
      return !soft && t >= 9 && t <= 11
    case '10-11':
      return !soft && t >= 10 && t <= 11
  }
}

// ---- Explanation -----------------------------------------------------------

function actionLabel(a: Action): string {
  switch (a) {
    case 'stand':
      return 'Stand'
    case 'hit':
      return 'Hit'
    case 'double':
      return 'Double'
    case 'split':
      return 'Split'
    case 'surrender':
      return 'Surrender'
  }
}

function fmtEv(x: number): string {
  const r = x.toFixed(2)
  return r === '-0.00' ? '0.00' : r
}

function upcardLabel(up: number): string {
  return up === 1 ? 'A' : String(up)
}

function buildExplanation(ranked: ActionEv[], up: number, d: DealerDist): string {
  const top = ranked[0]
  const bustPct = Math.round(d.pBust * 100)
  const tail = `dealer shows ${upcardLabel(up)} and busts ${bustPct}% of the time.`
  if (ranked.length < 2) {
    return `${actionLabel(top.action)} (${fmtEv(top.ev)}) is the only option: ${tail}`
  }
  const second = ranked[1]
  return `${actionLabel(top.action)} (${fmtEv(top.ev)}) beats ${actionLabel(
    second.action,
  )} (${fmtEv(second.ev)}): ${tail}`
}

// ---- Core solver -----------------------------------------------------------

export interface EvaluateOptions {
  canDouble?: boolean
  canSplit?: boolean
  canSurrender?: boolean
  fromSplit?: boolean
}

/**
 * Expected value of every legal action for a player hand, and the best one.
 *
 * @param playerCards the player's current cards.
 * @param dealerUpValue dealer upcard bucket, 1..10 (1 = Ace).
 * @param comp remaining composition AFTER removing all known cards (the player's
 *   cards and the dealer upcard).
 * @param rules table rules.
 * @param opts per-hand legality overrides. `fromSplit` marks a post-split hand
 *   (no surrender, double requires DAS, natural 21 pays even money).
 */
export function evaluate(
  playerCards: Card[],
  dealerUpValue: number,
  comp: Composition,
  rules: Rules,
  opts: EvaluateOptions = {},
): Decision {
  return evaluateInternal(playerCards, dealerUpValue, comp, rules, opts, false)
}

function evaluateInternal(
  playerCards: Card[],
  dealerUpValue: number,
  comp: Composition,
  rules: Rules,
  opts: EvaluateOptions,
  infinite: boolean,
): Decision {
  const { total, soft } = handTotal(playerCards)
  const numCards = playerCards.length
  const fromSplit = opts.fromSplit === true
  const peek = rules.dealerPeek

  const dealerDist = dealerProbabilities(
    dealerUpValue,
    comp,
    rules,
    infinite ? { infinite: true } : {},
  )

  // Memoised drawing recursion. dealerDist is fixed for this call, so the state
  // is fully described by (total, soft, composition).
  const hitMemo = new Map<string, number>()

  function bestDrawValue(t: number, s: boolean, c: Composition): number {
    const st = standEv(t, dealerDist, peek)
    if (t >= 21) return st // never draw to a 21
    return Math.max(st, hitValue(t, s, c))
  }

  function hitValue(t: number, s: boolean, c: Composition): number {
    const key = `${t}|${s ? 1 : 0}|${infinite ? 'inf' : compKey(c)}`
    const cached = hitMemo.get(key)
    if (cached !== undefined) return cached
    let ev = 0
    forEachDraw(c, infinite, (b, w, nc) => {
      const nxt = applyCard(t, s, b)
      if (nxt.bust) ev += w * -1
      else ev += w * bestDrawValue(nxt.total, nxt.soft, nc)
    })
    hitMemo.set(key, ev)
    return ev
  }

  function doubleValue(t: number, s: boolean, c: Composition): number {
    let ev = 0
    forEachDraw(c, infinite, (b, w) => {
      const nxt = applyCard(t, s, b)
      if (nxt.bust) ev += w * -1
      else ev += w * standEv(nxt.total, dealerDist, peek)
    })
    return 2 * ev
  }

  function splitValue(v: number): number {
    const isAces = v === 1
    const resplitAllowed = isAces ? rules.resplitAces : true
    const depth = resplitAllowed ? Math.max(0, rules.maxSplitHands - 2) : 0
    const acesOneCard = isAces && !rules.hitSplitAces
    const startTotal = isAces ? 11 : v
    const startSoft = isAces

    const completeSplitHand = (second: number, c: Composition): number => {
      const h = applyCard(startTotal, startSoft, second) // a two-card hand never busts
      if (acesOneCard) return standEv(h.total, dealerDist, peek)
      let best = standEv(h.total, dealerDist, peek)
      const hit = hitValue(h.total, h.soft, c)
      if (hit > best) best = hit
      if (rules.das && canDoubleTotal(h.total, h.soft, rules)) {
        const dbl = doubleValue(h.total, h.soft, c)
        if (dbl > best) best = dbl
      }
      return best
    }

    const splitHandEV = (c: Composition, d: number): number => {
      let ev = 0
      forEachDraw(c, infinite, (b, w, nc) => {
        if (b === v && d > 0) ev += w * 2 * splitHandEV(nc, d - 1)
        else ev += w * completeSplitHand(b, nc)
      })
      return ev
    }

    return 2 * splitHandEV(comp, depth)
  }

  // ---- Assemble the legal actions. -----------------------------------------
  const naturalBlackjack = isBlackjack(playerCards) && !fromSplit
  const actions: ActionEv[] = []

  const standValue = naturalBlackjack
    ? blackjackMultiplier(rules) * (1 - dealerDist.pBlackjack)
    : standEv(total, dealerDist, peek)
  actions.push({ action: 'stand', ev: standValue })

  if (!naturalBlackjack) {
    actions.push({ action: 'hit', ev: hitValue(total, soft, comp) })
  }

  const twoCard = numCards === 2
  if (
    opts.canDouble !== false &&
    twoCard &&
    !naturalBlackjack &&
    (!fromSplit || rules.das) &&
    canDoubleTotal(total, soft, rules)
  ) {
    actions.push({ action: 'double', ev: doubleValue(total, soft, comp) })
  }

  if (
    opts.canSplit !== false &&
    twoCard &&
    !naturalBlackjack &&
    isPair(playerCards) &&
    rules.maxSplitHands >= 2
  ) {
    actions.push({ action: 'split', ev: splitValue(bucket(playerCards[0].rank)) })
  }

  if (
    opts.canSurrender !== false &&
    rules.surrender !== 'none' &&
    twoCard &&
    !fromSplit &&
    !naturalBlackjack
  ) {
    actions.push({ action: 'surrender', ev: -0.5 })
  }

  const ranked = actions.slice().sort((a, b) => b.ev - a.ev)

  let insurance: InsuranceDecision | undefined
  if (rules.insurance && dealerUpValue === 1) {
    const remaining = totalCards(comp)
    const pTen = infinite ? 4 / 13 : remaining > 0 ? comp[10] / remaining : 0
    // Insurance is a half-unit side bet paying 2:1 on a dealer ten in the hole.
    const takeEv = 1.5 * pTen - 0.5
    insurance = { takeEv, declineEv: 0, recommend: takeEv > 0 }
  }

  return {
    best: ranked[0].action,
    ranked,
    insurance,
    explanation: buildExplanation(ranked, dealerUpValue, dealerDist),
  }
}

// ---- Basic-strategy chart generator ----------------------------------------

/** One action per cell. Outer key = player total (or pair bucket), inner key = dealer upcard 1..10. */
export type ChartGrid = Record<number, Record<number, Action>>

export interface StrategyChart {
  /** Hard totals 5..21. */
  hard: ChartGrid
  /** Soft totals 13..21 (an Ace plus one other card). */
  soft: ChartGrid
  /** Pairs keyed by bucket 1..10 (1 = Aces, 10 = tens). */
  pairs: ChartGrid
}

/** Dealer upcards in chart column order, Ace last (bucket 1). */
const CHART_UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]

function mkCard(value: number): Card {
  const rank: Rank = value === 1 ? 'A' : value === 10 ? 'T' : (String(value) as Rank)
  return { rank, suit: 'S', id: `chart-${value}` }
}

/**
 * A representative non-pair hard hand for each total 5..21. Stiff totals
 * (12..16) use their MODAL composition `ten + (total - 10)` (the single most
 * likely way to hold that total) so the razor-thin surrender/stand/hit cells
 * against a ten resolve the way the canonical total-dependent chart does (e.g.
 * 15 v 10 and 16 v 10 surrender). Low totals use two mid cards to stay off the
 * pair and soft rows.
 */
const HARD_REP: Record<number, number[]> = {
  5: [2, 3],
  6: [2, 4],
  7: [3, 4],
  8: [3, 5],
  9: [4, 5],
  10: [4, 6],
  11: [5, 6],
  12: [10, 2],
  13: [10, 3],
  14: [10, 4],
  15: [10, 5],
  16: [10, 6],
  17: [10, 7],
  18: [10, 8],
  19: [10, 9],
  20: [10, 6, 4],
  21: [10, 7, 4],
}

/**
 * Generate the rule-aware basic-strategy chart at fresh-shoe composition for the
 * rules' deck count. Each cell is the best action {@link evaluate} finds for a
 * representative hand versus that upcard, computed with full card removal so the
 * borderline cells match the canonical finite-deck chart (e.g. A,2 v 5 doubles,
 * A,4 v 4 doubles). Runs the exact solver, not the infinite fast path.
 */
export function basicStrategyChart(rules: Rules): StrategyChart {
  const cell = (values: number[], up: number): Action => {
    let comp = compositionFromDecks(rules.decks)
    for (const v of values) comp = removeFromComposition(comp, v)
    comp = removeFromComposition(comp, up)
    return evaluateInternal(
      values.map(mkCard),
      up,
      comp,
      rules,
      {},
      false,
    ).best
  }

  const hard: ChartGrid = {}
  for (let t = 5; t <= 21; t++) {
    hard[t] = {}
    for (const up of CHART_UPCARDS) hard[t][up] = cell(HARD_REP[t], up)
  }

  const soft: ChartGrid = {}
  for (let t = 13; t <= 21; t++) {
    soft[t] = {}
    const other = t - 11 // 2..10
    for (const up of CHART_UPCARDS) soft[t][up] = cell([1, other], up)
  }

  const pairs: ChartGrid = {}
  for (let v = 1; v <= 10; v++) {
    pairs[v] = {}
    for (const up of CHART_UPCARDS) pairs[v][up] = cell([v, v], up)
  }

  return { hard, soft, pairs }
}

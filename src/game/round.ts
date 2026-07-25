/**
 * Shared blackjack ROUND ENGINE (SPEC §10).
 *
 * A pure, UI-agnostic state machine that both the live Table game and the
 * counting drills reuse. It owns a shoe (with penetration / cut-card and
 * auto-reshuffle), deals a round to a hero seat + N bot seats + the dealer,
 * tracks the running/true count of every EXPOSED card for the active counting
 * system, applies the hero's actions honouring the Rules, auto-plays the bot
 * seats and the dealer, and settles payouts (win/lose/push, blackjack,
 * insurance, surrender).
 *
 * ## Purity & reproducibility
 *
 * Every transition takes a state and returns a NEW state. It never mutates its
 * argument (it clones the mutable parts first). The one piece of carried
 * randomness is the shoe shuffle: the RNG closure lives on the state and is only
 * consumed at (re)shuffle time. Dealing and drawing are pure array operations
 * off the pre-shuffled shoe. Seed the round via {@link RoundConfig.seed} and the
 * whole game, shuffles included, is reproducible.
 *
 * ## Turn order (documented model)
 *
 * deal → (insurance?) → dealer peek → bot seats auto-play → hero turn →
 * dealer turn → settle. The hero effectively sits at the last seat: every bot's
 * cards are already on the table (and counted) before the hero decides, which is
 * the realistic counting scenario. Bots play a fast total-based basic strategy
 * (hit / stand / double, no split or surrender), enough to consume cards
 * realistically without paying the full solver cost on every bot decision.
 */

import {
  buildShoe,
  bucket,
  compositionFromCards,
  handTotal,
  isBlackjack,
  isPair,
  mulberry32,
  shuffle,
  type Rng,
} from '../engine/cards'
import {
  decksRemaining as decksRemainingCount,
  trueCount as trueCountOf,
} from '../engine/counting'
import { HILO, getSystem } from '../engine/counting/systems'
import { evaluate } from '../engine/ev'
import { blackjackMultiplier } from '../engine/rules'
import type { Action, Card, CountingSystem, Decision, Rules } from '../engine/types'
import type { TrueCountRounding } from '../store/settingsSlice'

// ---- Public types ----------------------------------------------------------

export type RoundPhase =
  /** No round in progress. Ready to deal. */
  | 'idle'
  /** Dealer shows an Ace. The hero must accept or decline insurance. */
  | 'insurance'
  /** The hero is acting on their hand(s). */
  | 'playerTurn'
  /** All hero hands are resolved. The dealer must play out. */
  | 'dealerTurn'
  /** The round is over. {@link RoundState.result} holds the payouts. */
  | 'settled'

/** One player hand (the hero may hold several after splitting). */
export interface PlayerHand {
  cards: Card[]
  /** Current total stake on this hand (grows by the base bet on a double). */
  bet: number
  /** Finished: stood, busted, doubled, surrendered, or blackjack. */
  done: boolean
  doubled: boolean
  surrendered: boolean
  /** This hand originated from a split (no natural blackjack, DAS-gated double). */
  fromSplit: boolean
  /** This hand came from splitting a pair of aces. */
  splitAces: boolean
}

export interface DealerSeat {
  /** `[upcard, holeCard]`, then any draws. The hole is dealt face-down. */
  cards: Card[]
  /** Whether the hole card has been turned up (and therefore counted). */
  holeRevealed: boolean
}

export interface HeroSeat {
  hands: PlayerHand[]
  activeIndex: number
  baseBet: number
  /** Insurance side-bet stake (0 when declined / not offered). */
  insuranceBet: number
}

export interface OtherSeat {
  hand: PlayerHand
}

export type HandResult = 'win' | 'lose' | 'push' | 'blackjack' | 'surrender'

export interface HandOutcome {
  index: number
  result: HandResult
  /** Profit/loss in bet units (already net of the stake). */
  pnl: number
  total: number
  bust: boolean
}

export interface RoundResult {
  hands: HandOutcome[]
  insurance: 'none' | 'win' | 'lose'
  insurancePnl: number
  dealerTotal: number
  dealerBust: boolean
  dealerBlackjack: boolean
  /** Net hero profit/loss for the round (all hands + insurance), in bet units. */
  totalPnl: number
}

export interface RoundConfig {
  rules: Rules
  /** Counting system to track. Defaults to Hi-Lo. */
  system?: CountingSystem | CountingSystem['id']
  /** Number of OTHER (bot) seats, 0..6. Defaults to 0. */
  seats?: number
  /** Seed for a reproducible shuffle (ignored if `rng` is supplied). */
  seed?: number
  /** Explicit RNG (overrides `seed`). */
  rng?: Rng
}

export interface RoundState {
  rules: Rules
  system: CountingSystem
  seats: number
  /** RNG consumed only at (re)shuffle. Carried for reproducibility. */
  rng: Rng
  /** Cards dealt (removed from the shoe) count at which we reshuffle after the round. */
  cutCard: number

  phase: RoundPhase
  /** Undealt cards. Dealing draws from the front. */
  shoe: Card[]
  /** Cards removed from the shoe since the last shuffle (drives penetration + true count). */
  dealt: number
  /** Every EXPOSED card since the last shuffle (drives the running count). */
  seen: Card[]
  /** Running count of exposed cards, including the system's initial running count. */
  running: number
  /** True count = running / decks remaining (meaningful for balanced systems). */
  trueCount: number

  dealer: DealerSeat
  hero: HeroSeat
  others: OtherSeat[]

  /** Set once the cut card is passed. The next {@link startRound} reshuffles. */
  needsShuffle: boolean
  /** True on the state returned by a {@link startRound} that reshuffled first. */
  reshuffled: boolean

  result: RoundResult | null
}

// ---- Internal helpers ------------------------------------------------------

function resolveSystem(s?: CountingSystem | CountingSystem['id']): CountingSystem {
  if (!s) return HILO
  return typeof s === 'string' ? getSystem(s) : s
}

function mkHand(bet: number): PlayerHand {
  return {
    cards: [],
    bet,
    done: false,
    doubled: false,
    surrendered: false,
    fromSplit: false,
    splitAces: false,
  }
}

function cloneHand(h: PlayerHand): PlayerHand {
  return { ...h, cards: h.cards.slice() }
}

function cloneState(s: RoundState): RoundState {
  return {
    ...s,
    shoe: s.shoe.slice(),
    seen: s.seen.slice(),
    dealer: { ...s.dealer, cards: s.dealer.cards.slice() },
    hero: { ...s.hero, hands: s.hero.hands.map(cloneHand) },
    others: s.others.map((o) => ({ hand: cloneHand(o.hand) })),
    result: s.result ? { ...s.result, hands: s.result.hands.slice() } : null,
  }
}

function recomputeTrue(s: RoundState): void {
  s.trueCount = trueCountOf(s.running, decksRemainingCount(s.dealt, s.rules.decks))
}

/** Draw the front card face-up: remove from shoe, count it as exposed. */
function takeExposed(s: RoundState): Card {
  const c = s.shoe.shift()
  if (!c) throw new Error('shoe exhausted')
  s.dealt += 1
  s.seen.push(c)
  s.running += s.system.tags[bucket(c.rank)]
  return c
}

/** Draw the front card face-down: removed from the shoe but NOT yet counted. */
function takeHidden(s: RoundState): Card {
  const c = s.shoe.shift()
  if (!c) throw new Error('shoe exhausted')
  s.dealt += 1
  return c
}

function drawTo(s: RoundState, hand: PlayerHand): void {
  hand.cards.push(takeExposed(s))
}

function revealHole(s: RoundState): void {
  if (s.dealer.holeRevealed) return
  const hole = s.dealer.cards[1]
  if (hole) {
    s.seen.push(hole)
    s.running += s.system.tags[bucket(hole.rank)]
  }
  s.dealer.holeRevealed = true
  recomputeTrue(s)
}

function minCardsToDeal(s: RoundState): number {
  // Two cards each to hero + bots + dealer, with a comfortable buffer for hits.
  return (s.seats + 2) * 2 + 12
}

function reshuffleInto(s: RoundState): void {
  s.shoe = shuffle(buildShoe(s.rules.decks), s.rng)
  s.dealt = 0
  s.seen = []
  s.running = s.system.runningCountStart(s.rules.decks)
  s.needsShuffle = false
  s.reshuffled = true
  recomputeTrue(s)
}

function dealerUpBucket(s: RoundState): number {
  return bucket(s.dealer.cards[0].rank)
}

// ---- Bot basic strategy (fast, total-based) --------------------------------

function botCanDouble(total: number, soft: boolean, rules: Rules): boolean {
  switch (rules.double) {
    case 'any2':
      return true
    case '9-11':
      return !soft && total >= 9 && total <= 11
    case '10-11':
      return !soft && total >= 10 && total <= 11
  }
}

/** A bot's move: hit / stand / double (never split or surrender). `up` is 1..10. */
function botAction(cards: Card[], up: number, rules: Rules): Action {
  const { total, soft } = handTotal(cards)
  const two = cards.length === 2
  const canDbl = two && botCanDouble(total, soft, rules)
  const dbl = (cond: boolean): Action => (cond && canDbl ? 'double' : 'hit')

  if (soft) {
    if (total >= 19) return 'stand'
    if (total === 18) {
      if (up >= 3 && up <= 6) return canDbl ? 'double' : 'stand'
      if (up === 2 || up === 7 || up === 8) return 'stand'
      return 'hit'
    }
    if (total === 17) return dbl(up >= 3 && up <= 6)
    if (total === 15 || total === 16) return dbl(up >= 4 && up <= 6)
    if (total === 13 || total === 14) return dbl(up >= 5 && up <= 6)
    return 'hit'
  }
  if (total >= 17) return 'stand'
  if (total >= 13) return up >= 2 && up <= 6 ? 'stand' : 'hit'
  if (total === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit'
  if (total === 11) return dbl(up >= 2 && up <= 10) // hit vs Ace (up === 1)
  if (total === 10) return dbl(up >= 2 && up <= 9)
  if (total === 9) return dbl(up >= 3 && up <= 6)
  return 'hit'
}

function autoPlayOthers(s: RoundState): void {
  const up = dealerUpBucket(s)
  for (const seat of s.others) {
    const h = seat.hand
    let guard = 0
    while (!h.done && guard++ < 24) {
      if (isBlackjack(h.cards)) {
        h.done = true
        break
      }
      const { total } = handTotal(h.cards)
      if (total >= 21) {
        h.done = true
        break
      }
      const a = botAction(h.cards, up, s.rules)
      if (a === 'stand') {
        h.done = true
        break
      }
      if (a === 'double') {
        h.bet += h.bet
        h.doubled = true
        drawTo(s, h)
        h.done = true
        break
      }
      drawTo(s, h)
      if (handTotal(h.cards).total > 21) {
        h.done = true
        break
      }
    }
  }
}

// ---- Round flow ------------------------------------------------------------

/** Move the hero's active index to the first unfinished hand, else the dealer's turn. */
function advanceActive(s: RoundState): void {
  const i = s.hero.hands.findIndex((h) => !h.done)
  if (i === -1) {
    s.hero.activeIndex = s.hero.hands.length - 1
    s.phase = 'dealerTurn'
  } else {
    s.hero.activeIndex = i
  }
}

function beginHeroTurn(s: RoundState): void {
  autoPlayOthers(s)
  s.phase = 'playerTurn'
  s.hero.activeIndex = 0
  // A hero natural stands automatically.
  const hand = s.hero.hands[0]
  if (isBlackjack(hand.cards)) hand.done = true
  advanceActive(s)
  recomputeTrue(s)
}

/** Dealer peek (US hole-card game). Settles immediately on a dealer natural. */
function resolvePeekAndProceed(s: RoundState): void {
  const up = dealerUpBucket(s)
  if (s.rules.dealerPeek && (up === 1 || up === 10) && isBlackjack(s.dealer.cards)) {
    revealHole(s)
    settleRound(s)
    return
  }
  beginHeroTurn(s)
}

function postDeal(s: RoundState): void {
  const up = dealerUpBucket(s)
  if (s.rules.insurance && up === 1) {
    s.phase = 'insurance'
    recomputeTrue(s)
    return
  }
  resolvePeekAndProceed(s)
}

// ---- Settlement ------------------------------------------------------------

function settleRound(s: RoundState): void {
  const dealer = s.dealer.cards
  const dealerTotal = handTotal(dealer).total
  const dealerBust = dealerTotal > 21
  const dealerBlackjack = isBlackjack(dealer)
  const bjMult = blackjackMultiplier(s.rules)

  const hands: HandOutcome[] = s.hero.hands.map((h, index) => {
    const { total } = handTotal(h.cards)
    const bust = total > 21
    let result: HandResult
    let pnl: number

    if (h.surrendered) {
      result = 'surrender'
      pnl = -h.bet / 2
    } else if (isBlackjack(h.cards) && !h.fromSplit) {
      if (dealerBlackjack) {
        result = 'push'
        pnl = 0
      } else {
        result = 'blackjack'
        pnl = bjMult * h.bet
      }
    } else if (bust) {
      result = 'lose'
      pnl = -h.bet
    } else if (dealerBlackjack) {
      result = 'lose'
      pnl = -h.bet
    } else if (dealerBust) {
      result = 'win'
      pnl = h.bet
    } else if (total > dealerTotal) {
      result = 'win'
      pnl = h.bet
    } else if (total < dealerTotal) {
      result = 'lose'
      pnl = -h.bet
    } else {
      result = 'push'
      pnl = 0
    }
    return { index, result, pnl, total, bust }
  })

  let insurance: RoundResult['insurance'] = 'none'
  let insurancePnl = 0
  if (s.hero.insuranceBet > 0) {
    if (dealerBlackjack) {
      insurance = 'win'
      insurancePnl = 2 * s.hero.insuranceBet
    } else {
      insurance = 'lose'
      insurancePnl = -s.hero.insuranceBet
    }
  }

  const totalPnl = hands.reduce((a, h) => a + h.pnl, 0) + insurancePnl

  s.result = {
    hands,
    insurance,
    insurancePnl,
    dealerTotal,
    dealerBust,
    dealerBlackjack,
    totalPnl,
  }
  s.phase = 'settled'
  if (s.dealt >= s.cutCard) s.needsShuffle = true
  recomputeTrue(s)
}

// ---- Construction ----------------------------------------------------------

export function createRound(cfg: RoundConfig): RoundState {
  const system = resolveSystem(cfg.system)
  const rng = cfg.rng ?? mulberry32(cfg.seed ?? 0x9e3779b9)
  const decks = cfg.rules.decks
  const total = decks * 52
  const s: RoundState = {
    rules: cfg.rules,
    system,
    seats: Math.max(0, Math.min(6, cfg.seats ?? 0)),
    rng,
    cutCard: Math.floor(total * cfg.rules.penetration),
    phase: 'idle',
    shoe: [],
    dealt: 0,
    seen: [],
    running: system.runningCountStart(decks),
    trueCount: 0,
    dealer: { cards: [], holeRevealed: false },
    hero: { hands: [], activeIndex: 0, baseBet: 0, insuranceBet: 0 },
    others: [],
    needsShuffle: true, // force a shuffle on the first deal
    reshuffled: false,
    result: null,
  }
  return s
}

// ---- Transitions -----------------------------------------------------------

/**
 * Deal a fresh round. Reshuffles first when the cut card was passed (or the shoe
 * is too short to deal safely). `bet` is the hero's per-hand base stake.
 */
export function startRound(state: RoundState, bet = 1): RoundState {
  const s = cloneState(state)
  s.reshuffled = false
  s.result = null
  if (s.needsShuffle || s.shoe.length < minCardsToDeal(s)) reshuffleInto(s)

  s.dealer = { cards: [], holeRevealed: false }
  s.hero = { hands: [mkHand(bet)], activeIndex: 0, baseBet: bet, insuranceBet: 0 }
  s.others = Array.from({ length: s.seats }, () => ({ hand: mkHand(1) }))

  // Round-robin deal: one card to each seat then the dealer up, then a second
  // card to each seat and the dealer hole (face-down, uncounted until revealed).
  for (const seat of s.others) drawTo(s, seat.hand)
  drawTo(s, s.hero.hands[0])
  s.dealer.cards.push(takeExposed(s))

  for (const seat of s.others) drawTo(s, seat.hand)
  drawTo(s, s.hero.hands[0])
  s.dealer.cards.push(takeHidden(s))

  postDeal(s)
  return s
}

/** Accept or decline insurance (only valid in the `insurance` phase). */
export function takeInsurance(state: RoundState, take: boolean): RoundState {
  if (state.phase !== 'insurance') return state
  const s = cloneState(state)
  s.hero.insuranceBet = take ? s.hero.baseBet / 2 : 0
  resolvePeekAndProceed(s)
  return s
}

/** Apply a hero action to the active hand. Ignored outside the `playerTurn` phase. */
export function act(state: RoundState, action: Action): RoundState {
  if (state.phase !== 'playerTurn') return state
  const legal = legalActions(state)
  if (!legal.includes(action)) return state

  const s = cloneState(state)
  const h = s.hero.hands[s.hero.activeIndex]
  const base = s.hero.baseBet

  switch (action) {
    case 'stand':
      h.done = true
      break
    case 'hit':
      drawTo(s, h)
      if (handTotal(h.cards).total >= 21) h.done = true
      break
    case 'double':
      h.bet += base
      h.doubled = true
      drawTo(s, h)
      h.done = true
      break
    case 'surrender':
      h.surrendered = true
      h.done = true
      break
    case 'split':
      doSplit(s)
      break
  }

  advanceActive(s)
  recomputeTrue(s)
  return s
}

function doSplit(s: RoundState): void {
  const idx = s.hero.activeIndex
  const h = s.hero.hands[idx]
  const [c1, c2] = h.cards
  const isAces = bucket(c1.rank) === 1

  h.cards = [c1]
  h.fromSplit = true
  h.splitAces = isAces
  const h2 = mkHand(s.hero.baseBet)
  h2.cards = [c2]
  h2.fromSplit = true
  h2.splitAces = isAces
  s.hero.hands.splice(idx + 1, 0, h2)

  drawTo(s, h)
  drawTo(s, h2)

  const finalize = (hand: PlayerHand): void => {
    if (isAces && !s.rules.hitSplitAces) {
      // Split aces get exactly one card, unless the draw is another Ace and the
      // rules allow resplitting aces (then the hand stays live to be split).
      const canResplit =
        s.rules.resplitAces &&
        bucket(hand.cards[hand.cards.length - 1].rank) === 1 &&
        s.hero.hands.length < s.rules.maxSplitHands
      if (!canResplit) hand.done = true
    } else if (handTotal(hand.cards).total >= 21) {
      hand.done = true
    }
  }
  finalize(h)
  finalize(h2)
}

/** Legal hero actions for the active hand (empty outside the `playerTurn` phase). */
export function legalActions(state: RoundState): Action[] {
  if (state.phase !== 'playerTurn') return []
  const s = state
  const h = s.hero.hands[s.hero.activeIndex]
  if (!h || h.done) return []
  const rules = s.rules
  const { total, soft } = handTotal(h.cards)
  const two = h.cards.length === 2
  const out: Action[] = ['stand']

  if (total < 21) out.push('hit')

  const dasOk = !h.fromSplit || rules.das
  const splitAcesLocked = h.splitAces && !rules.hitSplitAces
  if (two && !splitAcesLocked && dasOk && botCanDouble(total, soft, rules)) {
    out.push('double')
  }

  if (
    two &&
    isPair(h.cards) &&
    s.hero.hands.length < rules.maxSplitHands &&
    (bucket(h.cards[0].rank) !== 1 || !h.fromSplit || rules.resplitAces)
  ) {
    out.push('split')
  }

  if (rules.surrender !== 'none' && two && !h.fromSplit) {
    out.push('surrender')
  }

  return out
}

/**
 * Play the dealer out and settle. Reveals the hole and draws to the rule's
 * standing total only when at least one hand is still live. Otherwise the hole
 * stays hidden (and uncounted), as at a real table. Valid only in `dealerTurn`.
 */
export function playDealer(state: RoundState): RoundState {
  if (state.phase !== 'dealerTurn') return state
  const s = cloneState(state)

  const heroLive = s.hero.hands.some((h) => !h.surrendered && handTotal(h.cards).total <= 21)
  const otherLive = s.others.some((o) => handTotal(o.hand.cards).total <= 21)

  if (heroLive || otherLive) {
    revealHole(s)
    const hitsSoft17 = s.rules.soft17 === 'H17'
    let guard = 0
    while (guard++ < 24) {
      const { total, soft } = handTotal(s.dealer.cards)
      if (total > 21) break
      const mustHit = total < 17 || (total === 17 && soft && hitsSoft17)
      if (!mustHit) break
      s.dealer.cards.push(takeExposed(s))
    }
  }

  settleRound(s)
  return s
}

/** Reshuffle the shoe now (fresh deck order, count reset). */
export function reshuffle(state: RoundState): RoundState {
  const s = cloneState(state)
  reshuffleInto(s)
  s.phase = 'idle'
  s.result = null
  return s
}

// ---- Convenience wrappers --------------------------------------------------

export const hit = (s: RoundState): RoundState => act(s, 'hit')
export const stand = (s: RoundState): RoundState => act(s, 'stand')
export const double = (s: RoundState): RoundState => act(s, 'double')
export const split = (s: RoundState): RoundState => act(s, 'split')
export const surrender = (s: RoundState): RoundState => act(s, 'surrender')

/**
 * Auto-play the hero's hands with the composition-aware solver (handles splits,
 * doubles and surrenders). Used by count drills where the hero is a spectator.
 */
export function autoHero(state: RoundState): RoundState {
  let s = state
  let guard = 0
  while (s.phase === 'playerTurn' && guard++ < 40) {
    const rec = recommendation(s)
    const legal = legalActions(s)
    let choice: Action = 'stand'
    if (rec) {
      const best = rec.ranked.find((a) => legal.includes(a.action))
      if (best) choice = best.action
    }
    s = act(s, choice)
  }
  return s
}

/**
 * Deal and fully resolve one round automatically (bots decline insurance, the
 * hero plays optimal basic strategy). Handy for count drills and simulations.
 */
export function playRound(state: RoundState, bet = 1): RoundState {
  let s = startRound(state, bet)
  if (s.phase === 'insurance') s = takeInsurance(s, false)
  if (s.phase === 'playerTurn') s = autoHero(s)
  if (s.phase === 'dealerTurn') s = playDealer(s)
  return s
}

// ---- Selectors -------------------------------------------------------------

export function activeHand(state: RoundState): PlayerHand | null {
  if (state.phase !== 'playerTurn') return null
  return state.hero.hands[state.hero.activeIndex] ?? null
}

export function dealerUpValue(state: RoundState): number {
  return state.dealer.cards.length ? dealerUpBucket(state) : 0
}

export function heroTotals(state: RoundState): { total: number; soft: boolean }[] {
  return state.hero.hands.map((h) => handTotal(h.cards))
}

export function decksRemaining(state: RoundState): number {
  return decksRemainingCount(state.dealt, state.rules.decks)
}

/** True count rounded per the given estimation granularity (floored toward zero). */
export function trueCountRounded(state: RoundState, rounding: TrueCountRounding = 'full'): number {
  const dr = decksRemainingCount(state.dealt, state.rules.decks, rounding)
  const tc = trueCountOf(state.running, dr)
  return Math.trunc(tc)
}

export function isRoundOver(state: RoundState): boolean {
  return state.phase === 'settled'
}

export function netResult(state: RoundState): number {
  return state.result ? state.result.totalPnl : 0
}

/**
 * Composition-aware recommendation for the hero's active hand (Decision from the
 * EV solver), or null when it is not the hero's turn.
 */
export function recommendation(state: RoundState): Decision | null {
  if (state.phase !== 'playerTurn') return null
  const h = activeHand(state)
  if (!h) return null
  const legal = legalActions(state)
  const comp = compositionFromCards(state.shoe)
  return evaluate(h.cards, dealerUpBucket(state), comp, state.rules, {
    canDouble: legal.includes('double'),
    canSplit: legal.includes('split'),
    canSurrender: legal.includes('surrender'),
    fromSplit: h.fromSplit,
  })
}

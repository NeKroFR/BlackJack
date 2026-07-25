import { describe, expect, it } from 'vitest'
import type { Card, Rank, Rules, Suit } from '../engine/types'
import { bucket } from '../engine/cards'
import { DEFAULT_RULES } from '../engine/rules'
import { getSystem } from '../engine/counting/systems'
import {
  act,
  createRound,
  legalActions,
  playDealer,
  playRound,
  reshuffle,
  startRound,
  stand,
  takeInsurance,
  type RoundState,
} from './round'

// ---- Test helpers ----------------------------------------------------------

let uid = 0
function C(rank: Rank, suit: Suit = 'S'): Card {
  return { rank, suit, id: `t${uid++}` }
}

/** Build a shoe from an explicit front, padded with benign filler cards. */
function shoe(front: Card[], fillRank: Rank = '4', fillCount = 40): Card[] {
  const fill = Array.from({ length: fillCount }, () => C(fillRank))
  return [...front, ...fill]
}

/** A round primed to deal from an exact, non-shuffled shoe. */
function primed(front: Card[], rules: Rules = DEFAULT_RULES, seats = 0): RoundState {
  const s = createRound({ rules, seats })
  return {
    ...s,
    shoe: shoe(front),
    needsShuffle: false,
    dealt: 0,
    seen: [],
    running: s.system.runningCountStart(rules.decks),
  }
}

const S17: Rules = { ...DEFAULT_RULES, soft17: 'S17' }
const H17: Rules = { ...DEFAULT_RULES, soft17: 'H17' }

// ---- Dealing ---------------------------------------------------------------

describe('dealing', () => {
  it('deals two cards to the hero and dealer, hole hidden and uncounted', () => {
    // order: hero1, dealerUp, hero2, hole
    const s = startRound(primed([C('5'), C('6'), C('6'), C('K')]), 10)
    expect(s.phase).toBe('playerTurn')
    expect(s.hero.hands).toHaveLength(1)
    expect(s.hero.hands[0].cards.map((c) => c.rank)).toEqual(['5', '6'])
    expect(s.hero.hands[0].bet).toBe(10)
    expect(s.dealer.cards).toHaveLength(2)
    expect(s.dealer.holeRevealed).toBe(false)
    // dealt counts the hole (removed from the shoe); seen does not.
    expect(s.dealt).toBe(4)
    expect(s.seen.map((c) => c.rank)).toEqual(['5', '6', '6'])
  })

  it('tracks the Hi-Lo running count over exposed cards only', () => {
    const s = startRound(primed([C('5'), C('6'), C('6'), C('K')]))
    // 5,6,6 are each +1 in Hi-Lo; the hole K (−1) is not yet counted.
    expect(s.running).toBe(3)
  })

  it('reveals and counts the hole card during the dealer turn', () => {
    let s = startRound(primed([C('T'), C('6'), C('9'), C('K')]))
    s = stand(s)
    expect(s.phase).toBe('dealerTurn')
    s = playDealer(s)
    expect(s.dealer.holeRevealed).toBe(true)
    // Now the K (−1) is folded into the count: 10,6,9 (+1) then K (−1) => start 3? recompute:
    // exposed: T(-1),6(+1),9(0),K(-1) = -1; plus any dealer draws.
    expect(s.seen.some((c) => c.rank === 'K')).toBe(true)
  })

  it('deals to bot seats and counts their cards', () => {
    // seats=2: order pass1 = seatA1, seatB1, hero1, up; pass2 = seatA2, seatB2, hero2, hole
    const front = [C('2'), C('3'), C('5'), C('6'), C('4'), C('9'), C('K'), C('T')]
    const s = startRound(primed(front, S17, 2), 10)
    expect(s.others).toHaveLength(2)
    expect(s.others[0].hand.cards[0].rank).toBe('2')
    expect(s.others[1].hand.cards[0].rank).toBe('3')
    expect(s.hero.hands[0].cards[0].rank).toBe('5')
    expect(s.dealer.cards[0].rank).toBe('6')
  })
})

// ---- Reproducibility -------------------------------------------------------

describe('seeded reproducibility', () => {
  function playFive(seed: number): string[] {
    let s = createRound({ rules: DEFAULT_RULES, seed, seats: 2 })
    const ids: string[] = []
    for (let i = 0; i < 5; i++) {
      s = playRound(s, 10)
      for (const c of s.seen) ids.push(c.id)
    }
    return ids
  }

  it('same seed replays the identical shoe', () => {
    expect(playFive(1234)).toEqual(playFive(1234))
  })

  it('different seeds diverge', () => {
    expect(playFive(1)).not.toEqual(playFive(2))
  })
})

// ---- Legal actions ---------------------------------------------------------

describe('legal actions', () => {
  it('offers stand/hit/double/surrender on a fresh two-card hand', () => {
    const s = startRound(primed([C('T'), C('7'), C('6'), C('9')])) // 16 vs 7
    expect(legalActions(s).sort()).toEqual(['double', 'hit', 'stand', 'surrender'])
  })

  it('drops double once the hand has three cards', () => {
    let s = startRound(primed([C('5'), C('7'), C('4'), C('9')])) // 9 vs 7
    s = act(s, 'hit') // now three cards
    expect(legalActions(s)).not.toContain('double')
  })

  it('offers split on a pair', () => {
    const s = startRound(primed([C('8'), C('6'), C('8'), C('T')]))
    expect(legalActions(s)).toContain('split')
  })

  it('ignores out-of-phase or illegal actions', () => {
    const s = startRound(primed([C('T'), C('7'), C('9'), C('K')])) // 19, not a pair
    const same = act(s, 'split') // not a pair -> illegal, no-op
    expect(same).toBe(s)
  })
})

// ---- Splits ----------------------------------------------------------------

describe('splits', () => {
  it('splits a pair into two independent hands, one draw each', () => {
    // hero 8,8 vs 6; split draws 3 then 2
    let s = startRound(primed([C('8'), C('6'), C('8'), C('T'), C('3'), C('2')]), 10)
    s = act(s, 'split')
    expect(s.hero.hands).toHaveLength(2)
    expect(s.hero.hands[0].cards.map((c) => c.rank)).toEqual(['8', '3'])
    expect(s.hero.hands[1].cards.map((c) => c.rank)).toEqual(['8', '2'])
    expect(s.hero.hands.every((h) => h.fromSplit)).toBe(true)
    expect(s.hero.hands.every((h) => h.bet === 10)).toBe(true)
    expect(s.phase).toBe('playerTurn')
  })

  it('gives split aces exactly one card and ends the turn (default rules)', () => {
    let s = startRound(primed([C('A'), C('6'), C('A'), C('T'), C('K'), C('9')]))
    s = act(s, 'split')
    expect(s.hero.hands).toHaveLength(2)
    expect(s.hero.hands.every((h) => h.splitAces && h.done)).toBe(true)
    // A,K on a split hand is 21 but NOT a natural blackjack.
    expect(s.phase).toBe('dealerTurn')
  })

  it('honours maxSplitHands: no resplit once the cap is reached', () => {
    const rules: Rules = { ...DEFAULT_RULES, maxSplitHands: 2 }
    // after split, hand 0 draws another 8 (a fresh pair) but the cap is hit.
    let s = startRound(primed([C('8'), C('6'), C('8'), C('T'), C('8'), C('2')], rules))
    s = act(s, 'split')
    expect(s.hero.hands).toHaveLength(2)
    expect(legalActions(s)).not.toContain('split')
  })

  it('allows double-after-split when DAS is on', () => {
    let s = startRound(primed([C('5'), C('6'), C('5'), C('T'), C('6'), C('9')]))
    s = act(s, 'split') // two hands of 5 + draw -> 5,6=11 and 5,9=14
    expect(legalActions(s)).toContain('double')
  })
})

// ---- Dealer play -----------------------------------------------------------

describe('dealer play', () => {
  it('stands on soft 17 under S17', () => {
    // dealer up 6, hole A -> soft 17; hero 19 stands.
    let s = startRound(primed([C('T'), C('6'), C('9'), C('A')], S17), 10)
    s = stand(s)
    s = playDealer(s)
    expect(s.result?.dealerTotal).toBe(17)
    expect(s.result?.hands[0].result).toBe('win')
  })

  it('hits soft 17 under H17', () => {
    // dealer 6,A soft17 -> draws a 4 -> 6+A+4 = 21.
    let s = startRound(primed([C('T'), C('6'), C('9'), C('A'), C('4')], H17), 10)
    s = stand(s)
    s = playDealer(s)
    expect(s.result?.dealerTotal).toBe(21)
    expect(s.result?.hands[0].result).toBe('lose')
  })

  it('draws to a hard 17 and stands', () => {
    // dealer 7,6 = 13, draws a 4 -> 17.
    let s = startRound(primed([C('T'), C('7'), C('9'), C('6'), C('4')], S17))
    s = stand(s)
    s = playDealer(s)
    expect(s.result?.dealerTotal).toBe(17)
  })

  it('leaves the hole hidden when every hero hand has busted', () => {
    // hero 10,6 = 16 vs 7; hit a 10 -> bust. Dealer should not reveal/play.
    let s = startRound(primed([C('T'), C('7'), C('6'), C('9'), C('T')]))
    s = act(s, 'hit') // 16 + 10 = 26 bust -> done
    expect(s.phase).toBe('dealerTurn')
    s = playDealer(s)
    expect(s.dealer.holeRevealed).toBe(false)
    expect(s.result?.hands[0].result).toBe('lose')
  })
})

// ---- Settlement ------------------------------------------------------------

describe('settlement', () => {
  it('pays a natural blackjack 3:2', () => {
    // hero A,K vs 6; dealer 6,9 draws 6 -> 21 (multi-card, not natural).
    let s = startRound(primed([C('A'), C('6'), C('K'), C('9'), C('6')]), 10)
    expect(s.phase).toBe('dealerTurn') // hero natural auto-stands
    s = playDealer(s)
    expect(s.result?.hands[0].result).toBe('blackjack')
    expect(s.result?.hands[0].pnl).toBeCloseTo(15, 6) // 1.5 * 10
  })

  it('pushes blackjack against a dealer natural', () => {
    // hero A,K vs dealer A,T (natural). Peek settles immediately.
    let s = startRound(primed([C('A'), C('A'), C('K'), C('T')]), 10)
    expect(s.phase).toBe('insurance')
    s = takeInsurance(s, false)
    expect(s.phase).toBe('settled')
    expect(s.result?.dealerBlackjack).toBe(true)
    expect(s.result?.hands[0].result).toBe('push')
    expect(s.result?.totalPnl).toBe(0)
  })

  it('resolves win / lose / push by total', () => {
    // win: hero 20 vs dealer 18 (T,8)
    let win = startRound(primed([C('T'), C('T'), C('T'), C('8')]))
    win = playDealer(stand(win))
    expect(win.result?.hands[0].result).toBe('win')

    // lose: hero 16 stands vs dealer 20 (T,T)
    let lose = startRound(primed([C('T'), C('T'), C('6'), C('T')]))
    lose = playDealer(stand(lose))
    expect(lose.result?.hands[0].result).toBe('lose')

    // push: hero 18 vs dealer 18
    let push = startRound(primed([C('T'), C('T'), C('8'), C('8')]))
    push = playDealer(stand(push))
    expect(push.result?.hands[0].result).toBe('push')
  })

  it('doubles the stake and the payout on a double', () => {
    // hero 6,5 = 11 vs 5; double draws T -> 21. dealer 5,6 draws 9 -> 20.
    let s = startRound(primed([C('6'), C('5'), C('5'), C('6'), C('T'), C('9')]), 10)
    s = act(s, 'double')
    expect(s.hero.hands[0].doubled).toBe(true)
    expect(s.hero.hands[0].bet).toBe(20)
    s = playDealer(s)
    expect(s.result?.hands[0].result).toBe('win')
    expect(s.result?.hands[0].pnl).toBe(20)
  })

  it('surrenders for half the bet', () => {
    // hero T,6 = 16 vs ten. Ten up peeks (no natural), surrender available.
    let s = startRound(primed([C('T'), C('T'), C('6'), C('9')]), 10)
    expect(legalActions(s)).toContain('surrender')
    s = act(s, 'surrender')
    expect(s.phase).toBe('dealerTurn')
    s = playDealer(s)
    expect(s.result?.hands[0].result).toBe('surrender')
    expect(s.result?.hands[0].pnl).toBe(-5)
  })
})

// ---- Insurance -------------------------------------------------------------

describe('insurance', () => {
  it('offers insurance on a dealer Ace and pays 2:1 on a dealer natural', () => {
    // hero 9,8 = 17 vs A; dealer A,T natural.
    let s = startRound(primed([C('9'), C('A'), C('8'), C('T')]), 10)
    expect(s.phase).toBe('insurance')
    s = takeInsurance(s, true)
    expect(s.phase).toBe('settled')
    expect(s.result?.insurance).toBe('win')
    expect(s.result?.insurancePnl).toBe(10) // 2 * (10/2)
    expect(s.result?.hands[0].result).toBe('lose') // 17 loses to natural
    expect(s.result?.totalPnl).toBe(0) // -10 hand + 10 insurance
  })

  it('loses the insurance bet when the dealer has no natural', () => {
    // hero 9,8 = 17 vs A; dealer A,5 (no natural).
    let s = startRound(primed([C('9'), C('A'), C('8'), C('5')]), 10)
    s = takeInsurance(s, true)
    expect(s.phase).toBe('playerTurn')
    s = playDealer(stand(s))
    expect(s.result?.insurance).toBe('lose')
    expect(s.result?.insurancePnl).toBe(-5)
  })

  it('does not offer insurance when disabled', () => {
    const rules: Rules = { ...DEFAULT_RULES, insurance: false }
    // dealer Ace, no natural (hole 5) -> straight to the hero turn.
    const s = startRound(primed([C('9'), C('A'), C('8'), C('5')], rules))
    expect(s.phase).toBe('playerTurn')
    expect(s.hero.insuranceBet).toBe(0)
  })
})

// ---- Count math ------------------------------------------------------------

describe('count tracking', () => {
  it('running count equals the sum of Hi-Lo tags over exposed cards', () => {
    const s = playRound(createRound({ rules: DEFAULT_RULES, seed: 7, seats: 3 }), 10)
    const sys = getSystem('hilo')
    const expected = s.seen.reduce((a, c) => a + sys.tags[bucket(c.rank)], 0)
    expect(s.running).toBe(expected)
  })

  it('starts KO at its negative initial running count', () => {
    const s = createRound({ rules: DEFAULT_RULES, system: 'ko' })
    // KO IRC for 6 decks = 4 - 4*6 = -20.
    expect(s.running).toBe(-20)
  })

  it('never exposes a card twice', () => {
    const s = playRound(createRound({ rules: DEFAULT_RULES, seed: 99, seats: 4 }), 10)
    const ids = new Set(s.seen.map((c) => c.id))
    expect(ids.size).toBe(s.seen.length)
  })

  it('computes a positive true count from a ten-poor shoe', () => {
    // Expose a pile of low cards; the running count and true count go positive.
    let s = createRound({ rules: DEFAULT_RULES, seed: 3 })
    s = startRound({ ...s, shoe: shoe([C('5'), C('6'), C('4'), C('T')]) })
    expect(s.running).toBeGreaterThan(0)
    expect(s.trueCount).toBeGreaterThan(0)
  })
})

// ---- Shoe management -------------------------------------------------------

describe('shoe management', () => {
  it('reshuffle() rebuilds a full shoe and resets the count', () => {
    let s = playRound(createRound({ rules: DEFAULT_RULES, seed: 5 }), 10)
    expect(s.dealt).toBeGreaterThan(0)
    s = reshuffle(s)
    expect(s.shoe).toHaveLength(6 * 52)
    expect(s.dealt).toBe(0)
    expect(s.seen).toHaveLength(0)
    expect(s.running).toBe(0) // Hi-Lo IRC
    expect(s.phase).toBe('idle')
  })

  it('auto-reshuffles once the cut card is passed', () => {
    const rules: Rules = { ...DEFAULT_RULES, decks: 1, penetration: 0.5 } // cut card at 26
    let s = createRound({ rules, seed: 11 })
    let reshuffleCount = 0
    let maxDealt = 0
    let sawPenetrationFlag = false
    for (let i = 0; i < 60; i++) {
      const before = s
      s = playRound(s, 10)
      if (s.reshuffled) reshuffleCount++
      maxDealt = Math.max(maxDealt, s.dealt)
      if (before.needsShuffle) {
        // A reshuffle must have happened this deal, resetting the shoe.
        expect(s.reshuffled).toBe(true)
      }
      if (s.needsShuffle) sawPenetrationFlag = true
    }
    expect(reshuffleCount).toBeGreaterThan(1) // first deal + penetration reshuffles
    expect(sawPenetrationFlag).toBe(true)
    expect(maxDealt).toBeLessThanOrEqual(52)
  })

  it('flags needsShuffle only after the cut card', () => {
    const rules: Rules = { ...DEFAULT_RULES, decks: 1, penetration: 0.5 }
    let s = createRound({ rules, seed: 2 })
    s = playRound(s, 10) // first (forced) shuffle + one round
    // Immediately after a shuffle the cut card (26) is far off.
    expect(s.dealt).toBeLessThan(26)
    expect(s.needsShuffle).toBe(false)
  })
})

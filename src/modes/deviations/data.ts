// Deviations trainer: pure data + grading logic (no React, no store).
//
// The trainer drills the canonical Hi-Lo index plays sourced from the engine
// (`ILLUSTRIOUS_18` / `FAB_4` / `INSURANCE_INDEX` in engine/deviations.ts). Each
// index play toggles between exactly two actions around a true-count threshold:
// at or above the `index` you take `aboveAction`, below it you take
// `belowAction` (its complement). Exactly one of those two is off-the-top basic
// strategy. The other is the count-based departure. This module turns the raw
// tables into ready-to-render drill cards and provides the grading functions the
// UI calls. Everything here is deterministic and unit-tested.

import type { Action, Card, Rank, Rules } from '../../engine/types'
import { FAB_4, ILLUSTRIOUS_18, INSURANCE_INDEX } from '../../engine/deviations'

export { INSURANCE_INDEX }

export type DeviationSet = 'illustrious' | 'fab4'

/** A single count-based play the trainer drills (insurance is handled apart). */
export interface DeviationDrill {
  /** Stable, unique key (also used as the spaced-repetition item key). */
  key: string
  /** Canonical hand key: a hard total ('9'..'16') or a pair of tens ('TT'). */
  hand: string
  /** Dealer upcard bucket, 1..10 (1 = Ace). */
  dealerUpValue: number
  /** Player cards realising `hand` (two-card, non-blackjack). */
  cards: Card[]
  /** The dealer's upcard. */
  upCard: Card
  /** Action taken at true count >= `index`. */
  aboveAction: Action
  /** Action taken below `index` (the complement of `aboveAction`). */
  belowAction: Action
  /** Off-the-top basic strategy: one of `aboveAction` / `belowAction`. */
  basicAction: Action
  /** The count-based departure from basic: the other of the two. */
  deviationAction: Action
  /** Hi-Lo true count at/above which `aboveAction` applies. */
  index: number
  set: DeviationSet
}

/** The action you revert to on the far side of an index play. */
export function complementAction(action: Action): Action {
  switch (action) {
    case 'stand':
      return 'hit'
    case 'hit':
      return 'stand'
    case 'double':
      return 'hit'
    case 'surrender':
      return 'hit'
    case 'split':
      return 'stand'
  }
}

const ACTION_LABEL: Record<Action, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
  surrender: 'Surrender',
}

/** Display label for a player action, e.g. 'Stand'. */
export function actionLabel(action: Action): string {
  return ACTION_LABEL[action]
}

/** Signed count string: '+3', '0', '-2'. */
export function signed(n: number): string {
  if (n === 0) return '0'
  return (n > 0 ? '+' : '-') + Math.abs(n)
}

/** Dealer upcard label, e.g. '6' or 'A'. */
export function upLabel(value: number): string {
  return value === 1 ? 'A' : value === 10 ? '10' : String(value)
}

/** Human hand label, e.g. '16' or 'T,T'. */
export function handLabel(hand: string): string {
  return hand === 'TT' ? 'T,T' : hand
}

/** '16 v 10', 'T,T v 6'. */
export function matchupLabel(drill: DeviationDrill): string {
  return `${handLabel(drill.hand)} v ${upLabel(drill.dealerUpValue)}`
}

// Two concrete ranks realising each hand key: hard totals kept non-paired and
// ace-free so they read unambiguously, tens as a genuine pair.
const HAND_RANKS: Record<string, [Rank, Rank]> = {
  '9': ['5', '4'],
  '10': ['6', '4'],
  '11': ['7', '4'],
  '12': ['T', '2'],
  '13': ['T', '3'],
  '14': ['T', '4'],
  '15': ['T', '5'],
  '16': ['T', '6'],
  TT: ['T', 'T'],
}

// Off-the-top basic strategy for each drilled matchup: the side of the index
// you revert to. Fixed textbook values (surrender-agnostic), keyed by hand v up
// so the 15 v 10 pairing shared by the two sets resolves to one basic play.
const BASIC_ACTION: Record<string, Action> = {
  '16v10': 'hit',
  '15v10': 'hit',
  '16v9': 'hit',
  '10v10': 'hit',
  '10v1': 'hit',
  '11v1': 'hit',
  '9v2': 'hit',
  '9v7': 'hit',
  '12v2': 'hit',
  '12v3': 'hit',
  '12v4': 'stand',
  '12v5': 'stand',
  '12v6': 'stand',
  '13v2': 'stand',
  '13v3': 'stand',
  TTv5: 'stand',
  TTv6: 'stand',
  '14v10': 'hit',
  '15v9': 'hit',
  '15v1': 'hit',
}

let cardSeq = 0
const SUITS = ['S', 'H', 'D', 'C'] as const

function mkCard(rank: Rank): Card {
  const suit = SUITS[cardSeq % SUITS.length]
  return { rank, suit, id: `dev-${rank}-${cardSeq++}` }
}

function upRank(value: number): Rank {
  if (value === 1) return 'A'
  if (value === 10) return 'T'
  return String(value) as Rank
}

function makeDrill(
  hand: string,
  dealerUpValue: number,
  aboveAction: Action,
  index: number,
  set: DeviationSet,
): DeviationDrill {
  const belowAction = complementAction(aboveAction)
  const basicKey = `${hand}v${dealerUpValue}`
  const basicAction = BASIC_ACTION[basicKey] ?? belowAction
  const deviationAction = basicAction === aboveAction ? belowAction : aboveAction
  const [r1, r2] = HAND_RANKS[hand]
  return {
    key: `${set}:${hand}v${dealerUpValue}`,
    hand,
    dealerUpValue,
    cards: [mkCard(r1), mkCard(r2)],
    upCard: mkCard(upRank(dealerUpValue)),
    aboveAction,
    belowAction,
    basicAction,
    deviationAction,
    index,
    set,
  }
}

/**
 * Build the play-a-deviation pool for a rules set. Late-surrender (Fab 4)
 * departures are included only when surrender is available. The Illustrious
 * "15 v 10 stand" is dropped in that case because the Fab-4 surrender governs
 * the same hand and would otherwise give two correct answers.
 */
export function buildDrills(rules: Rules): DeviationDrill[] {
  const surrenderOn = rules.surrender !== 'none'
  const drills: DeviationDrill[] = []
  for (const p of ILLUSTRIOUS_18) {
    if (p.action === 'insurance') continue
    if (surrenderOn && p.hand === '15' && p.dealerUpValue === 10) continue
    drills.push(makeDrill(p.hand, p.dealerUpValue, p.action as Action, p.index, 'illustrious'))
  }
  if (surrenderOn) {
    for (const p of FAB_4) {
      drills.push(makeDrill(p.hand, p.dealerUpValue, p.action as Action, p.index, 'fab4'))
    }
  }
  return drills
}

/** The correct action for a drill at a given true count. */
export function correctActionAt(drill: DeviationDrill, trueCount: number): Action {
  return trueCount >= drill.index ? drill.aboveAction : drill.belowAction
}

/** Whether the departure sits above the index ('… at TC ≥ index'). */
export function isAscendingDeviation(drill: DeviationDrill): boolean {
  return drill.deviationAction === drill.aboveAction
}

/** Actions the drill offers as answer buttons (always at least hit + stand). */
export function offeredActions(drill: DeviationDrill, rules: Rules): Set<Action> {
  const out = new Set<Action>(['hit', 'stand'])
  for (const a of [drill.aboveAction, drill.belowAction]) {
    if (a === 'double') out.add('double')
    if (a === 'split') out.add('split')
    if (a === 'surrender' && rules.surrender !== 'none') out.add('surrender')
  }
  return out
}

/** The count threshold, phrased for the departure direction. */
export function thresholdText(drill: DeviationDrill): string {
  const dev = actionLabel(drill.deviationAction)
  return isAscendingDeviation(drill)
    ? `${dev} at TC ≥ ${signed(drill.index)}`
    : `${dev} at TC < ${signed(drill.index)}`
}

/** Full "why" for a graded play, citing basic, the departure, and the count. */
export function explainDrill(drill: DeviationDrill, trueCount: number): string {
  const correct = actionLabel(correctActionAt(drill, trueCount))
  return (
    `${matchupLabel(drill)}: basic play is ${actionLabel(drill.basicAction)}. ` +
    `Deviation — ${thresholdText(drill)}. ` +
    `At TC ${signed(trueCount)} the correct play is ${correct}.`
  )
}

// ---- Index recall -----------------------------------------------------------

/** A memorise-the-number item: an ascending index play or insurance. */
export interface RecallItem {
  key: string
  /** Prompt matchup label, e.g. '16 v 10'. */
  matchup: string
  /** The play to recall the index for, e.g. 'Stand' / 'Take insurance'. */
  play: string
  /** Canonical Hi-Lo index (true count) to recall. */
  index: number
}

/**
 * Recall pool: the ascending departures (correct answer is a clean 'at TC ≥ N')
 * plus the insurance index. Descending stiffs (hit-at-very-low) are omitted so
 * every prompt reads as a single '≥' threshold.
 */
export function buildRecallItems(rules: Rules): RecallItem[] {
  const items: RecallItem[] = [
    { key: 'insurance', matchup: 'Any hand v A', play: 'Take insurance', index: INSURANCE_INDEX },
  ]
  for (const d of buildDrills(rules)) {
    if (!isAscendingDeviation(d)) continue
    items.push({
      key: d.key,
      matchup: matchupLabel(d),
      play: actionLabel(d.deviationAction),
      index: d.index,
    })
  }
  return items
}

export type RecallGrade = 'exact' | 'close' | 'wrong'

/** Grade an index guess: exact, within 1 ('close'), or wrong. */
export function gradeRecall(guess: number, index: number): RecallGrade {
  const off = Math.abs(guess - index)
  if (off === 0) return 'exact'
  if (off <= 1) return 'close'
  return 'wrong'
}

/** Exact and close both count as correct for accuracy tracking. */
export function recallCorrect(grade: RecallGrade): boolean {
  return grade !== 'wrong'
}

// ---- Insurance drill --------------------------------------------------------

/** Correct insurance decision at a true count (Hi-Lo: take at TC ≥ +3). */
export function insuranceCorrect(trueCount: number, take: boolean): boolean {
  const shouldTake = trueCount >= INSURANCE_INDEX
  return take === shouldTake
}

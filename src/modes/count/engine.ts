// Pure logic for the counting drill: turn the active shoe + counting system
// into a deterministic sequence of "beats" (groups of cards flashed together),
// place mid-shoe "call the count" checkpoints, and grade the player's answers.
//
// Everything here is side-effect free and RNG-injectable so it can be unit
// tested and reproduced with a seed.

import type { Card, CountingSystem } from '../../engine/types'
import type { TrueCountRounding } from '../../store/settingsSlice'
import { buildShoe, shuffle, mulberry32, type Rng } from '../../engine/cards'
import { runningCountWithStart, trueCount, decksRemaining } from '../../engine/counting'

export type CountMode = 'single' | 'shoe' | 'grouped' | 'table'

/** One flash: the cards shown together, and whether we pause for a count after. */
export interface Beat {
  index: number
  cards: Card[]
  /** Ask the player for the count immediately after this beat. */
  checkpoint: boolean
}

export interface DrillPlan {
  mode: CountMode
  decks: number
  beats: Beat[]
  /** Total number of cards across every beat. */
  totalCards: number
}

export interface PlanConfig {
  mode: CountMode
  decks: number
  /** Other seated players (0..6), table mode adds the hero + dealer on top. */
  seats: number
  seed?: number
  rng?: Rng
  /** Fraction of the shoe to deal in "shoe" mode before stopping. */
  penetration?: number
}

/** Beats used by the fixed-length modes (shoe is driven by penetration). */
export const SINGLE_BEATS = 16
export const GROUPED_BEATS = 12
export const TABLE_ROUNDS = 8

function resolveRng(cfg: PlanConfig): Rng {
  if (cfg.rng) return cfg.rng
  if (cfg.seed !== undefined) return mulberry32(cfg.seed)
  return Math.random
}

/** Cards revealed per beat, before clamping to what the shoe can supply. */
function chunkSizes(cfg: PlanConfig, rng: Rng): number[] {
  switch (cfg.mode) {
    case 'single':
      return Array(SINGLE_BEATS).fill(1)
    case 'grouped':
      return Array.from({ length: GROUPED_BEATS }, () => (rng() < 0.5 ? 2 : 3))
    case 'table': {
      const players = Math.min(6, Math.max(0, cfg.seats)) + 1 // + hero
      const perRound = players * 2 + 1 // each player's two cards + dealer upcard
      return Array(TABLE_ROUNDS).fill(perRound)
    }
    case 'shoe': {
      const pen = cfg.penetration ?? 0.75
      const total = Math.max(1, Math.floor(cfg.decks * 52 * pen))
      return Array(total).fill(1)
    }
  }
}

/** Which beat indices get a "call the count" checkpoint (mid-drill only). */
function checkpointIndices(mode: CountMode, n: number): Set<number> {
  if (mode === 'shoe' && n >= 6) return new Set([Math.floor(n / 3), Math.floor((2 * n) / 3)])
  if (mode === 'table' && n >= 4) return new Set([Math.floor(n / 2)])
  return new Set()
}

/** Build the full, deterministic drill plan for the active mode + shoe. */
export function buildPlan(cfg: PlanConfig): DrillPlan {
  const rng = resolveRng(cfg)
  const shoe = shuffle(buildShoe(cfg.decks), rng)
  const sizes = chunkSizes(cfg, rng)

  const beats: Beat[] = []
  let cursor = 0
  for (const size of sizes) {
    if (cursor >= shoe.length) break
    const cards = shoe.slice(cursor, cursor + size)
    cursor += cards.length
    beats.push({ index: beats.length, cards, checkpoint: false })
  }

  const checks = checkpointIndices(cfg.mode, beats.length)
  for (const i of checks) {
    if (beats[i]) beats[i].checkpoint = true
  }

  const totalCards = beats.reduce((n, b) => n + b.cards.length, 0)
  return { mode: cfg.mode, decks: cfg.decks, beats, totalCards }
}

/** All cards revealed from the first beat up to and including `beatIndex`. */
export function cardsThrough(beats: Beat[], beatIndex: number): Card[] {
  const out: Card[] = []
  for (let i = 0; i <= beatIndex && i < beats.length; i++) out.push(...beats[i].cards)
  return out
}

/**
 * The count the player should hold after seeing `seen`. For unbalanced systems
 * (KO) this folds in the Initial Running Count, matching real play.
 */
export function expectedRunning(seen: Card[], sys: CountingSystem, decks: number): number {
  return runningCountWithStart(seen, sys, decks)
}

/**
 * The rounded true count after seeing `seen` (balanced systems only). Mirrors
 * the live-table convention: round decks-remaining to the estimation
 * granularity, then truncate the true count toward zero.
 */
export function expectedTrue(
  seen: Card[],
  sys: CountingSystem,
  decks: number,
  rounding: TrueCountRounding,
): number {
  const rc = runningCountWithStart(seen, sys, decks)
  const dr = decksRemaining(seen.length, decks, rounding)
  return Math.trunc(trueCount(rc, dr))
}

/** The cards-per-minute the player sustained over `totalCards` in `elapsedMs`. */
export function achievedCpm(totalCards: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0
  return Math.round((totalCards / elapsedMs) * 60000)
}

/** Convert a cards-per-minute pace into the interval between cards, in ms. */
export function cardIntervalMs(cpm: number): number {
  return 60000 / Math.max(1, cpm)
}

/** Adaptive next pace: speed up when a round is aced, cap at `max`. */
export function rampCpm(cpm: number, allCorrect: boolean, max = 300): number {
  if (!allCorrect) return cpm
  return Math.min(max, Math.round((cpm * 1.15) / 10) * 10)
}

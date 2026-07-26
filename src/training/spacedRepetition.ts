// SM-2-lite spaced-repetition scheduler keyed by opaque string item keys
// (e.g. a strategy-situation key like `hard16-vs-10`).
//
// The scheduler is deliberately pure: every function takes the state it needs
// and returns a new state, and every time-dependent operation accepts `now`
// (a millisecond timestamp) and an injectable `rng` rather than reading the
// clock or `Math.random` itself. This keeps it fully deterministic under test.
//
// "SM-2-lite": we keep an SM-2 style ease factor per item and grow the review
// interval geometrically on success, but we drop the 0..5 quality grade in
// favour of a binary correct/incorrect signal (all a drill can observe). A wrong
// answer is a *lapse*: it resets the streak, nudges ease down, and reschedules
// the item almost immediately so it resurfaces soon.

import type { Rng } from '../engine/cards'

/** Per-item scheduling record. All fields are plain JSON, safe to persist. */
export interface SrItem {
  key: string
  /** SM-2 ease factor, multiplies the interval on each successful review. */
  ease: number
  /** Current scheduling interval in milliseconds. */
  interval: number
  /** Consecutive correct reviews (resets to 0 on a lapse). */
  reps: number
  /** Total lifetime lapses (wrong answers). */
  lapses: number
  /** Timestamp (ms) at which this item becomes due again. */
  dueAt: number
  /** Total lifetime reviews. */
  reviews: number
  /** Result of the most recent review. */
  lastCorrect: boolean
}

/** Serializable scheduler state. Store this on/off the Zustand store as-is. */
export interface SrState {
  items: Record<string, SrItem>
}

/** Tunable scheduling constants. Defaults suit fast, in-session drilling. */
export interface SrConfig {
  startEase: number
  minEase: number
  maxEase: number
  /** Ease bump applied on a correct review. */
  easeUp: number
  /** Ease penalty applied on a lapse. */
  easeDown: number
  /** Interval (ms) after the first correct review. */
  firstInterval: number
  /** Interval (ms) after the second consecutive correct review. */
  secondInterval: number
  /** Interval (ms) an item waits after a lapse. */
  lapseInterval: number
  /** Selection weight given to an item that has never been seen. */
  newWeight: number
  /** Extra selection weight per lifetime lapse (surfaces trouble items). */
  lapseWeight: number
}

export const DEFAULT_SR_CONFIG: SrConfig = {
  startEase: 2.5,
  minEase: 1.3,
  maxEase: 3.0,
  easeUp: 0.1,
  easeDown: 0.2,
  firstInterval: 20_000, // 20s
  secondInterval: 90_000, // 1.5m
  lapseInterval: 8_000, // 8s, resurface soon
  newWeight: 3,
  lapseWeight: 1.5,
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

/** Fresh SrState with no items. */
export function emptySrState(): SrState {
  return { items: {} }
}

function freshItem(key: string, cfg: SrConfig): SrItem {
  return {
    key,
    ease: cfg.startEase,
    interval: 0,
    reps: 0,
    lapses: 0,
    dueAt: 0,
    reviews: 0,
    lastCorrect: false,
  }
}

/**
 * Record one review of `key` and return a *new* state. Pure: pass the current
 * time in `now` (ms). Correct answers grow the interval geometrically. A wrong
 * answer is a lapse that resets the streak and reschedules the item soon.
 */
export function reviewItem(
  state: SrState,
  key: string,
  correct: boolean,
  now: number,
  config: SrConfig = DEFAULT_SR_CONFIG,
): SrState {
  const prev = state.items[key] ?? freshItem(key, config)
  let ease = prev.ease
  let reps = prev.reps
  let lapses = prev.lapses
  let interval: number

  if (correct) {
    reps += 1
    ease = clamp(ease + config.easeUp, config.minEase, config.maxEase)
    if (reps <= 1) interval = config.firstInterval
    else if (reps === 2) interval = config.secondInterval
    else interval = Math.round(prev.interval * ease)
  } else {
    reps = 0
    lapses += 1
    ease = clamp(ease - config.easeDown, config.minEase, config.maxEase)
    interval = config.lapseInterval
  }

  const item: SrItem = {
    key,
    ease,
    interval,
    reps,
    lapses,
    dueAt: now + interval,
    reviews: prev.reviews + 1,
    lastCorrect: correct,
  }
  return { items: { ...state.items, [key]: item } }
}

/** Selection weight for one candidate key (higher = more likely to be picked). */
export function weightFor(
  state: SrState,
  key: string,
  now: number,
  config: SrConfig = DEFAULT_SR_CONFIG,
): number {
  const item = state.items[key]
  if (!item) return config.newWeight
  const overdue = now - item.dueAt
  if (overdue >= 0) {
    // Due (or overdue): base weight plus how many intervals overdue plus a
    // per-lapse penalty so historically-missed items surface more often.
    const overdueRatio = item.interval > 0 ? overdue / item.interval : 1
    return 1 + Math.min(overdueRatio, 3) + item.lapses * config.lapseWeight
  }
  // Not yet due: a small residual weight that fades toward 0 the more recently
  // it was reviewed, so a just-answered item is very unlikely to repeat.
  const remaining = item.dueAt - now
  const frac = item.interval > 0 ? clamp(remaining / item.interval, 0, 1) : 1
  return 0.25 * (1 - frac)
}

export interface PickNextOptions {
  /** Current time in ms. */
  now: number
  /** Candidate item keys to choose among (the mode's full situation space). */
  pool: string[]
  config?: SrConfig
}

/**
 * Weighted-random pick of the next key to present, biased toward due and
 * previously-missed items and toward introducing unseen keys. Returns
 * `undefined` only when `pool` is empty. Deterministic for a given `rng`.
 */
export function pickNextItem(
  state: SrState,
  rng: Rng,
  opts: PickNextOptions,
): string | undefined {
  const { now, pool } = opts
  const config = opts.config ?? DEFAULT_SR_CONFIG
  if (pool.length === 0) return undefined

  const weights = pool.map((k) => weightFor(state, k, now, config))
  const total = weights.reduce((a, b) => a + b, 0)

  if (total <= 0) {
    // Everything is freshly reviewed: fall back to the most-due (smallest dueAt).
    let best = pool[0]
    let bestDue = state.items[best]?.dueAt ?? -Infinity
    for (const k of pool) {
      const due = state.items[k]?.dueAt ?? -Infinity
      if (due < bestDue) {
        bestDue = due
        best = k
      }
    }
    return best
  }

  let roll = rng() * total
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]
    if (roll < 0) return pool[i]
  }
  return pool[pool.length - 1] // float-rounding guard
}

// ---- (De)serialization for the store ---------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Serialize scheduler state to a plain, persist-safe object. */
export function serializeSrState(state: SrState): SrState {
  return { items: { ...state.items } }
}

/** Validate + normalize an untrusted persisted value back into SrState. */
export function deserializeSrState(raw: unknown): SrState {
  if (!isRecord(raw) || !isRecord(raw.items)) return emptySrState()
  const items: Record<string, SrItem> = {}
  for (const [key, v] of Object.entries(raw.items)) {
    if (!isRecord(v)) continue
    if (
      typeof v.ease === 'number' &&
      typeof v.interval === 'number' &&
      typeof v.reps === 'number' &&
      typeof v.lapses === 'number' &&
      typeof v.dueAt === 'number' &&
      typeof v.reviews === 'number'
    ) {
      items[key] = {
        key,
        ease: v.ease,
        interval: v.interval,
        reps: v.reps,
        lapses: v.lapses,
        dueAt: v.dueAt,
        reviews: v.reviews,
        lastCorrect: v.lastCorrect === true,
      }
    }
  }
  return { items }
}

// ---- Stateful convenience wrapper -------------------------------------------

export interface Scheduler {
  /** Pick the next key to show. Mirrors `pickNextItem(state, rng, opts)`. */
  pickNext(rng: Rng, opts: PickNextOptions): string | undefined
  /** Record a review, mutating the scheduler's internal state. */
  recordReview(key: string, correct: boolean, now: number): SrItem
  /** The current immutable state (for reading). */
  getState(): SrState
  /** Replace the internal state (e.g. after loading from the store). */
  setState(state: SrState): void
  /** Serialize for persistence. */
  toState(): SrState
}

/**
 * Build a stateful scheduler around the pure functions above. Handy for modes
 * and the store: it owns one `SrState` and exposes `pickNext`/`recordReview`.
 * Still deterministic: you inject `rng` and `now`.
 */
export function makeScheduler(
  initial?: SrState,
  config: SrConfig = DEFAULT_SR_CONFIG,
): Scheduler {
  let state: SrState = initial ? serializeSrState(initial) : emptySrState()
  return {
    pickNext(rng, opts) {
      return pickNextItem(state, rng, { config, ...opts })
    },
    recordReview(key, correct, now) {
      state = reviewItem(state, key, correct, now, config)
      return state.items[key]
    },
    getState() {
      return state
    },
    setState(next) {
      state = serializeSrState(next)
    },
    toState() {
      return serializeSrState(state)
    },
  }
}

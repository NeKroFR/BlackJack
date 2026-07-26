// Heat / camouflage model for the live table.
//
// A pit boss watches for bet-to-bet *jumps*: ramping a $10 wager straight to
// $200 the moment the count turns is the classic counter tell. This tiny pure
// model tracks a 0..1 "heat" value that RISES when a bet leaps above the prior
// wager (proportional to how big the leap is) and COOLS whenever bets stay flat
// or drop. Keeping the spread smooth (or flat-betting through a shoe) cools
// you off. Spiking from the table minimum to the maximum lights you up.
//
// Pure and deterministic so it can be unit-tested and reasoned about.

export type HeatLevel = 'cool' | 'warm' | 'hot'

export interface HeatConfig {
  /** Heat added per unit of bet-ratio *excess* above 1 (a 2x bet adds `rise`). */
  rise: number
  /** Multiplier applied to heat on a flat-or-lower bet (the cool-down rate). */
  cool: number
}

/** A gentle default: a doubled bet adds ~0.2, each flat round sheds ~30%. */
export const DEFAULT_HEAT_CONFIG: HeatConfig = { rise: 0.2, cool: 0.7 }

function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

/**
 * Next heat value after wagering `newBet` when the previous wager was `prevBet`.
 * `prevBet <= 0` (the opening bet of a session) never adds heat and cools a touch.
 */
export function nextHeat(
  current: number,
  prevBet: number,
  newBet: number,
  config: HeatConfig = DEFAULT_HEAT_CONFIG,
): number {
  const c = clamp01(current)
  if (prevBet <= 0 || newBet <= 0) return clamp01(c * config.cool)
  const ratio = newBet / prevBet
  if (ratio <= 1) return clamp01(c * config.cool)
  return clamp01(c + (ratio - 1) * config.rise)
}

/** Bucket a heat value into a coarse level for display + advice. */
export function heatLevel(heat: number): HeatLevel {
  if (heat >= 0.66) return 'hot'
  if (heat >= 0.33) return 'warm'
  return 'cool'
}

export interface HeatMeta {
  label: string
  /** Semantic tone token for the meter fill. */
  tone: 'good' | 'warn' | 'bad'
  /** A one-line camouflage tip for this level. */
  tip: string
}

export const HEAT_META: Record<HeatLevel, HeatMeta> = {
  cool: {
    label: 'Cool',
    tone: 'good',
    tip: 'Your bets look natural. Ramp gradually as the count climbs.',
  },
  warm: {
    label: 'Warm',
    tone: 'warn',
    tip: 'The pit may be noticing your spread. Ease the jumps between hands.',
  },
  hot: {
    label: 'Hot',
    tone: 'bad',
    tip: 'Big bet jumps draw heat. Flatten for a few hands to cool off.',
  },
}

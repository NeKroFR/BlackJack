import type { Action } from '../../engine/types'

/** Presentation metadata for each player action, shared by ActionBar / Hud / Verdict. */
export interface ActionMeta {
  /** Button / badge label. */
  label: string
  /** Keyboard shortcut key (single, uppercase for display). */
  key: string
}

export const ACTION_META: Record<Action, ActionMeta> = {
  hit: { label: 'Hit', key: 'H' },
  stand: { label: 'Stand', key: 'S' },
  double: { label: 'Double', key: 'D' },
  split: { label: 'Split', key: 'P' },
  surrender: { label: 'Surrender', key: 'R' },
}

/** Left-to-right presentation order for the action bar. */
export const ACTION_ORDER: Action[] = ['hit', 'stand', 'double', 'split', 'surrender']

/** Lower-case keyboard key -> action, for keyboard dispatch. */
export const KEY_TO_ACTION: Record<string, Action> = {
  h: 'hit',
  s: 'stand',
  d: 'double',
  p: 'split',
  r: 'surrender',
}

/**
 * Format an EV (units of base bet) as a signed, fixed-precision string,
 * e.g. `+0.12` / `-0.29`. Uses tabular-friendly ASCII sign.
 */
export function formatEv(ev: number, decimals = 2): string {
  const sign = ev >= 0 ? '+' : '-'
  return sign + Math.abs(ev).toFixed(decimals)
}

/** Format a signed count, e.g. `+3`, `0`, `-2`. */
export function formatCount(n: number, decimals = 0): string {
  if (n === 0) return (0).toFixed(decimals)
  const sign = n > 0 ? '+' : '-'
  return sign + Math.abs(n).toFixed(decimals)
}

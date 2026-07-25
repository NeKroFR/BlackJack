// Chart palette helpers. Everything resolves to CSS custom properties so a
// runtime theme swap (light/dark) and the colorblind `.cb` mode flow through
// automatically. The tokens themselves are re-mapped in index.css.

import type { Action } from '../../engine/types'

/** Categorical series palette, in order. Distinct in light, dark and cb modes. */
export const CHART_TOKENS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
] as const

/** Nth categorical color, wrapping around the six-token palette. */
export function chartColor(i: number): string {
  const n = CHART_TOKENS.length
  return CHART_TOKENS[((i % n) + n) % n]
}

/**
 * Mix a color token toward the current surface. Because the second operand is
 * `var(--surface)`, the tint tracks the active theme: pale wash on a light
 * surface, muted shade on a dark one, keeping `--ink` text readable in both.
 * `pct` is how much of the source color survives (0..100).
 */
export function tint(token: string, pct: number): string {
  return `color-mix(in srgb, ${token} ${pct}%, var(--surface))`
}

export interface ActionStyle {
  /** Full action name for legends and tooltips. */
  label: string
  /** Single-letter cell glyph (H/S/D/P/R). */
  glyph: string
  /** Categorical color token for the action. cb-safe via the token remap. */
  token: string
}

/**
 * Fixed color + glyph per basic-strategy action. Mapped onto categorical chart
 * tokens so the five actions stay mutually distinct in the colorblind palette.
 */
export const ACTION_STYLE: Record<Action, ActionStyle> = {
  hit: { label: 'Hit', glyph: 'H', token: 'var(--chart-1)' },
  stand: { label: 'Stand', glyph: 'S', token: 'var(--chart-2)' },
  double: { label: 'Double', glyph: 'D', token: 'var(--chart-3)' },
  split: { label: 'Split', glyph: 'P', token: 'var(--chart-5)' },
  surrender: { label: 'Surrender', glyph: 'R', token: 'var(--chart-6)' },
}

/** Action display order for legends. */
export const ACTION_ORDER: Action[] = ['hit', 'stand', 'double', 'split', 'surrender']

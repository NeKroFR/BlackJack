// Small money/formatting helpers shared across the live-table components.

/** Whole-dollar amount, e.g. `$1,250`. Negatives render as `-$50`. */
export function money(n: number): string {
  const v = Math.round(n)
  const abs = Math.abs(v).toLocaleString()
  return v < 0 ? `-$${abs}` : `$${abs}`
}

/** Signed dollar amount for P/L readouts, e.g. `+$50`, `-$50`, `$0`. */
export function signedMoney(n: number): string {
  const v = Math.round(n)
  if (v === 0) return '$0'
  const abs = Math.abs(v).toLocaleString()
  return v > 0 ? `+$${abs}` : `-$${abs}`
}

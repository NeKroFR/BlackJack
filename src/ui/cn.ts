// className joiner. Drops falsy values, no deps.
export type ClassValue = string | number | false | null | undefined

export function cn(...values: ClassValue[]): string {
  let out = ''
  for (const v of values) {
    if (!v && v !== 0) continue
    out += (out ? ' ' : '') + v
  }
  return out
}

// Shared focus-ring for interactive primitives (keyboard a11y).
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]'

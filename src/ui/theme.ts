// Theme helpers. Presentational + store-independent: a store slice can call
// `applyTheme` whenever its persisted preferences change.

export type ThemeMode = 'light' | 'dark' | 'system'

/** Resolve the effective light/dark value, honoring the OS when mode is 'system'. */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

/**
 * Apply the theme to <html>:
 *  - sets `data-theme="light|dark"` (resolving 'system' via matchMedia so a hard
 *    value is always present for CSS specificity),
 *  - toggles the `.cb` colorblind-safe class.
 */
export function applyTheme(mode: ThemeMode, colorblind: boolean): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', resolveTheme(mode))
  root.classList.toggle('cb', colorblind)
}

/**
 * Subscribe to OS theme changes. Useful when `mode === 'system'`: re-run
 * `applyTheme` on change. Returns an unsubscribe function.
 */
export function watchSystemTheme(cb: (resolved: 'light' | 'dark') => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (e: MediaQueryListEvent) => cb(e.matches ? 'dark' : 'light')
  mql.addEventListener('change', handler)
  return () => mql.removeEventListener('change', handler)
}

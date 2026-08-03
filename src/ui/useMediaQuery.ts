import { useCallback, useSyncExternalStore } from 'react'

/**
 * Subscribe to a CSS media query. Returns false in environments without
 * `matchMedia` (jsdom under test), which keeps components on their
 * narrow-viewport branch there.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  }, [query])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/** Tailwind's `md` breakpoint: the point where the side-nav and wide layouts appear. */
export const MD_QUERY = '(min-width: 768px)'

/** True on tablet/desktop widths. */
export function useIsDesktop(): boolean {
  return useMediaQuery(MD_QUERY)
}

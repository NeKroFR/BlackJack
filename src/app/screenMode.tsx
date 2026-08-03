import { createContext, useContext, useEffect } from 'react'

/**
 * Lets a route tell the shell it manages its own height and must not scroll —
 * the live table, where the felt and the bet controls have to share one screen.
 * Off by default: every other route scrolls normally.
 */
const ImmersiveContext = createContext<((on: boolean) => void) | null>(null)

export const ImmersiveProvider = ImmersiveContext.Provider

/**
 * Opt the current route into the fixed, non-scrolling shell while `enabled`.
 * A no-op outside the app shell, so screens stay renderable in isolation.
 */
export function useImmersiveScreen(enabled: boolean): void {
  const setImmersive = useContext(ImmersiveContext)
  useEffect(() => {
    if (!setImmersive || !enabled) return
    setImmersive(true)
    return () => setImmersive(false)
  }, [setImmersive, enabled])
}

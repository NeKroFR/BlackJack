import { useCallback, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { play as enginePlay, setMasterVolume, unlock, warmUp, type SoundName } from './engine'

/**
 * Haptic feedback patterns (ms on/off) per cue, used when `settings.haptics`
 * is enabled and the device supports `navigator.vibrate`. Cues without an
 * entry produce no vibration.
 */
const VIBRATION: Partial<Record<SoundName, number | number[]>> = {
  deal: 8,
  flip: 10,
  chip: 12,
  chipStack: [12, 30, 12, 30, 12],
  win: [20, 40, 20],
  blackjack: [30, 40, 30, 40, 40],
  push: 15,
  lose: [40, 30, 40],
  bust: [60, 40, 60],
  correct: 15,
  incorrect: [30, 30, 30],
  click: 5,
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined') return
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }
  if (typeof nav.vibrate !== 'function') return
  try {
    nav.vibrate(pattern)
  } catch {
    // Some browsers throw if called outside a user gesture. Ignore.
  }
}

/**
 * Returns a stable `play(name)` callback that:
 *  - no-ops when `settings.sound` is false,
 *  - scales output by `settings.volume` (via the engine's master gain), and
 *  - triggers a matching `navigator.vibrate` pattern when `settings.haptics`
 *    is true (guarded for unsupported environments).
 *
 * The returned function is safe to call in any environment. On servers or in
 * jsdom (no AudioContext) the audio no-ops.
 */
export function useSound(): (name: SoundName) => void {
  const sound = useStore((s) => s.sound)
  const volume = useStore((s) => s.volume)
  const haptics = useStore((s) => s.haptics)

  // Keep the engine's master gain in sync with the user's volume so a single
  // GainNode scales every cue.
  useEffect(() => {
    setMasterVolume(volume)
  }, [volume])

  // Read the latest flags without re-creating the callback on every change.
  const ref = useRef({ sound, volume, haptics })
  ref.current = { sound, volume, haptics }

  return useCallback((name: SoundName) => {
    const s = ref.current
    if (s.haptics) {
      const pattern = VIBRATION[name]
      if (pattern != null) vibrate(pattern)
    }
    if (!s.sound || s.volume <= 0) return
    enginePlay(name)
  }, [])
}

/**
 * Installs one-shot app-wide listeners that unlock/warm up the AudioContext on
 * the first pointer or key interaction (satisfying the browser autoplay
 * policy). Renders/returns nothing. Mount once near the app root.
 */
export function useAudioUnlock(): void {
  const volume = useStore((s) => s.volume)

  useEffect(() => {
    let done = false
    const handler = () => {
      if (done) return
      done = true
      unlock()
      warmUp()
      setMasterVolume(volume)
      remove()
    }
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart']
    const remove = () => events.forEach((e) => window.removeEventListener(e, handler))
    events.forEach((e) => window.addEventListener(e, handler, { once: false, passive: true }))
    return remove
    // volume is read at unlock time only. Re-running on volume change would
    // needlessly re-arm listeners, so intentionally exclude it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/** Convenience no-render component wrapping {@link useAudioUnlock}. */
export function AudioUnlock(): null {
  useAudioUnlock()
  return null
}

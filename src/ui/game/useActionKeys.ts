import { useEffect, useRef } from 'react'
import { KEY_TO_ACTION } from './actions'
import type { Action } from '../../engine/types'

export interface ActionKeyHandlers {
  onHit?: () => void
  onStand?: () => void
  onDouble?: () => void
  onSplit?: () => void
  onSurrender?: () => void
  /** Space bar, typically "deal" / "next hand". */
  onSpace?: () => void
}

export interface UseActionKeysOptions {
  /** Listen only while true (default true). */
  enabled?: boolean
  /** Element to attach the listener to (default `window`). */
  target?: Window | HTMLElement | null
}

const ACTION_HANDLER: Record<Action, keyof ActionKeyHandlers> = {
  hit: 'onHit',
  stand: 'onStand',
  double: 'onDouble',
  split: 'onSplit',
  surrender: 'onSurrender',
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  )
}

/**
 * Wire H/S/D/P/R (and Space) to action callbacks. Handlers are read through a
 * ref so passing fresh closures every render does not re-subscribe the listener.
 * Ignores events with modifier keys or those originating from text inputs.
 * Removes its listener on unmount / when disabled.
 */
export function useActionKeys(
  handlers: ActionKeyHandlers,
  options: UseActionKeysOptions = {},
): void {
  const { enabled = true, target } = options
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    if (!enabled) return
    const node: Window | HTMLElement =
      target === undefined ? window : (target as Window | HTMLElement)
    if (!node) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.repeat) return
      if (isTypingTarget(e.target)) return

      const current = ref.current
      if (e.key === ' ' || e.key === 'Spacebar') {
        if (current.onSpace) {
          e.preventDefault()
          current.onSpace()
        }
        return
      }

      const action = KEY_TO_ACTION[e.key.toLowerCase()]
      if (!action) return
      const fn = current[ACTION_HANDLER[action]]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }

    node.addEventListener('keydown', onKeyDown as EventListener)
    return () => node.removeEventListener('keydown', onKeyDown as EventListener)
  }, [enabled, target])
}

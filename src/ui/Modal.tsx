import { useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { cn } from './cn'
import { IconButton } from './IconButton'

export type ModalSize = 'sm' | 'md' | 'lg'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: ModalSize
  /** Close when clicking the backdrop (default true). */
  dismissOnBackdrop?: boolean
  /** Show the corner close button (default true). */
  showClose?: boolean
}

const sizes: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Focus-trapped dialog. Esc closes. Focus returns to the opener on close. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  dismissOnBackdrop = true,
  showClose = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  const focusFirst = useCallback(() => {
    const node = dialogRef.current
    if (!node) return
    const focusables = node.querySelectorAll<HTMLElement>(FOCUSABLE)
    ;(focusables[0] ?? node).focus()
  }, [])

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    // Focus after paint so the portal content exists.
    const raf = requestAnimationFrame(focusFirst)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const node = dialogRef.current
      if (!node) return
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (focusables.length === 0) {
        e.preventDefault()
        node.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === node)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, onClose, focusFirst])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full rounded-2xl border border-border bg-panel shadow-[var(--shadow-lg)]',
          'flex max-h-[calc(100dvh-2rem)] flex-col outline-none',
          sizes[size],
        )}
      >
        {(title || showClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            {title && (
              <h2 id={titleId} className="text-lg font-semibold tracking-tight text-ink">
                {title}
              </h2>
            )}
            {showClose && (
              <IconButton label="Close" size="sm" variant="ghost" onClick={onClose} className="-mr-1 -mt-1">
                <span aria-hidden className="text-lg leading-none">×</span>
              </IconButton>
            )}
          </div>
        )}
        <div className="overflow-y-auto p-5 text-ink">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border p-5">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}

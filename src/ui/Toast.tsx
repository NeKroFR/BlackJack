import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { cn } from './cn'

export type ToastVariant = 'neutral' | 'good' | 'bad' | 'warn' | 'accent'

export interface ToastOptions {
  title?: ReactNode
  message?: ReactNode
  variant?: ToastVariant
  /** Auto-dismiss delay in ms. 0 disables auto-dismiss. Default 4000. */
  duration?: number
}

interface ToastRecord extends Required<Pick<ToastOptions, 'variant'>> {
  id: number
  title?: ReactNode
  message?: ReactNode
  duration: number
}

export interface ToastApi {
  /** Show a toast, returns its id. */
  toast: (opts: ToastOptions) => number
  dismiss: (id: number) => void
  clear: () => void
}

const ToastContext = createContext<ToastApi | null>(null)

const accents: Record<ToastVariant, string> = {
  neutral: 'border-l-border',
  good: 'border-l-good',
  bad: 'border-l-bad',
  warn: 'border-l-warn',
  accent: 'border-l-accent',
}

const dotColors: Record<ToastVariant, string> = {
  neutral: 'bg-ink-muted',
  good: 'bg-good',
  bad: 'bg-bad',
  warn: 'bg-warn',
  accent: 'bg-accent',
}

/** Wrap the app (or a subtree) to enable `useToast()`. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const idRef = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = ++idRef.current
      const record: ToastRecord = {
        id,
        title: opts.title,
        message: opts.message,
        variant: opts.variant ?? 'neutral',
        duration: opts.duration ?? 4000,
      }
      setToasts((list) => [...list, record])
      if (record.duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), record.duration),
        )
      }
      return id
    },
    [dismiss],
  )

  const clear = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current.clear()
    setToasts([])
  }, [])

  const api = useMemo<ToastApi>(() => ({ toast, dismiss, clear }), [toast, dismiss, clear])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
            role="region"
            aria-label="Notifications"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                role="status"
                aria-live="polite"
                className={cn(
                  'pointer-events-auto flex items-start gap-3 rounded-xl border border-l-4 border-border bg-panel p-3',
                  'shadow-[var(--shadow-lg)] animate-in',
                  accents[t.variant],
                )}
              >
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dotColors[t.variant])} aria-hidden />
                <div className="min-w-0 flex-1">
                  {t.title && <p className="text-sm font-semibold text-ink">{t.title}</p>}
                  {t.message && <p className="text-sm text-ink-muted">{t.message}</p>}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 rounded-md px-1 text-ink-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span aria-hidden className="text-base leading-none">×</span>
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}

/** Access the toast API. Must be called within a <ToastProvider>. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>')
  return ctx
}

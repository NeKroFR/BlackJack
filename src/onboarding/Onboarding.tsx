import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Button, Text, cn, focusRing } from '../ui'
import { useStore } from '../store'
import { useSound } from '../audio'

interface Step {
  /** Decorative pip/emblem shown in the felt header. */
  emblem: ReactNode
  title: string
  body: string
  /** Optional inline shortcut rendered under the body. */
  shortcut?: { label: string; to: string }
}

const SpadeEmblem = (
  <svg viewBox="0 0 64 64" width="52" height="52" aria-hidden="true">
    <path
      d="M32 8c-8 11-19 16-19 27a11 11 0 0 0 16.5 9.5C29 49 27.4 52 25 54h14c-2.4-2-4-5-4.5-9.5A11 11 0 0 0 51 35C51 24 40 19 32 8Z"
      fill="var(--felt-ink)"
    />
  </svg>
)
const PathEmblem = (
  <svg viewBox="0 0 64 64" width="52" height="52" fill="none" stroke="var(--felt-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 50c0-10 8-12 16-14s16-4 16-14" />
    <circle cx="16" cy="50" r="4" fill="var(--felt-ink)" />
    <circle cx="48" cy="22" r="4" fill="var(--felt-ink)" />
    <path d="M40 46l8 6 8-6" opacity="0.55" />
  </svg>
)
const ChipEmblem = (
  <svg viewBox="0 0 64 64" width="52" height="52" fill="none" stroke="var(--felt-ink)" strokeWidth="4" aria-hidden="true">
    <circle cx="32" cy="32" r="22" />
    <circle cx="32" cy="32" r="12" strokeDasharray="4 5" />
    <path d="M32 10v8M32 46v8M10 32h8M46 32h8" strokeLinecap="round" />
  </svg>
)

const STEPS: Step[] = [
  {
    emblem: SpadeEmblem,
    title: 'Welcome to Blackjack Trainer',
    body:
      'A free, private, offline-first coach for card counting and basic strategy. Every piece of advice is computed by an exact expected-value engine — no memorized charts, just the real math.',
  },
  {
    emblem: PathEmblem,
    title: 'Learn, then drill',
    body:
      'Start on the Learn path for a guided curriculum, then sharpen up in the Strategy, Count, and Deviations drills. Missed hands resurface more often so weak spots fix themselves.',
    shortcut: { label: 'Open the Learn path', to: '/learn' },
  },
  {
    emblem: ChipEmblem,
    title: 'Play & tune the rules',
    body:
      'Take it to the felt in the Live game to keep your own count, then shape the shoe — decks, S17/H17, surrender, penetration — in Settings so every drill matches the game you play.',
    shortcut: { label: 'Review rules in Settings', to: '/settings' },
  },
]

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * First-run welcome. Renders once (gated by settings.seenOnboarding), is fully
 * skippable, and marks itself seen on finish or skip so returning users never
 * see it again. Focus-trapped, Esc-to-skip, and reduced-motion friendly.
 */
export default function Onboarding() {
  const seen = useStore((s) => s.seenOnboarding)
  const setSeen = useStore((s) => s.setSeenOnboarding)
  const navigate = useNavigate()
  const play = useSound()

  const [index, setIndex] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  const isLast = index === STEPS.length - 1
  const step = STEPS[index]

  const dismiss = useCallback(
    (viaFinish: boolean) => {
      play(viaFinish ? 'chip' : 'click')
      setSeen(true)
    },
    [play, setSeen],
  )

  const next = useCallback(() => {
    if (isLast) {
      dismiss(true)
      return
    }
    play('deal')
    setIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }, [isLast, dismiss, play])

  const back = useCallback(() => {
    play('click')
    setIndex((i) => Math.max(i - 1, 0))
  }, [play])

  const goShortcut = useCallback(
    (to: string) => {
      dismiss(true)
      navigate(to)
    },
    [dismiss, navigate],
  )

  // Focus management + Esc/Tab trap, mirroring the Modal primitive.
  useEffect(() => {
    if (seen) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const raf = requestAnimationFrame(() => {
      const node = dialogRef.current
      const first = node?.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? node)?.focus()
    })
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        dismiss(false)
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
      const firstEl = focusables[0]
      const lastEl = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === firstEl || active === node)) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [seen, dismiss])

  const dots = useMemo(() => STEPS.map((_, i) => i), [])

  if (seen || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[3px] onboarding-backdrop" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-panel',
          'shadow-[var(--shadow-lg)] outline-none onboarding-card',
        )}
      >
        {/* Felt header with emblem */}
        <div className="felt-texture relative flex h-40 items-center justify-center">
          <button
            type="button"
            onClick={() => dismiss(false)}
            className={cn(
              'absolute right-3 top-3 rounded-lg px-2.5 py-1 text-sm font-medium text-[var(--felt-ink)]/80',
              'hover:bg-white/10 hover:text-[var(--felt-ink)] transition-colors',
              focusRing,
            )}
          >
            Skip
          </button>
          <div key={index} className="onboarding-emblem">
            {step.emblem}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div key={index} className="onboarding-copy">
            <Text as="h2" size="lg" weight="semibold" className="tracking-tight" id="onboarding-title">
              {step.title}
            </Text>
            <Text tone="muted" className="mt-2 leading-relaxed">
              {step.body}
            </Text>
            {step.shortcut && (
              <button
                type="button"
                onClick={() => goShortcut(step.shortcut!.to)}
                className={cn(
                  'mt-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-accent',
                  'hover:text-accent-hover transition-colors',
                  focusRing,
                )}
              >
                {step.shortcut.label}
                <span aria-hidden>→</span>
              </button>
            )}
          </div>

          {/* Progress dots */}
          <div className="mt-6 flex items-center justify-center gap-2" aria-hidden>
            {dots.map((i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-200',
                  i === index ? 'w-5 bg-accent' : 'w-1.5 bg-border',
                )}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={back}
              disabled={index === 0}
              className={cn(index === 0 && 'invisible')}
            >
              Back
            </Button>
            <Text size="xs" tone="muted" numeric>
              {index + 1} / {STEPS.length}
            </Text>
            <Button variant="primary" onClick={next}>
              {isLast ? 'Start' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

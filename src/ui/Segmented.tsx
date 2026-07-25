import { useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { cn, focusRing } from './cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Optional accessible label when `label` is an icon. */
  ariaLabel?: string
  disabled?: boolean
}

export type SegmentedSize = 'sm' | 'md'

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible group label. */
  label?: string
  size?: SegmentedSize
  block?: boolean
  className?: string
}

const sizes: Record<SegmentedSize, string> = {
  sm: 'h-8 text-xs',
  md: 'h-10 text-sm',
}

/** Single-select pill group. Arrow keys move selection (roving radiogroup). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  block,
  className,
}: SegmentedProps<T>) {
  const groupId = useId()
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])

  function move(dir: 1 | -1, from: number) {
    const n = options.length
    for (let step = 1; step <= n; step++) {
      const idx = (from + dir * step + n * step) % n
      if (!options[idx].disabled) {
        onChange(options[idx].value)
        btnRefs.current[idx]?.focus()
        return
      }
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-border bg-surface-2 p-1',
        block && 'flex w-full',
        className,
      )}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            ref={(el) => {
              btnRefs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.ariaLabel}
            disabled={opt.disabled}
            tabIndex={selected ? 0 : -1}
            id={`${groupId}-${opt.value}`}
            onClick={() => !opt.disabled && onChange(opt.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault()
                move(1, i)
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault()
                move(-1, i)
              }
            }}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 font-medium whitespace-nowrap',
              'transition duration-150 ease-out disabled:opacity-40 disabled:pointer-events-none',
              sizes[size],
              selected
                ? 'bg-panel text-ink shadow-[var(--shadow-sm)]'
                : 'text-ink-muted hover:text-ink',
              focusRing,
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

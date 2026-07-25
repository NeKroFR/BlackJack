import { useId } from 'react'
import type { ReactNode } from 'react'
import { cn, focusRing } from './cn'

export type ToggleSize = 'sm' | 'md'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Visible label rendered beside the switch. */
  label?: ReactNode
  /** Accessible label when no visible `label` is provided. */
  ariaLabel?: string
  description?: ReactNode
  disabled?: boolean
  size?: ToggleSize
  className?: string
}

const trackSizes: Record<ToggleSize, string> = {
  sm: 'h-5 w-9',
  md: 'h-6 w-11',
}
const thumbSizes: Record<ToggleSize, string> = {
  sm: 'h-4 w-4 data-[on=true]:translate-x-4',
  md: 'h-5 w-5 data-[on=true]:translate-x-5',
}

/** Accessible on/off switch (role="switch"). */
export function Toggle({
  checked,
  onChange,
  label,
  ariaLabel,
  description,
  disabled,
  size = 'md',
  className,
}: ToggleProps) {
  const descId = useId()
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      aria-describedby={description ? descId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border border-transparent p-0.5',
        'transition-colors duration-150 ease-out disabled:opacity-50 disabled:pointer-events-none',
        checked ? 'bg-accent' : 'bg-surface-2 border-border',
        trackSizes[size],
        focusRing,
      )}
    >
      <span
        data-on={checked}
        className={cn(
          'pointer-events-none inline-block rounded-full bg-white shadow-[var(--shadow-sm)]',
          'transition-transform duration-150 ease-out',
          thumbSizes[size],
        )}
      />
    </button>
  )

  if (!label && !description) return <span className={className}>{control}</span>

  return (
    <label className={cn('flex cursor-pointer items-center justify-between gap-3', className)}>
      <span className="flex flex-col">
        {label && <span className="text-sm font-medium text-ink">{label}</span>}
        {description && (
          <span id={descId} className="text-xs text-ink-muted">
            {description}
          </span>
        )}
      </span>
      {control}
    </label>
  )
}

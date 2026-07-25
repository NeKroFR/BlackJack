import { useId } from 'react'
import type { ReactNode } from 'react'
import { cn, focusRing } from './cn'
import { IconButton } from './IconButton'

export interface NumberStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: ReactNode
  /** Format the displayed value (e.g. currency). Editing uses the raw number. */
  formatValue?: (value: number) => string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** Numeric input with decrement/increment buttons. */
export function NumberStepper({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  label,
  formatValue,
  disabled,
  size = 'md',
  className,
}: NumberStepperProps) {
  const inputId = useId()
  const set = (n: number) => onChange(clamp(n, min, max))

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
        <IconButton
          label="Decrease"
          size={size}
          variant="ghost"
          disabled={disabled || value <= min}
          onClick={() => set(value - step)}
        >
          <span aria-hidden className="text-lg leading-none">−</span>
        </IconButton>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={formatValue ? formatValue(value) : String(value)}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/[^0-9.\-]/g, ''))
            if (!Number.isNaN(n)) set(n)
          }}
          className={cn(
            'w-16 bg-transparent text-center text-sm font-medium tabular-nums text-ink outline-none',
            'rounded-md py-1',
            focusRing,
          )}
        />
        <IconButton
          label="Increase"
          size={size}
          variant="ghost"
          disabled={disabled || value >= max}
          onClick={() => set(value + step)}
        >
          <span aria-hidden className="text-lg leading-none">+</span>
        </IconButton>
      </div>
    </div>
  )
}

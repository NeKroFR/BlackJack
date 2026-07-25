import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: ReactNode
  /** Format the current value for display. */
  formatValue?: (value: number) => ReactNode
  showValue?: boolean
}

/**
 * Range input with a filled track. Fill uses a CSS var to stay
 * theme-aware. Keyboard support is native to <input type="range">.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { value, onChange, min = 0, max = 100, step = 1, label, formatValue, showValue = true, className, id, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label htmlFor={inputId} className="text-sm font-medium text-ink">
              {label}
            </label>
          )}
          {showValue && (
            <span className="text-sm tabular-nums text-ink-muted">
              {formatValue ? formatValue(value) : value}
            </span>
          )}
        </div>
      )}
      <input
        ref={ref}
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--surface-2) ${pct}%, var(--surface-2) 100%)`,
        }}
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-full border border-border',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[var(--shadow-sm)]',
          '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white',
        )}
        {...rest}
      />
    </div>
  )
})

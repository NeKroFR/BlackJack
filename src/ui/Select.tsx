import { forwardRef, useId } from 'react'
import type { ReactNode, SelectHTMLAttributes } from 'react'
import { cn, focusRing } from './cn'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: ReactNode
  /** Provide options declaratively, or pass <option> children instead. */
  options?: SelectOption[]
  selectSize?: 'sm' | 'md'
}

const sizes = {
  sm: 'h-8 text-xs pl-3 pr-8',
  md: 'h-10 text-sm pl-3 pr-9',
}

/** Styled native <select> (keeps native keyboard + accessibility behavior). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, selectSize = 'md', className, id, children, ...rest },
  ref,
) {
  const autoId = useId()
  const selectId = id ?? autoId

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <div className="relative inline-flex">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full appearance-none rounded-xl border border-border bg-surface font-medium text-ink',
            'transition duration-150 ease-out hover:bg-surface-2 disabled:opacity-50',
            sizes[selectSize],
            focusRing,
            className,
          )}
          {...rest}
        >
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))
            : children}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted"
        >
          ▾
        </span>
      </div>
    </div>
  )
})

import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export type PanelPadding = 'none' | 'sm' | 'md' | 'lg'
export type PanelElevation = 'flat' | 'raised' | 'floating'

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  padding?: PanelPadding
  elevation?: PanelElevation
  /** Draw a hairline border (default true). */
  bordered?: boolean
  /** Use the slightly recessed surface-2 background. */
  inset?: boolean
}

const paddings: Record<PanelPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

const elevations: Record<PanelElevation, string> = {
  flat: '',
  raised: 'shadow-[var(--shadow-sm)]',
  floating: 'shadow-[var(--shadow-md)]',
}

/** Generic elevated surface. `Card` is a semantic alias with the same API. */
export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { padding = 'md', elevation = 'flat', bordered = true, inset, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl',
        inset ? 'bg-surface-2' : 'bg-panel',
        bordered && 'border border-border',
        paddings[padding],
        elevations[elevation],
        className,
      )}
      {...rest}
    />
  )
})

export const Card = Panel

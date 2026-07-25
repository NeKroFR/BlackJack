import { cn } from './cn'

export type SpinnerSize = 'sm' | 'md' | 'lg'

export interface SpinnerProps {
  size?: SpinnerSize
  /** Accessible label announced to screen readers. */
  label?: string
  className?: string
}

const sizes: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-9 w-9 border-[3px]',
}

/** Indeterminate loading spinner. Honors prefers-reduced-motion via base CSS. */
export function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)}>
      <span
        className={cn(
          'inline-block animate-spin rounded-full border-current border-t-transparent text-accent',
          sizes[size],
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}

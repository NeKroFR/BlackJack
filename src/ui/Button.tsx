import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn, focusRing } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Stretch to fill the container width. */
  block?: boolean
  /** Leading adornment (icon). */
  leading?: ReactNode
  /** Trailing adornment (icon / KeyHint). */
  trailing?: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border ' +
  'font-medium transition duration-150 ease-out select-none ' +
  'disabled:opacity-50 disabled:pointer-events-none'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-ink border-transparent shadow-sm hover:bg-accent-hover active:brightness-95',
  secondary:
    'bg-surface text-ink border-border hover:bg-surface-2 active:brightness-95',
  ghost:
    'bg-transparent text-ink border-transparent hover:bg-surface-2 active:brightness-95',
  danger:
    'bg-bad text-bad-ink border-transparent shadow-sm hover:brightness-110 active:brightness-95',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block, leading, trailing, className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(base, variants[variant], sizes[size], block && 'w-full', focusRing, className)}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  )
})

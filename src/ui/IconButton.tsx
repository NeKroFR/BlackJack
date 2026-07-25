import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn, focusRing } from './cn'
import type { ButtonVariant } from './Button'

export type IconButtonSize = 'sm' | 'md' | 'lg'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name, required since there's no visible text. */
  label: string
  variant?: ButtonVariant
  size?: IconButtonSize
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center rounded-lg border transition duration-150 ease-out ' +
  'select-none disabled:opacity-50 disabled:pointer-events-none'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink border-transparent shadow-sm hover:bg-accent-hover',
  secondary: 'bg-surface text-ink border-border hover:bg-surface-2',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-surface-2',
  danger: 'bg-bad text-bad-ink border-transparent shadow-sm hover:brightness-110',
}

const sizes: Record<IconButtonSize, string> = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(base, variants[variant], sizes[size], focusRing, className)}
      {...rest}
    >
      {children}
    </button>
  )
})

import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export type BadgeVariant = 'neutral' | 'accent' | 'good' | 'bad' | 'warn' | 'outline'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
}

const variants: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-2 text-ink border-transparent',
  accent: 'bg-accent text-accent-ink border-transparent',
  good: 'bg-good text-good-ink border-transparent',
  bad: 'bg-bad text-bad-ink border-transparent',
  warn: 'bg-warn text-warn-ink border-transparent',
  outline: 'bg-transparent text-ink border-border',
}

const sizes: Record<BadgeSize, string> = {
  sm: 'h-5 px-2 text-[0.6875rem]',
  md: 'h-6 px-2.5 text-xs',
}

export function Badge({ variant = 'neutral', size = 'md', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  )
}

import { forwardRef } from 'react'
import type { ElementType, HTMLAttributes } from 'react'
import { cn } from './cn'

export type TextSize = 'xs' | 'sm' | 'md' | 'lg'
export type TextTone = 'default' | 'muted' | 'accent' | 'good' | 'bad' | 'warn'
export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold'

const sizeMap: Record<TextSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

const toneMap: Record<TextTone, string> = {
  default: 'text-ink',
  muted: 'text-ink-muted',
  accent: 'text-accent',
  good: 'text-good',
  bad: 'text-bad',
  warn: 'text-warn',
}

const weightMap: Record<TextWeight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
}

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  size?: TextSize
  tone?: TextTone
  weight?: TextWeight
  /** Tabular figures: align digits in tables and readouts. */
  numeric?: boolean
}

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { as, size = 'md', tone = 'default', weight = 'normal', numeric, className, ...rest },
  ref,
) {
  const Comp = (as ?? 'p') as ElementType
  return (
    <Comp
      ref={ref}
      className={cn(
        sizeMap[size],
        toneMap[tone],
        weightMap[weight],
        numeric && 'tabular-nums [font-variant-numeric:tabular-nums]',
        className,
      )}
      {...rest}
    />
  )
})

export type HeadingLevel = 1 | 2 | 3 | 4

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel
}

const headingStyles: Record<HeadingLevel, string> = {
  1: 'text-3xl font-semibold tracking-tight',
  2: 'text-2xl font-semibold tracking-tight',
  3: 'text-xl font-semibold tracking-tight',
  4: 'text-base font-semibold',
}

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  { level = 2, className, ...rest },
  ref,
) {
  const Comp = `h${level}` as ElementType
  return <Comp ref={ref} className={cn('text-ink', headingStyles[level], className)} {...rest} />
})

import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export type Gap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8
export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline'
export type Justify = 'start' | 'center' | 'end' | 'between' | 'around'

const gapMap: Record<Gap, string> = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-6',
  6: 'gap-8',
  8: 'gap-12',
}

const alignMap: Record<Align, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
}

const justifyMap: Record<Justify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
}

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: Gap
  align?: Align
  justify?: Justify
}

/** Vertical flex layout helper. */
export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
  { gap = 4, align, justify, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col',
        gapMap[gap],
        align && alignMap[align],
        justify && justifyMap[justify],
        className,
      )}
      {...rest}
    />
  )
})

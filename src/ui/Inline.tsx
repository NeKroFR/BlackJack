import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { cn } from './cn'
import type { Align, Gap, Justify } from './Stack'

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
}

const justifyMap: Record<Justify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
}

export interface InlineProps extends HTMLAttributes<HTMLDivElement> {
  gap?: Gap
  align?: Align
  justify?: Justify
  wrap?: boolean
}

/** Horizontal flex layout helper. */
export const Inline = forwardRef<HTMLDivElement, InlineProps>(function Inline(
  { gap = 2, align = 'center', justify, wrap, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-row',
        wrap && 'flex-wrap',
        gapMap[gap],
        alignMap[align],
        justify && justifyMap[justify],
        className,
      )}
      {...rest}
    />
  )
})

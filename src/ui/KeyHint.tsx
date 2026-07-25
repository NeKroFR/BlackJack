import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export interface KeyHintProps extends HTMLAttributes<HTMLElement> {
  /** The key to display, e.g. "H", "Enter", "Esc", "↑". */
  keyName?: string
  size?: 'sm' | 'md'
}

const sizes = {
  sm: 'h-4 min-w-4 px-1 text-[0.625rem]',
  md: 'h-5 min-w-5 px-1.5 text-xs',
}

/** Keyboard-key chip for shortcut hints. */
export function KeyHint({ keyName, size = 'md', className, children, ...rest }: KeyHintProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center rounded-md border border-border bg-surface-2',
        'font-medium text-ink-muted shadow-[inset_0_-1px_0_var(--border)]',
        '[font-family:inherit]',
        sizes[size],
        className,
      )}
      {...rest}
    >
      {keyName ?? children}
    </kbd>
  )
}

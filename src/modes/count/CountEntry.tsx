import { useEffect, useRef, useState } from 'react'
import { Button, Inline, KeyHint, Text } from '../../ui'
import { cn } from '../../ui'

export interface CountEntryProps {
  /** Caption above the field, e.g. "Running count". */
  label: string
  onSubmit: (value: number) => void
  /** Submit button label (defaults to "Submit"). */
  submitLabel?: string
  autoFocus?: boolean
}

/**
 * A large, keyboard-first signed-integer entry for counts. Accepts digits and a
 * leading minus. Enter (or the button) submits. Big touch targets step the
 * value for mobile.
 */
export function CountEntry({ label, onSubmit, submitLabel = 'Submit', autoFocus = true }: CountEntryProps) {
  const [raw, setRaw] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const valid = /^-?\d+$/.test(raw)
  const value = valid ? Number(raw) : 0

  function submit() {
    if (!valid) return
    onSubmit(value)
  }

  function bump(delta: number) {
    setRaw(String((valid ? value : 0) + delta))
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Text size="sm" tone="muted" weight="medium" className="uppercase tracking-wide">
        {label}
      </Text>
      <Inline gap={3} align="center">
        <Button variant="secondary" size="lg" aria-label="Decrease" onClick={() => bump(-1)}>
          −
        </Button>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          aria-label={label}
          value={raw}
          placeholder="0"
          onChange={(e) => {
            const v = e.target.value
            if (v === '' || v === '-' || /^-?\d+$/.test(v)) setRaw(v)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              bump(1)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              bump(-1)
            }
          }}
          className={cn(
            'h-20 w-32 rounded-xl border border-border bg-surface text-center',
            'text-5xl font-semibold tabular-nums text-ink',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
          )}
        />
        <Button variant="secondary" size="lg" aria-label="Increase" onClick={() => bump(1)}>
          +
        </Button>
      </Inline>
      <Button
        variant="primary"
        size="lg"
        disabled={!valid}
        onClick={submit}
        trailing={<KeyHint keyName="Enter" />}
      >
        {submitLabel}
      </Button>
    </div>
  )
}

import { Button } from '../Button'
import type { ButtonSize, ButtonVariant } from '../Button'
import { KeyHint } from '../KeyHint'
import { Inline } from '../Inline'
import { cn } from '../cn'
import { ACTION_META, ACTION_ORDER } from './actions'
import { useActionKeys } from './useActionKeys'
import type { ActionKeyHandlers } from './useActionKeys'
import type { Action } from '../../engine/types'

/** Configuration for a single action button. */
export interface ActionSlot {
  onClick: () => void
  /** Rendered but non-interactive (illegal this hand). */
  disabled?: boolean
  /** Not offered. Omit the button entirely. */
  hidden?: boolean
}

export interface ActionBarProps {
  hit: ActionSlot
  stand: ActionSlot
  double?: ActionSlot
  split?: ActionSlot
  surrender?: ActionSlot
  /** Style this action as the primary (accent) button, e.g. the advised play. */
  recommend?: Action
  /** Bind H/S/D/P/R keyboard shortcuts (default true). Disabled/hidden slots are skipped. */
  keyboard?: boolean
  /** Optional Space-bar handler, e.g. deal the next hand. */
  onSpace?: () => void
  size?: ButtonSize
  /** Stretch each button to share the row equally. */
  block?: boolean
  /**
   * `row` wraps the actions inline. `grid` stacks Hit/Stand as two large
   * thumb targets over a row of the remaining options and drops the key hints —
   * the touch layout.
   */
  layout?: 'row' | 'grid'
  className?: string
}

/** Split of the action set used by the touch layout. */
const PRIMARY_ACTIONS: Action[] = ['hit', 'stand']
const SECONDARY_ACTIONS: Action[] = ['double', 'split', 'surrender']

const SLOT_KEYS = {
  hit: 'hit',
  stand: 'stand',
  double: 'double',
  split: 'split',
  surrender: 'surrender',
} as const

/**
 * Row of Hit / Stand / Double / Split / Surrender buttons, each with its
 * keyboard hint. Illegal actions are disabled via `disabled`. Actions the hand
 * never offers are removed via `hidden`. Binds H/S/D/P/R by default.
 */
export function ActionBar({
  hit,
  stand,
  double,
  split,
  surrender,
  recommend,
  keyboard = true,
  onSpace,
  size = 'md',
  block,
  layout = 'row',
  className,
}: ActionBarProps) {
  const slots: Record<Action, ActionSlot | undefined> = {
    hit,
    stand,
    double,
    split,
    surrender,
  }

  // Only bind a key when the matching slot exists, is visible, and is enabled.
  const handlerFor = (action: Action): (() => void) | undefined => {
    const slot = slots[action]
    if (!slot || slot.hidden || slot.disabled) return undefined
    return slot.onClick
  }

  const keyHandlers: ActionKeyHandlers = {
    onHit: handlerFor('hit'),
    onStand: handlerFor('stand'),
    onDouble: handlerFor('double'),
    onSplit: handlerFor('split'),
    onSurrender: handlerFor('surrender'),
    onSpace,
  }
  useActionKeys(keyHandlers, { enabled: keyboard })

  const variantFor = (action: Action): ButtonVariant => {
    if (recommend === action) return 'primary'
    return action === 'surrender' ? 'ghost' : 'secondary'
  }

  if (layout === 'grid') {
    const visible = (list: Action[]) => list.filter((a) => slots[a] && !slots[a]!.hidden)
    const primary = visible(PRIMARY_ACTIONS)
    const secondary = visible(SECONDARY_ACTIONS)

    // Ghost has no border, which reads as a broken cell in a grid — every
    // touch target here gets a visible edge unless it is the advised play.
    const cell = (action: Action, height: string) => {
      const slot = slots[action]!
      return (
        <Button
          key={action}
          variant={recommend === action ? 'primary' : 'secondary'}
          block
          disabled={slot.disabled}
          onClick={slot.onClick}
          className={cn(height, 'px-2')}
        >
          {ACTION_META[action].label}
        </Button>
      )
    }

    return (
      <div
        role="group"
        aria-label="Player actions"
        className={cn('flex w-full flex-col gap-2', className)}
      >
        {primary.length > 0 && (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${primary.length}, minmax(0, 1fr))` }}
          >
            {primary.map((a) => cell(a, 'h-13 text-base'))}
          </div>
        )}
        {secondary.length > 0 && (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${secondary.length}, minmax(0, 1fr))` }}
          >
            {secondary.map((a) => cell(a, 'h-11 text-sm'))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Inline
      role="group"
      aria-label="Player actions"
      gap={2}
      wrap
      className={cn(block && 'w-full', className)}
    >
      {ACTION_ORDER.map((action) => {
        const slot = slots[SLOT_KEYS[action]]
        if (!slot || slot.hidden) return null
        const meta = ACTION_META[action]
        return (
          <Button
            key={action}
            variant={variantFor(action)}
            size={size}
            block={block}
            disabled={slot.disabled}
            onClick={slot.onClick}
            trailing={<KeyHint keyName={meta.key} size={size === 'sm' ? 'sm' : 'md'} />}
          >
            {meta.label}
          </Button>
        )
      })}
    </Inline>
  )
}

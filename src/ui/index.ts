// Design-system barrel. Presentational, store-independent primitives + theming.

export { cn, focusRing } from './cn'
export type { ClassValue } from './cn'

export { applyTheme, resolveTheme, watchSystemTheme } from './theme'
export type { ThemeMode } from './theme'

export { Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'

export { IconButton } from './IconButton'
export type { IconButtonProps, IconButtonSize } from './IconButton'

export { Panel, Card } from './Panel'
export type { PanelProps, PanelPadding, PanelElevation } from './Panel'

export { Text, Heading } from './Text'
export type {
  TextProps,
  TextSize,
  TextTone,
  TextWeight,
  HeadingProps,
  HeadingLevel,
} from './Text'

export { Stack } from './Stack'
export type { StackProps, Gap, Align, Justify } from './Stack'

export { Inline } from './Inline'
export type { InlineProps } from './Inline'

export { Segmented } from './Segmented'
export type { SegmentedProps, SegmentedOption, SegmentedSize } from './Segmented'

export { Toggle } from './Toggle'
export type { ToggleProps, ToggleSize } from './Toggle'

export { Slider } from './Slider'
export type { SliderProps } from './Slider'

export { NumberStepper } from './NumberStepper'
export type { NumberStepperProps } from './NumberStepper'

export { Select } from './Select'
export type { SelectProps, SelectOption } from './Select'

export { Badge } from './Badge'
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge'

export { Modal } from './Modal'
export type { ModalProps, ModalSize } from './Modal'

export { ToastProvider, useToast } from './Toast'
export type { ToastApi, ToastOptions, ToastVariant } from './Toast'

export { Spinner } from './Spinner'
export type { SpinnerProps, SpinnerSize } from './Spinner'

export { KeyHint } from './KeyHint'
export type { KeyHintProps } from './KeyHint'

// Table visuals (cards, hands, chips, seats).
export { PlayingCard, CardHand, Chip, ChipStack, Seat, Felt } from './table'
export type {
  PlayingCardProps,
  PlayingCardSize,
  CardHandProps,
  ChipProps,
  ChipStackProps,
  ChipSize,
  SeatProps,
  SeatResult,
  FeltProps,
} from './table'

// Game-feedback components (count HUD, action bar, verdict)
export { Hud, ActionBar, useActionKeys, Verdict } from './game'
export type {
  HudProps,
  HudVariant,
  HudAdvice,
  ActionBarProps,
  ActionSlot,
  ActionKeyHandlers,
  UseActionKeysOptions,
  VerdictProps,
} from './game'

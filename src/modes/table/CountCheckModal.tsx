import { useEffect, useState } from 'react'
import { Modal } from '../../ui/Modal'
import { Text } from '../../ui/Text'
import { Button } from '../../ui/Button'
import { Stack } from '../../ui/Stack'
import { Inline } from '../../ui/Inline'
import { NumberStepper } from '../../ui/NumberStepper'
import { formatCount } from '../../ui/game'
import { useSound } from '../../audio'
import type { CountCheckState } from './useTableGame'

export interface CountCheckModalProps {
  check: CountCheckState
  onSubmit: (value: number) => void
  onContinue: () => void
  onSkip: () => void
}

/**
 * Periodic "what's the running count?" spot-check. Two phases: enter your count,
 * then see whether it matched before the next hand is dealt.
 */
export function CountCheckModal({ check, onSubmit, onContinue, onSkip }: CountCheckModalProps) {
  const [value, setValue] = useState(0)
  const play = useSound()

  // Reset the guess each time a fresh check opens.
  useEffect(() => {
    if (check.open && !check.answered) setValue(0)
  }, [check.open, check.answered])

  // Grade cue once the answer is scored.
  useEffect(() => {
    if (check.answered) play(check.answered.correct ? 'correct' : 'incorrect')
  }, [check.answered, play])

  const answered = check.answered

  return (
    <Modal
      open={check.open}
      onClose={onSkip}
      title="Count check"
      showClose={false}
      dismissOnBackdrop={false}
      size="sm"
      footer={
        answered ? (
          <Button variant="primary" onClick={onContinue}>
            Deal next hand
          </Button>
        ) : (
          <Inline gap={2} justify="end">
            <Button variant="ghost" onClick={onSkip}>
              Skip
            </Button>
            <Button variant="primary" onClick={() => onSubmit(value)}>
              Check
            </Button>
          </Inline>
        )
      }
    >
      {answered ? (
        <Stack gap={2} align="center">
          <Text size="lg" weight="semibold" tone={answered.correct ? 'good' : 'bad'}>
            {answered.correct ? 'Correct' : 'Off the count'}
          </Text>
          <Text size="sm" tone="muted">
            You said {formatCount(answered.answer)}. The running count is{' '}
            <Text as="span" size="sm" weight="semibold">
              {formatCount(check.expected)}
            </Text>
            .
          </Text>
        </Stack>
      ) : (
        <Stack gap={3}>
          <Text size="sm" tone="muted">
            Before the next deal — what is the current running count?
          </Text>
          <div className="flex justify-center">
            <NumberStepper value={value} onChange={setValue} min={-40} max={40} label="Running count" />
          </div>
        </Stack>
      )}
    </Modal>
  )
}

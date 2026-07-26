import { useCallback, useEffect, useRef, useState } from 'react'
import { Panel, Text, Stack, Inline, Badge, Button, Card as CardSurface, cn } from '../../ui'
import { CardHand } from '../../ui'
import type { Card, Rank } from '../../engine/types'
import type { TrainingApi } from '../../training'
import type { Rng } from '../../engine/cards'
import { useSound } from '../../audio'
import { INSURANCE_INDEX, insuranceCorrect, signed } from './data'

export interface InsuranceDrillProps {
  training: TrainingApi
  rng?: Rng
}

const HAND_RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T']
const SUITS = ['S', 'H', 'D', 'C'] as const
let seq = 0

function rndCard(r: Rng): Card {
  const rank = HAND_RANKS[Math.floor(r() * HAND_RANKS.length)]
  return { rank, suit: SUITS[seq % 4], id: `ins-${rank}-${seq++}` }
}

interface Round {
  player: [Card, Card]
  ace: Card
  trueCount: number
}

// True counts spanning both sides of the +3 pivot.
const TC_CHOICES = [-2, -1, 0, 1, 2, 3, 4, 5, 6]

/** Sub-mode 3: dealer shows an Ace at a true count. Take or decline? */
export function InsuranceDrill({ training, rng = Math.random }: InsuranceDrillProps) {
  const [round, setRound] = useState<Round | null>(null)
  const [chosen, setChosen] = useState<boolean | null>(null)
  const play = useSound()
  const rngRef = useRef(rng)
  rngRef.current = rng

  const deal = useCallback(() => {
    const r = rngRef.current
    setChosen(null)
    setRound({
      player: [rndCard(r), rndCard(r)],
      ace: { rank: 'A', suit: SUITS[seq++ % 4], id: `ins-A-${seq}` },
      trueCount: TC_CHOICES[Math.floor(r() * TC_CHOICES.length)],
    })
  }, [])

  useEffect(() => {
    deal()
  }, [deal])

  const answer = useCallback(
    (take: boolean) => {
      if (!round || chosen !== null) return
      const correct = insuranceCorrect(round.trueCount, take)
      setChosen(take)
      play(correct ? 'correct' : 'incorrect')
      training.record({
        category: 'deviations',
        correct,
        srKey: 'insurance',
      })
    },
    [round, chosen, training, play],
  )

  if (!round) return null
  const shouldTake = round.trueCount >= INSURANCE_INDEX
  const answered = chosen !== null
  const correct = answered ? insuranceCorrect(round.trueCount, chosen) : false
  const tcColor = round.trueCount >= INSURANCE_INDEX ? 'text-good' : 'text-bad'

  return (
    <Stack gap={4}>
      <Panel padding="lg" elevation="raised">
        <Stack gap={5} align="center">
          <Inline gap={8} justify="center" align="center" wrap className="w-full">
            <Stack gap={1} align="center">
              <Text size="xs" tone="muted" className="uppercase tracking-wide">
                Dealer
              </Text>
              <CardHand cards={[round.ace]} size="lg" showTotal={false} />
              <Badge variant="warn" size="sm">
                Insurance?
              </Badge>
            </Stack>
            <Stack gap={1} align="center">
              <Text size="xs" tone="muted" className="uppercase tracking-wide">
                Your hand
              </Text>
              <CardHand cards={round.player} size="lg" />
            </Stack>
          </Inline>

          <CardSurface inset padding="sm" className="min-w-28 text-center">
            <Text size="xs" tone="muted" className="uppercase tracking-wide">
              True count
            </Text>
            <div className={cn('text-4xl font-bold tabular-nums', tcColor)}>
              {signed(round.trueCount)}
            </div>
          </CardSurface>
        </Stack>
      </Panel>

      <Inline gap={2} justify="center" className="w-full">
        <Button
          variant={answered && shouldTake ? 'primary' : 'secondary'}
          size="lg"
          block
          disabled={answered}
          onClick={() => answer(true)}
        >
          Take insurance
        </Button>
        <Button
          variant={answered && !shouldTake ? 'primary' : 'secondary'}
          size="lg"
          block
          disabled={answered}
          onClick={() => answer(false)}
        >
          Decline
        </Button>
      </Inline>

      {answered && (
        <Stack gap={3}>
          <Panel
            padding="md"
            elevation="raised"
            className={cn('border-l-4', correct ? 'border-l-good' : 'border-l-bad')}
            role="status"
            aria-live="polite"
          >
            <Stack gap={2}>
              <Inline gap={2}>
                <span
                  aria-hidden
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                    correct ? 'bg-good text-good-ink' : 'bg-bad text-bad-ink',
                  )}
                >
                  {correct ? '✓' : '✗'}
                </span>
                <Text as="span" size="lg" weight="semibold" tone={correct ? 'good' : 'bad'}>
                  {correct ? 'Correct' : 'Not quite'}
                </Text>
                <Badge variant={shouldTake ? 'good' : 'neutral'} size="sm">
                  {shouldTake ? 'Take' : 'Decline'}
                </Badge>
              </Inline>
              <Text size="sm" tone="muted">
                Insurance is a bet the dealer has a ten in the hole. It only turns +EV once tens are
                rich enough — Hi-Lo TC ≥ +{INSURANCE_INDEX}. At TC {signed(round.trueCount)} you
                should {shouldTake ? 'TAKE' : 'DECLINE'} it.
              </Text>
            </Stack>
          </Panel>
          <Inline justify="end">
            <Button variant="primary" onClick={deal}>
              Next
            </Button>
          </Inline>
        </Stack>
      )}
    </Stack>
  )
}

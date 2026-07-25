import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Card, Rank, Suit } from '../../engine/types'
import { PlayingCard, CardHand, Chip, ChipStack, Seat, Felt } from './index'

function card(rank: Rank, suit: Suit): Card {
  return { rank, suit, id: `${rank}${suit}` }
}

describe('PlayingCard', () => {
  it('renders rank and suit with an accessible label (T shows as 10)', () => {
    render(<PlayingCard card={card('T', 'H')} />)
    expect(screen.getByRole('img', { name: '10 of Hearts' })).toBeInTheDocument()
    // Rank appears in both corners.
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1)
  })

  it('renders a face-down back', () => {
    render(<PlayingCard card={card('A', 'S')} faceDown />)
    expect(screen.getByRole('img', { name: 'Face-down card' })).toBeInTheDocument()
  })

  it('renders the back when no card is provided', () => {
    render(<PlayingCard />)
    expect(screen.getByRole('img', { name: 'Face-down card' })).toBeInTheDocument()
  })

  it('exposes flip state via data-face (up when shown, down when face-down)', () => {
    const { rerender } = render(<PlayingCard card={card('A', 'S')} />)
    expect(screen.getByRole('img', { name: 'A of Spades' })).toHaveAttribute('data-face', 'up')
    rerender(<PlayingCard card={card('A', 'S')} faceDown />)
    expect(screen.getByRole('img', { name: 'Face-down card' })).toHaveAttribute('data-face', 'down')
  })
})

describe('CardHand', () => {
  it('shows a soft total badge', () => {
    render(<CardHand cards={[card('A', 'H'), card('6', 'C')]} />)
    expect(screen.getByText('Soft 17')).toBeInTheDocument()
  })

  it('shows a hard total badge', () => {
    render(<CardHand cards={[card('T', 'S'), card('7', 'D')]} />)
    expect(screen.getByText('17')).toBeInTheDocument()
  })

  it('labels a blackjack', () => {
    render(<CardHand cards={[card('A', 'S'), card('K', 'H')]} />)
    expect(screen.getByText('Blackjack')).toBeInTheDocument()
  })

  it('labels a bust', () => {
    render(<CardHand cards={[card('T', 'S'), card('9', 'D'), card('5', 'C')]} />)
    expect(screen.getByText('Bust')).toBeInTheDocument()
  })

  it('renders a hole card and suppresses the total badge', () => {
    render(<CardHand cards={[card('T', 'S'), card('7', 'D')]} holeCardIndex={1} />)
    expect(screen.getByRole('img', { name: 'Face-down card' })).toBeInTheDocument()
    expect(screen.queryByText('17')).not.toBeInTheDocument()
  })
})

describe('Chip / ChipStack', () => {
  it('renders a chip with its value', () => {
    render(<Chip value={25} />)
    expect(screen.getByRole('img', { name: '25 chip' })).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('renders a stack with a numeric total', () => {
    render(<ChipStack amount={130} />)
    expect(screen.getByText('$130')).toBeInTheDocument()
  })
})

describe('Seat', () => {
  it('renders a labeled seat with a hand', () => {
    render(<Seat cards={[card('T', 'S'), card('7', 'D')]} bet={50} label="You" />)
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getByText('$50')).toBeInTheDocument()
  })

  it('renders an empty placeholder when there are no cards', () => {
    render(<Seat label="Seat 3" />)
    expect(screen.getByText('Open')).toBeInTheDocument()
  })

  it('flags a settled result for the win/lose/push glow', () => {
    const { container } = render(
      <Seat cards={[card('A', 'S'), card('K', 'H')]} bet={50} label="You" result="blackjack" />,
    )
    expect(container.querySelector('[data-result="blackjack"]')).not.toBeNull()
  })
})

describe('Felt', () => {
  it('renders the payout marking reflecting the rules (3:2)', () => {
    render(
      <Felt blackjackPayout="3:2" soft17="S17">
        <Seat cards={[card('A', 'S'), card('K', 'H')]} bet={50} label="You" />
      </Felt>,
    )
    expect(screen.getByText('BLACKJACK PAYS 3 TO 2')).toBeInTheDocument()
    expect(screen.getByText('DEALER MUST STAND ON ALL 17s')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('reflects a 6:5 / H17 ruleset in the markings', () => {
    render(<Felt blackjackPayout="6:5" soft17="H17" />)
    expect(screen.getByText('BLACKJACK PAYS 6 TO 5')).toBeInTheDocument()
    expect(screen.getByText('DEALER MUST HIT SOFT 17')).toBeInTheDocument()
  })
})

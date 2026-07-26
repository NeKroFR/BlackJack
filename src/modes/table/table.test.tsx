import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, renderHook, act } from '@testing-library/react'
import { ToastProvider } from '../../ui'
import { DEFAULT_RULES } from '../../engine/rules'
import { createRound, startRound } from '../../game/round'
import { useStore } from '../../store'
import TableGame from '../../screens/TableGame'
import { BetControls } from './BetControls'
import { CountPanel } from './CountPanel'
import { PostHandFeedback } from './PostHandFeedback'
import { TableFelt } from './TableFelt'
import { useTableGame, type DecisionRecord } from './useTableGame'

function resetStore() {
  useStore.setState({
    bankroll: 1000,
    unit: 25,
    sessionPnl: 0,
    adviceMode: 'always',
    tableSeats: 0,
    dealingSpeed: 200,
    rules: DEFAULT_RULES,
    systemId: 'hilo',
    trueCountRounding: 'full',
    haptics: false,
  })
}

beforeEach(resetStore)
afterEach(cleanup)

describe('TableGame screen', () => {
  it('renders the betting UI on mount', () => {
    render(
      <ToastProvider>
        <TableGame />
      </ToastProvider>,
    )
    expect(screen.getByText('Live game')).toBeInTheDocument()
    expect(screen.getByText('Place your bet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reveal count/ })).toBeInTheDocument()
  })
})

describe('BetControls', () => {
  const baseProps = {
    pendingBet: 0,
    addChip: vi.fn(),
    clearBet: vi.fn(),
    setPendingBet: vi.fn(),
    tableMin: 5,
    effectiveMax: 1000,
    bankroll: 1000,
    canDeal: false,
    busted: false,
    onDeal: vi.fn(),
    rebuy: vi.fn(),
  }

  it('adds a chip denomination when tapped', () => {
    const addChip = vi.fn()
    render(<BetControls {...baseProps} addChip={addChip} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add $25 chip' }))
    expect(addChip).toHaveBeenCalledWith(25)
  })

  it('disables Deal until a legal bet is placed and fires onDeal when ready', () => {
    const onDeal = vi.fn()
    const { rerender } = render(<BetControls {...baseProps} onDeal={onDeal} />)
    expect(screen.getByRole('button', { name: 'Deal' })).toBeDisabled()
    rerender(<BetControls {...baseProps} pendingBet={25} canDeal onDeal={onDeal} />)
    const deal = screen.getByRole('button', { name: 'Deal' })
    expect(deal).toBeEnabled()
    fireEvent.click(deal)
    expect(onDeal).toHaveBeenCalledTimes(1)
  })

  it('shows a rebuy prompt when busted', () => {
    render(<BetControls {...baseProps} busted bankroll={2} />)
    expect(screen.getByText('Out of chips')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rebuy \$1,000/ })).toBeInTheDocument()
  })
})

describe('CountPanel', () => {
  const props = {
    revealed: false,
    onToggle: vi.fn(),
    runningCount: 4,
    trueCount: 2,
    usesTrueCount: true,
    decksRemaining: 3,
    systemName: 'Hi-Lo',
    shoeProgress: 0.5,
    penetration: 0.75,
  }

  it('hides the count until revealed', () => {
    const { rerender } = render(<CountPanel {...props} />)
    // Decks remaining is always visible; the count is masked.
    expect(screen.getByText('3.0')).toBeInTheDocument()
    expect(screen.queryByText('+4')).not.toBeInTheDocument()
    rerender(<CountPanel {...props} revealed />)
    expect(screen.getByText('+4')).toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })
})

describe('PostHandFeedback', () => {
  it('summarises the result and flags misplays', () => {
    const decisions: DecisionRecord[] = [
      { handIndex: 0, chosen: 'hit', best: 'stand', correct: false, chosenEv: -0.5, bestEv: -0.2, evDelta: -0.3, explanation: '' },
    ]
    render(<PostHandFeedback pnl={-25} decisions={decisions} />)
    expect(screen.getByText('You lost')).toBeInTheDocument()
    expect(screen.getByText('-$25')).toBeInTheDocument()
    expect(screen.getByText('1 misplay')).toBeInTheDocument()
  })
})

describe('TableFelt', () => {
  it('renders the dealt dealer and hero seats', () => {
    const state = startRound(createRound({ rules: DEFAULT_RULES, seed: 7 }), 25)
    render(<TableFelt state={state} dealIn={false} />)
    expect(screen.getByText('Dealer')).toBeInTheDocument()
    // Hero seat label (single hand -> "You").
    expect(screen.getByText('You')).toBeInTheDocument()
  })
})

describe('useTableGame integration', () => {
  it('deals, plays out, and settles the bankroll exactly once', () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() =>
        useTableGame({ rules: DEFAULT_RULES, systemId: 'hilo', seats: 0, seed: 4242, now: () => 1000 }),
      )

      expect(result.current.state.phase).toBe('idle')
      act(() => result.current.setPendingBet(25))
      act(() => result.current.requestDeal())

      // Drive any resulting phase to settlement.
      let guard = 0
      while (result.current.state.phase !== 'settled' && guard++ < 40) {
        const phase = result.current.state.phase
        if (phase === 'insurance') act(() => result.current.takeInsurance(false))
        else if (phase === 'playerTurn') act(() => result.current.doAction('stand'))
        else if (phase === 'dealerTurn') act(() => vi.advanceTimersByTime(2000))
        else break
      }

      expect(result.current.state.phase).toBe('settled')
      expect(result.current.lastPnl).not.toBeNull()
      expect(result.current.handsPlayed).toBe(1)
      // Net P/L was applied to the persistent bankroll.
      expect(useStore.getState().bankroll).toBe(1000 + (result.current.lastPnl ?? 0))
    } finally {
      vi.useRealTimers()
    }
  })
})

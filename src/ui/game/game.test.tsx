import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ActionBar, Hud, Verdict, useActionKeys } from './index'

describe('ActionBar', () => {
  const noop = () => {}

  it('renders visible actions and fires onClick', async () => {
    const user = userEvent.setup()
    const onHit = vi.fn()
    render(
      <ActionBar
        keyboard={false}
        hit={{ onClick: onHit }}
        stand={{ onClick: noop }}
        double={{ onClick: noop }}
      />,
    )
    await user.click(screen.getByRole('button', { name: /Hit/ }))
    expect(onHit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /Stand/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Double/ })).toBeInTheDocument()
  })

  it('omits hidden slots and disables illegal ones', () => {
    render(
      <ActionBar
        keyboard={false}
        hit={{ onClick: noop }}
        stand={{ onClick: noop }}
        double={{ onClick: noop, disabled: true }}
        split={{ onClick: noop, hidden: true }}
      />,
    )
    expect(screen.queryByRole('button', { name: /Split/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Surrender/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Double/ })).toBeDisabled()
  })

  it('binds keyboard shortcuts, skipping disabled and hidden slots', () => {
    const onHit = vi.fn()
    const onDouble = vi.fn()
    const onSurrender = vi.fn()
    render(
      <ActionBar
        hit={{ onClick: onHit }}
        stand={{ onClick: noop }}
        double={{ onClick: onDouble, disabled: true }}
        surrender={{ onClick: onSurrender, hidden: true }}
      />,
    )
    fireEvent.keyDown(window, { key: 'h' })
    fireEvent.keyDown(window, { key: 'd' })
    fireEvent.keyDown(window, { key: 'r' })
    expect(onHit).toHaveBeenCalledTimes(1)
    expect(onDouble).not.toHaveBeenCalled()
    expect(onSurrender).not.toHaveBeenCalled()
  })
})

describe('useActionKeys', () => {
  function Harness(props: {
    onHit?: () => void
    onStand?: () => void
    onSpace?: () => void
    enabled?: boolean
  }) {
    useActionKeys(
      { onHit: props.onHit, onStand: props.onStand, onSpace: props.onSpace },
      { enabled: props.enabled },
    )
    return <input aria-label="field" />
  }

  it('dispatches H/S and Space to the right callbacks (case-insensitive)', () => {
    const onHit = vi.fn()
    const onStand = vi.fn()
    const onSpace = vi.fn()
    render(<Harness onHit={onHit} onStand={onStand} onSpace={onSpace} />)

    fireEvent.keyDown(window, { key: 'H' })
    fireEvent.keyDown(window, { key: 's' })
    fireEvent.keyDown(window, { key: ' ' })
    expect(onHit).toHaveBeenCalledTimes(1)
    expect(onStand).toHaveBeenCalledTimes(1)
    expect(onSpace).toHaveBeenCalledTimes(1)
  })

  it('ignores modifier combos and keypresses inside text inputs', () => {
    const onHit = vi.fn()
    render(<Harness onHit={onHit} />)
    fireEvent.keyDown(window, { key: 'h', metaKey: true })
    fireEvent.keyDown(screen.getByLabelText('field'), { key: 'h' })
    expect(onHit).not.toHaveBeenCalled()
  })

  it('does not listen when disabled and removes listener on unmount', () => {
    const onHit = vi.fn()
    const { unmount } = render(<Harness onHit={onHit} enabled={false} />)
    fireEvent.keyDown(window, { key: 'h' })
    expect(onHit).not.toHaveBeenCalled()
    unmount()

    const onHit2 = vi.fn()
    const { unmount: unmount2 } = render(<Harness onHit={onHit2} enabled />)
    unmount2()
    fireEvent.keyDown(window, { key: 'h' })
    expect(onHit2).not.toHaveBeenCalled()
  })

  it('reads the latest handler without re-subscribing', () => {
    function Counter() {
      const [n, setN] = useState(0)
      useActionKeys({ onHit: () => setN((v) => v + 1) })
      return <span>count:{n}</span>
    }
    render(<Counter />)
    fireEvent.keyDown(window, { key: 'h' })
    fireEvent.keyDown(window, { key: 'h' })
    expect(screen.getByText('count:2')).toBeInTheDocument()
  })
})

describe('Hud', () => {
  it('minimal variant shows RC/TC/decks and hides bet + advice', () => {
    render(
      <Hud
        variant="minimal"
        runningCount={5}
        trueCount={2.5}
        decksRemaining={3}
        bet={100}
        advice={{ action: 'stand', ev: -0.2 }}
      />,
    )
    expect(screen.getByText('+5')).toBeInTheDocument()
    expect(screen.getByText('+2.5')).toBeInTheDocument()
    expect(screen.getByText('3.0')).toBeInTheDocument()
    // bet + advice only render in the full variant
    expect(screen.queryByText('$100')).not.toBeInTheDocument()
    expect(screen.queryByText('Stand')).not.toBeInTheDocument()
  })

  it('full variant shows bet and advice, omits TC for unbalanced systems', () => {
    render(
      <Hud
        variant="full"
        runningCount={-3}
        decksRemaining={4}
        bet={100}
        advice={{ action: 'double', ev: 0.35 }}
        systemName="KO"
      />,
    )
    expect(screen.getByText('-3')).toBeInTheDocument()
    expect(screen.getByText('$100')).toBeInTheDocument()
    expect(screen.getByText('Double')).toBeInTheDocument()
    expect(screen.getByText('EV +0.35')).toBeInTheDocument()
    expect(screen.getByText('KO')).toBeInTheDocument()
    // No trueCount prop -> no True stat
    expect(screen.queryByText('True')).not.toBeInTheDocument()
  })
})

describe('Verdict', () => {
  it('shows a correct verdict with explanation', () => {
    render(
      <Verdict correct correctAction="stand" explanation="Stand (-0.29) beats Hit (-0.54)." />,
    )
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.getByText(/Stand \(-0.29\)/)).toBeInTheDocument()
  })

  it('shows chosen vs best on an incorrect verdict', () => {
    render(<Verdict correct={false} correctAction="stand" chosenAction="hit" />)
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    expect(screen.getByText('Hit')).toBeInTheDocument()
    expect(screen.getByText('Stand')).toBeInTheDocument()
  })
})

afterEach(() => cleanup())

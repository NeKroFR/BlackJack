import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { BetRamp } from '../../engine/betting'
import { BetRampEditor } from './BetRampEditor'

const RAMP: BetRamp = [
  { minTrueCount: 1, units: 1 },
  { minTrueCount: 2, units: 2 },
]

describe('BetRampEditor', () => {
  it('renders a row per rung with its dollar bet', () => {
    render(<BetRampEditor ramp={RAMP} onChange={() => {}} unit={25} />)
    // 2 units * $25 = $50 for the second rung.
    expect(screen.getByText('$50')).toBeInTheDocument()
    expect(screen.getByText('$25')).toBeInTheDocument()
  })

  it('adds a rung above the current maximum true count', () => {
    const onChange = vi.fn()
    render(<BetRampEditor ramp={RAMP} onChange={onChange} unit={25} />)
    fireEvent.click(screen.getByText('+ Add rung'))
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as BetRamp
    expect(next).toHaveLength(3)
    expect(next[2].minTrueCount).toBe(3)
  })

  it('removes a rung when its remove button is pressed', () => {
    const onChange = vi.fn()
    render(<BetRampEditor ramp={RAMP} onChange={onChange} unit={25} />)
    fireEvent.click(screen.getByLabelText('Remove rung at true count 1'))
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as BetRamp
    expect(next).toHaveLength(1)
    expect(next[0].minTrueCount).toBe(2)
  })
})

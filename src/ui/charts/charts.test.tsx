import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DEFAULT_RULES } from '../../engine/rules'
import type { StrategyChart as StrategyChartData } from '../../engine/ev'
import {
  BarChart,
  LineChart,
  Sparkline,
  StatTile,
  StrategyChart,
  StrategyLegend,
  chartColor,
  tint,
} from './index'

describe('palette', () => {
  it('wraps categorical tokens and mixes tints', () => {
    expect(chartColor(0)).toBe('var(--chart-1)')
    expect(chartColor(6)).toBe('var(--chart-1)')
    expect(chartColor(-1)).toBe('var(--chart-6)')
    expect(tint('var(--chart-1)', 60)).toContain('color-mix')
  })
})

describe('StatTile', () => {
  it('renders label, value and a signed delta chip', () => {
    render(<StatTile label="Accuracy" value="92%" delta={5} sparkline={[1, 3, 2, 5]} />)
    expect(screen.getByText('Accuracy')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('+5')).toBeInTheDocument()
  })

  it('renders with no delta or sparkline', () => {
    render(<StatTile label="Streak" value={7} />)
    expect(screen.getByText('Streak')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })
})

describe('Sparkline', () => {
  it('renders a polyline for data', () => {
    const { container } = render(<Sparkline data={[1, 2, 3, 2, 4]} ariaLabel="trend" />)
    expect(container.querySelector('polyline')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'trend' })).toBeInTheDocument()
  })

  it('renders empty data without crashing', () => {
    const { container } = render(<Sparkline data={[]} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})

describe('LineChart', () => {
  it('renders one polyline per series', () => {
    const { container } = render(
      <LineChart
        ariaLabel="Bankroll"
        labels={['A', 'B', 'C']}
        series={[
          { name: 'p50', values: [0, 5, 3] },
          { name: 'p90', values: [0, 8, 12] },
        ]}
      />,
    )
    expect(screen.getByRole('img', { name: 'Bankroll' })).toBeInTheDocument()
    expect(container.querySelectorAll('polyline').length).toBe(2)
  })

  it('renders empty series without crashing', () => {
    render(<LineChart series={[]} ariaLabel="empty" />)
    expect(screen.getByRole('img', { name: 'empty' })).toBeInTheDocument()
  })
})

describe('BarChart', () => {
  it('renders a rect per datum plus its label', () => {
    render(
      <BarChart
        ariaLabel="By category"
        data={[
          { label: 'Hard', value: 0.9 },
          { label: 'Soft', value: 0.7 },
          { label: 'Pairs', value: 0.8 },
        ]}
      />,
    )
    expect(screen.getByRole('img', { name: 'By category' })).toBeInTheDocument()
    expect(screen.getByText('Hard')).toBeInTheDocument()
    expect(screen.getByText('Soft')).toBeInTheDocument()
    expect(screen.getByText('Pairs')).toBeInTheDocument()
  })
})

describe('StrategyLegend', () => {
  it('lists all five actions', () => {
    render(<StrategyLegend />)
    for (const name of ['Hit', 'Stand', 'Double', 'Split', 'Surrender'])
      expect(screen.getByText(name)).toBeInTheDocument()
  })
})

describe('StrategyChart', () => {
  it('renders sections and a full grid from DEFAULT_RULES', () => {
    render(<StrategyChart rules={DEFAULT_RULES} />)
    expect(screen.getByText('Hard totals')).toBeInTheDocument()
    expect(screen.getByText('Soft totals')).toBeInTheDocument()
    expect(screen.getByText('Pairs')).toBeInTheDocument()
    // Row labels present.
    expect(screen.getByText('16')).toBeInTheDocument()
    expect(screen.getByText('A,7')).toBeInTheDocument()
    expect(screen.getByText('8,8')).toBeInTheDocument()
    // A pair of eights should split against most upcards.
    expect(screen.getAllByText('P').length).toBeGreaterThan(0)
  })

  it('renders every dealer column 2..A for all three tables', () => {
    render(<StrategyChart rules={DEFAULT_RULES} />)
    // Each of the hard/soft/pairs tables must expose the full 2..A dealer
    // header row, so the pairs 9/10/A columns are never clipped.
    for (const col of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']) {
      const headers = screen
        .getAllByRole('columnheader')
        .filter((el) => el.textContent === col)
      expect(headers.length).toBe(3)
    }
  })

  it('accepts a pre-computed chart', () => {
    const stub: StrategyChartData = {
      hard: { 16: { 2: 'stand', 3: 'stand', 4: 'stand', 5: 'stand', 6: 'stand', 7: 'hit', 8: 'hit', 9: 'surrender', 10: 'surrender', 1: 'hit' } },
      soft: { 18: { 2: 'stand', 3: 'double', 4: 'double', 5: 'double', 6: 'double', 7: 'stand', 8: 'stand', 9: 'hit', 10: 'hit', 1: 'hit' } },
      pairs: { 8: { 2: 'split', 3: 'split', 4: 'split', 5: 'split', 6: 'split', 7: 'split', 8: 'split', 9: 'split', 10: 'split', 1: 'split' } },
    }
    render(<StrategyChart rules={DEFAULT_RULES} chart={stub} />)
    // Data-driven row labels from the stub grids.
    expect(screen.getByText('16')).toBeInTheDocument()
    expect(screen.getByText('A,7')).toBeInTheDocument()
    expect(screen.getByText('8,8')).toBeInTheDocument()
    // Two surrender cells in the hard row + one legend swatch glyph.
    expect(screen.getAllByText('R').length).toBe(3)
  })
})

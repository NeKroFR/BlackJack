import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../ui'
import { resetPersisted, useStore } from '../store'
import Learn from './Learn'

function renderLearn() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <Learn />
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('Learn screen', () => {
  beforeEach(() => {
    resetPersisted()
  })

  it('renders the guided path with the first lesson unlocked and later ones locked', () => {
    renderLearn()
    expect(screen.getByRole('heading', { name: 'Learn' })).toBeInTheDocument()
    expect(screen.getByText('Basic Strategy')).toBeInTheDocument()
    // The final lesson is locked until its predecessors are done.
    expect(screen.getAllByText('Complete the previous lesson to unlock.').length).toBeGreaterThan(0)
  })

  it('completing a lesson awards XP and unlocks the next', async () => {
    const user = userEvent.setup()
    renderLearn()

    expect(useStore.getState().xp).toBe(0)
    // running-count starts locked (subtitle hidden behind the lock message).
    expect(
      screen.queryByText('Track the shoe’s richness one card at a time with Hi-Lo.'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mark complete' }))

    // XP awarded and the next module unlocked in the progress slice.
    expect(useStore.getState().xp).toBe(50)
    expect(useStore.getState().curriculum['basic-strategy']).toBe(true)
    expect(useStore.getState().unlockedModules).toContain('running-count')

    // The next lesson is now the current one and shows its subtitle.
    expect(
      screen.getByText('Track the shoe’s richness one card at a time with Hi-Lo.'),
    ).toBeInTheDocument()
  })

  it('shows overall path progress in the header', async () => {
    const user = userEvent.setup()
    renderLearn()
    expect(screen.getByText('0 of 6 lessons complete')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark complete' }))
    expect(screen.getByText('1 of 6 lessons complete')).toBeInTheDocument()
  })

  it('auto-completes a lesson once its drill criterion is met', () => {
    // Simulate strong basic-strategy performance in the stats slice.
    const s = useStore.getState()
    for (let i = 0; i < 20; i++) s.recordAnswer('basicStiff', true)
    renderLearn()
    // Auto-complete fires from the effect, awarding XP and unlocking the next.
    expect(useStore.getState().curriculum['basic-strategy']).toBe(true)
    expect(useStore.getState().unlockedModules).toContain('running-count')
    expect(useStore.getState().xp).toBe(50)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { TrainingApi } from '../../training'
import { DEFAULT_RULES } from '../../engine/rules'
import type { Rules } from '../../engine/types'
import { PlayDeviation } from './PlayDeviation'
import { InsuranceDrill } from './InsuranceDrill'

afterEach(() => cleanup())

/** A deterministic training stub: forces pickNext to the first pool item. */
function stubTraining(): { api: TrainingApi; record: ReturnType<typeof vi.fn> } {
  const record = vi.fn(() => ({
    xpAwarded: 0,
    leveledUp: false,
    level: 1,
    streak: 0,
    achievementsUnlocked: [],
    loggedMistake: false,
  }))
  const api = {
    scheduler: {} as unknown as TrainingApi['scheduler'],
    record,
    pickNext: () => undefined,
  } as TrainingApi
  return { api, record }
}

const NO_SURRENDER: Rules = { ...DEFAULT_RULES, surrender: 'none' }

describe('PlayDeviation', () => {
  it('deals a hand, grades the chosen action, and records the result', () => {
    const { api, record } = stubTraining()
    // rng=0 -> first pool item (16 v 10, index 0) at TC 0-3 = -3, where the
    // correct play is Hit. Choosing Stand should grade as incorrect.
    render(<PlayDeviation rules={NO_SURRENDER} training={api} rng={() => 0} />)

    expect(screen.getByText(/what is the correct play/i)).toBeInTheDocument()
    expect(screen.getByText('16 v 10 — what is the correct play at this count?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Stand/ }))

    expect(record).toHaveBeenCalledTimes(1)
    expect(record.mock.calls[0][0]).toMatchObject({
      category: 'deviations',
      correct: false,
      chosen: 'stand',
      best: 'hit',
    })
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next hand/ })).toBeInTheDocument()
  })
})

describe('InsuranceDrill', () => {
  it('grades a decline at a low count as correct', () => {
    const { api, record } = stubTraining()
    // rng=0 -> TC -2 (below the +3 pivot): declining is correct.
    render(<InsuranceDrill training={api} rng={() => 0} />)

    fireEvent.click(screen.getByRole('button', { name: /Decline/ }))

    expect(record).toHaveBeenCalledTimes(1)
    expect(record.mock.calls[0][0]).toMatchObject({ category: 'deviations', correct: true })
    expect(screen.getByText('Correct')).toBeInTheDocument()
  })
})

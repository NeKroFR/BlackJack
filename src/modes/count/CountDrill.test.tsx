import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '../../ui'
import CountDrill from './CountDrill'

function renderDrill() {
  return render(
    <ToastProvider>
      <CountDrill />
    </ToastProvider>,
  )
}

describe('CountDrill', () => {
  afterEach(cleanup)

  it('renders the config screen with mode selector and start action', () => {
    renderDrill()
    expect(screen.getByRole('radio', { name: /Single card/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Full shoe/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start drill/ })).toBeInTheDocument()
  })

  it('switches sub-mode and shows its blurb', async () => {
    const user = userEvent.setup()
    renderDrill()
    await user.click(screen.getByRole('radio', { name: /Grouped/ }))
    expect(screen.getByText(/Two or three cards per flash/)).toBeInTheDocument()
  })

  it('starts flashing and shows the beat progress readout', () => {
    renderDrill()
    fireEvent.click(screen.getByRole('button', { name: /Start drill/ }))
    expect(screen.getByText(/Beat 1 \//)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pause/ })).toBeInTheDocument()
  })

  it('pauses and resumes the flashing clock', () => {
    renderDrill()
    fireEvent.click(screen.getByRole('button', { name: /Start drill/ }))
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Pause/ }))
    })
    expect(screen.getByText('Paused')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }))
    expect(screen.queryByText('Paused')).not.toBeInTheDocument()
  })
})

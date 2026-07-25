import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import {
  Badge,
  Button,
  Modal,
  Segmented,
  Toggle,
  ToastProvider,
  useToast,
  Panel,
  KeyHint,
} from './index'

describe('Button', () => {
  it('renders children and fires onClick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button variant="primary" onClick={onClick}>
        Deal
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'Deal' })
    await user.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    )
    await user.click(screen.getByRole('button', { name: 'Nope' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Toggle', () => {
  it('toggles checked state on click', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [on, setOn] = useState(false)
      return <Toggle checked={on} onChange={setOn} label="Sound" />
    }
    render(<Harness />)
    const sw = screen.getByRole('switch', { name: 'Sound' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await user.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })
})

describe('Segmented', () => {
  it('selects an option and reflects aria-checked', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [v, setV] = useState('h17')
      return (
        <Segmented
          label="Soft 17"
          value={v}
          onChange={setV}
          options={[
            { value: 's17', label: 'S17' },
            { value: 'h17', label: 'H17' },
          ]}
        />
      )
    }
    render(<Harness />)
    const s17 = screen.getByRole('radio', { name: 'S17' })
    expect(s17).toHaveAttribute('aria-checked', 'false')
    await user.click(s17)
    expect(s17).toHaveAttribute('aria-checked', 'true')
  })
})

describe('Modal', () => {
  it('opens, shows content, and closes on Escape', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <Modal open={open} onClose={() => setOpen(false)} title="Rules">
          <p>Body content</p>
        </Modal>
      )
    }
    render(<Harness />)
    expect(screen.getByRole('dialog', { name: 'Rules' })).toBeInTheDocument()
    expect(screen.getByText('Body content')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Toast', () => {
  it('shows a toast via useToast and dismisses it', async () => {
    const user = userEvent.setup()
    function Trigger() {
      const { toast } = useToast()
      return (
        <Button onClick={() => toast({ title: 'Saved', message: 'All good', duration: 0 })}>
          Notify
        </Button>
      )
    }
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Notify' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })
})

describe('Badge / Panel / KeyHint', () => {
  it('render presentational content', () => {
    render(
      <Panel data-testid="panel">
        <Badge variant="good">+EV</Badge>
        <KeyHint keyName="H" />
      </Panel>,
    )
    expect(screen.getByTestId('panel')).toBeInTheDocument()
    expect(screen.getByText('+EV')).toBeInTheDocument()
    expect(screen.getByText('H')).toBeInTheDocument()
  })
})

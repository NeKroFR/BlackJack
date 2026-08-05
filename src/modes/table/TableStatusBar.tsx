import { useState } from 'react'
import { IconButton } from '../../ui/IconButton'
import { Modal } from '../../ui/Modal'
import { Panel } from '../../ui/Panel'
import { Stack } from '../../ui/Stack'
import { Text } from '../../ui/Text'
import { cn } from '../../ui/cn'
import { formatCount } from '../../ui/game'
import { CountPanel } from './CountPanel'
import { HeatMeter } from './HeatMeter'
import { money, signedMoney } from './format'
import type { TableController } from './useTableGame'

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="m4 20 16-16" />}
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.01" />
    </svg>
  )
}

function countTone(n: number): 'good' | 'bad' | 'muted' {
  if (n > 0) return 'good'
  if (n < 0) return 'bad'
  return 'muted'
}

/** One `LABEL value` pair in the strip. */
function Metric({
  label,
  value,
  tone = 'default',
}: {
  label?: string
  value: string
  tone?: 'default' | 'good' | 'bad' | 'muted'
}) {
  return (
    <span className="flex items-baseline gap-1">
      {label && (
        <Text as="span" size="xs" tone="muted" weight="medium" className="uppercase tracking-wide">
          {label}
        </Text>
      )}
      <Text as="span" size="sm" weight="semibold" tone={tone} numeric>
        {value}
      </Text>
    </span>
  )
}

export interface TableStatusBarProps {
  c: TableController
  className?: string
}

/**
 * The mobile counterpart to the desktop side column: count, decks and bankroll
 * on one line, with the shoe's penetration as a hairline underneath. The full
 * count / heat / session panels move into a sheet behind the info button, which
 * keeps the felt and the controls sharing the screen.
 */
export function TableStatusBar({ c, className }: TableStatusBarProps) {
  const [open, setOpen] = useState(false)
  const masked = '••'

  // The compact felt drops the chip stack, so the wager lives here. Beside it
  // goes the spendable figure: the gross bankroll double-counts the stake.
  const wager = c.committed

  return (
    <>
      <Panel padding="none" elevation="raised" className={cn('overflow-hidden', className)}>
        <div className="flex items-center gap-3 px-2.5 py-1.5">
          <Metric
            label="RC"
            value={
              c.countRevealed
                ? formatCount(c.runningCount, Number.isInteger(c.runningCount) ? 0 : 1)
                : masked
            }
            tone={c.countRevealed ? countTone(c.runningCount) : 'muted'}
          />
          {c.usesTrueCount && (
            <Metric
              label="TC"
              value={c.countRevealed ? formatCount(c.trueCount) : masked}
              tone={c.countRevealed ? countTone(c.trueCount) : 'muted'}
            />
          )}
          <Metric label="Dk" value={c.decksRemaining.toFixed(1)} />
          {wager > 0 && <Metric label="Bet" value={money(wager)} tone="good" />}

          <span className="ml-auto flex items-center gap-1">
            <Metric
              value={money(c.available)}
              tone={c.sessionPnl > 0 ? 'good' : c.sessionPnl < 0 ? 'bad' : 'default'}
            />
            <IconButton
              size="sm"
              label={c.countRevealed ? 'Hide count' : 'Reveal count'}
              onClick={c.toggleCount}
              className={cn(c.countRevealed && 'text-[var(--accent)]')}
            >
              <EyeIcon open={c.countRevealed} />
            </IconButton>
            <IconButton size="sm" label="Table details" onClick={() => setOpen(true)}>
              <InfoIcon />
            </IconButton>
          </span>
        </div>

        {/* Shoe penetration, with the cut-card marker. */}
        <div className="relative h-[3px] w-full bg-surface-2">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${Math.round(c.shoeProgress * 100)}%` }}
          />
          <div
            aria-hidden
            className="absolute top-0 h-full w-0.5 bg-bad"
            style={{ left: `calc(${Math.round(c.penetration * 100)}% - 1px)` }}
          />
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} title="Table details" size="sm">
        <Stack gap={3}>
          <CountPanel
            revealed={c.countRevealed}
            onToggle={c.toggleCount}
            runningCount={c.runningCount}
            trueCount={c.trueCount}
            usesTrueCount={c.usesTrueCount}
            decksRemaining={c.decksRemaining}
            systemName={c.system.name}
            shoeProgress={c.shoeProgress}
            penetration={c.penetration}
          />
          <HeatMeter heat={c.heat} />
          <Panel padding="md" elevation="raised">
            <div className="grid grid-cols-3 gap-2">
              {/* Session total, so unlike the strip it counts the felt stake. */}
              <Metric label="Total" value={money(c.bankroll)} />
              <Metric
                label="P/L"
                value={signedMoney(c.sessionPnl)}
                tone={c.sessionPnl > 0 ? 'good' : c.sessionPnl < 0 ? 'bad' : 'default'}
              />
              <Metric label="Hands" value={String(c.handsPlayed)} />
            </div>
          </Panel>
        </Stack>
      </Modal>
    </>
  )
}

import { useEffect, useRef } from 'react'
import {
  Panel,
  Text,
  Stack,
  Inline,
  Button,
  Badge,
  Spinner,
  Verdict,
  ActionBar,
  useToast,
} from '../ui'
import type { ActionSlot } from '../ui'
import { ACTION_META, formatEv } from '../ui/game'
import type { Action } from '../engine/types'
import { getSystem } from '../engine/counting/systems'
import { useSound } from '../audio'
import type { SoundName } from '../audio'
import type { RoundResult } from '../game/round'
import { useStore } from '../store'
import { useIsDesktop } from '../ui/useMediaQuery'
import { useImmersiveScreen } from '../app/screenMode'
import { PageHeader } from './PageHeader'
import {
  useTableGame,
  TableFelt,
  TableStatusBar,
  CountPanel,
  HeatMeter,
  BetControls,
  PostHandFeedback,
  CountCheckModal,
  money,
  signedMoney,
} from '../modes/table'
import type { TableController } from '../modes/table'

/** Pick the settlement cue from the round result (blackjack/win/push/lose/bust). */
function settleSound(result: RoundResult): SoundName {
  if (result.hands.some((h) => h.result === 'blackjack')) return 'blackjack'
  if (result.totalPnl > 0) return 'win'
  if (result.totalPnl === 0) return 'push'
  return result.hands.some((h) => h.bust) ? 'bust' : 'lose'
}

/** Live compact session readout. */
function SessionSummary({ c }: { c: TableController }) {
  const pnlTone = c.sessionPnl > 0 ? 'good' : c.sessionPnl < 0 ? 'bad' : 'default'
  return (
    <Panel padding="md" elevation="raised">
      <Inline gap={5} wrap>
        {/* Chips off the felt: the gross bankroll counts the live stake too. */}
        <Stat label={c.committed > 0 ? 'Chips left' : 'Bankroll'} value={money(c.available)} />
        <Stat label="Session P/L" value={signedMoney(c.sessionPnl)} tone={pnlTone} />
        <Stat label="Hands" value={String(c.handsPlayed)} />
      </Inline>
    </Panel>
  )
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' | 'bad' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Text as="span" size="xs" tone="muted" weight="medium" className="uppercase tracking-wide">
        {label}
      </Text>
      <Text as="span" size="lg" weight="semibold" tone={tone} numeric>
        {value}
      </Text>
    </div>
  )
}

/** Whether `AdviceLine` would render anything, so callers can skip its row. */
function hasAdviceLine(c: TableController): boolean {
  if (c.adviceMode === 'onDemand' && !c.hintShown) return true
  return c.advice != null
}

/** Recommended play + EV, surfaced per the advice mode. */
function AdviceLine({ c }: { c: TableController }) {
  if (c.adviceMode === 'onDemand' && !c.hintShown) {
    return (
      <Button size="sm" variant="ghost" onClick={c.showHint}>
        Show hint
      </Button>
    )
  }
  if (!c.advice) return null
  return (
    <Inline gap={2} align="center" wrap>
      <Text as="span" size="xs" tone="muted" weight="medium" className="uppercase tracking-wide">
        Best play
      </Text>
      <Badge variant="accent" size="md">
        {ACTION_META[c.advice.action].label}
      </Badge>
      <Text as="span" size="sm" tone="muted" numeric>
        EV {formatEv(c.advice.ev)}
      </Text>
    </Inline>
  )
}

/**
 * Why Double/Split are greyed. Illegal plays are hidden instead, so a dead
 * button only ever means the chips cannot cover a second wager.
 */
function AffordabilityNote({ c }: { c: TableController }) {
  if (c.unaffordable.length === 0) return null
  const labels = c.unaffordable.map((a) => ACTION_META[a].label)
  const names = labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : labels[0]
  return (
    <Text size="xs" tone="warn">
      {names} {labels.length > 1 ? 'need' : 'needs'} another {money(c.state.hero.baseBet)} — you have{' '}
      {money(c.available)} left.
    </Text>
  )
}

/** Dealer-shows-Ace insurance offer. */
function InsurancePrompt({ c }: { c: TableController }) {
  return (
    <Panel padding="lg" elevation="raised" className="flex flex-col gap-3">
      <Text size="lg" weight="semibold">
        Dealer shows an Ace
      </Text>
      <Text size="sm" tone="muted">
        Insurance pays 2:1 if the dealer has blackjack. It costs half your bet.
        {c.adviceMode === 'always' && (
          <>
            {' '}
            <Text as="span" size="sm" weight="semibold" tone={c.insuranceRecommend ? 'good' : 'default'}>
              Engine says {c.insuranceRecommend ? 'take it' : 'decline'}.
            </Text>
          </>
        )}
      </Text>
      <Inline gap={2} wrap>
        <Button
          variant="primary"
          onClick={() => c.takeInsurance(true)}
          disabled={!c.canAffordInsurance}
        >
          Take insurance
        </Button>
        <Button variant="secondary" onClick={() => c.takeInsurance(false)}>
          No insurance
        </Button>
      </Inline>
      {!c.canAffordInsurance && (
        <Text size="xs" tone="warn">
          Not enough chips for insurance — {money(c.available)} left.
        </Text>
      )}
    </Panel>
  )
}

/** The phase-specific control bar. Always exactly one clear primary action. */
function ControlBar({ c }: { c: TableController }) {
  const phase = c.state.phase

  if (phase === 'insurance') return <InsurancePrompt c={c} />

  if (phase === 'dealerTurn') {
    return (
      <Panel padding="lg" elevation="raised" className="flex flex-col gap-4">
        {c.mistakeFlag && (
          <Verdict
            correct={false}
            correctAction={c.mistakeFlag.best}
            chosenAction={c.mistakeFlag.chosen}
            explanation={c.mistakeFlag.explanation}
          />
        )}
        <Inline gap={2} align="center">
          <Spinner size="sm" />
          <Text tone="muted">Dealer is playing…</Text>
        </Inline>
      </Panel>
    )
  }

  if (phase === 'playerTurn') {
    const slot = (a: Action): ActionSlot => ({
      onClick: () => c.doAction(a),
      hidden: !c.legalActions.includes(a),
      disabled: c.unaffordable.includes(a),
    })
    return (
      <Panel padding="lg" elevation="raised" className="flex flex-col gap-4">
        <Inline justify="between" align="center" wrap className="gap-2 min-h-8">
          <AdviceLine c={c} />
        </Inline>
        {c.mistakeFlag && (
          <Verdict
            correct={false}
            correctAction={c.mistakeFlag.best}
            chosenAction={c.mistakeFlag.chosen}
            explanation={c.mistakeFlag.explanation}
          />
        )}
        <ActionBar
          size="lg"
          block
          hit={slot('hit')}
          stand={slot('stand')}
          double={slot('double')}
          split={slot('split')}
          surrender={slot('surrender')}
          recommend={c.advice?.action}
        />
        <AffordabilityNote c={c} />
      </Panel>
    )
  }

  // idle or settled: place the next bet.
  return (
    <Stack gap={4}>
      {phase === 'settled' && c.lastPnl !== null && (
        <PostHandFeedback pnl={c.lastPnl} decisions={c.decisions} />
      )}
      <BetControls
        pendingBet={c.pendingBet}
        addChip={c.addChip}
        clearBet={c.clearBet}
        setPendingBet={c.setPendingBet}
        tableMin={c.tableMin}
        effectiveMax={c.effectiveMax}
        bankroll={c.bankroll}
        canDeal={c.canDeal}
        busted={c.busted}
        onDeal={c.requestDeal}
        rebuy={c.rebuy}
        dealLabel={phase === 'settled' ? 'Deal next hand' : 'Deal'}
      />
    </Stack>
  )
}

/** One-line misplay notice — the full Verdict panel is too tall for the dock. */
function MistakeLine({ c }: { c: TableController }) {
  if (!c.mistakeFlag) return null
  return (
    <Inline gap={2} align="center" className="border-b border-border pb-2">
      <span
        aria-hidden
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-bad text-[0.625rem] font-bold text-bad-ink"
      >
        ✗
      </span>
      <Text size="sm" tone="muted">
        Best play was{' '}
        <Text as="span" size="sm" weight="semibold" tone="bad">
          {ACTION_META[c.mistakeFlag.best].label}
        </Text>
      </Text>
    </Inline>
  )
}

/**
 * The touch control dock: a fixed-height slab under the felt holding whatever
 * the current phase needs. Everything here is sized so the felt above it never
 * has to scroll out of view.
 */
function MobileDock({ c }: { c: TableController }) {
  const phase = c.state.phase

  if (phase === 'insurance') {
    return (
      <Panel padding="none" elevation="raised" className="flex flex-col gap-2 p-2.5">
        <Text size="sm" weight="semibold">
          Dealer shows an Ace — insurance?
        </Text>
        <Text size="xs" tone="muted">
          Pays 2:1 if the dealer has blackjack; costs half your bet.
          {c.adviceMode === 'always' && (
            <>
              {' '}
              <Text as="span" size="xs" weight="semibold" tone={c.insuranceRecommend ? 'good' : 'default'}>
                Engine says {c.insuranceRecommend ? 'take it' : 'decline'}.
              </Text>
            </>
          )}
        </Text>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" block className="h-12" onClick={() => c.takeInsurance(true)} disabled={!c.canAffordInsurance}>
            Take
          </Button>
          <Button variant="secondary" block className="h-12" onClick={() => c.takeInsurance(false)}>
            No thanks
          </Button>
        </div>
        {!c.canAffordInsurance && (
          <Text size="xs" tone="warn">
            Not enough chips for insurance — {money(c.available)} left.
          </Text>
        )}
      </Panel>
    )
  }

  if (phase === 'dealerTurn') {
    return (
      <Panel padding="none" elevation="raised" className="flex flex-col gap-2 p-2.5">
        <MistakeLine c={c} />
        <Inline gap={2} align="center" justify="center" className="h-13">
          <Spinner size="sm" />
          <Text tone="muted">Dealer is playing…</Text>
        </Inline>
      </Panel>
    )
  }

  if (phase === 'playerTurn') {
    const slot = (a: Action): ActionSlot => ({
      onClick: () => c.doAction(a),
      hidden: !c.legalActions.includes(a),
      disabled: c.unaffordable.includes(a),
    })
    return (
      <Panel padding="none" elevation="raised" className="flex flex-col gap-2 p-2.5">
        <MistakeLine c={c} />
        {hasAdviceLine(c) && (
          <Inline justify="between" align="center" className="gap-2">
            <AdviceLine c={c} />
          </Inline>
        )}
        <ActionBar
          layout="grid"
          hit={slot('hit')}
          stand={slot('stand')}
          double={slot('double')}
          split={slot('split')}
          surrender={slot('surrender')}
          recommend={c.advice?.action}
        />
        <AffordabilityNote c={c} />
      </Panel>
    )
  }

  // idle or settled: place the next bet.
  return (
    <BetControls
      compact
      header={
        phase === 'settled' && c.lastPnl !== null ? (
          <PostHandFeedback compact pnl={c.lastPnl} decisions={c.decisions} />
        ) : undefined
      }
      pendingBet={c.pendingBet}
      addChip={c.addChip}
      clearBet={c.clearBet}
      setPendingBet={c.setPendingBet}
      tableMin={c.tableMin}
      effectiveMax={c.effectiveMax}
      bankroll={c.bankroll}
      canDeal={c.canDeal}
      busted={c.busted}
      onDeal={c.requestDeal}
      rebuy={c.rebuy}
      dealLabel={phase === 'settled' ? 'Deal next hand' : 'Deal'}
    />
  )
}

/**
 * One live session at the felt. Keyed on rules/system/seats by the parent so a
 * settings change starts a clean shoe rather than mutating one mid-deal.
 */
function TableSession({
  rules,
  systemId,
  seats,
  desktop,
}: {
  rules: ReturnType<typeof useStore.getState>['rules']
  systemId: ReturnType<typeof useStore.getState>['systemId']
  seats: number
  desktop: boolean
}) {
  const c = useTableGame({ rules, systemId, seats })
  const { toast } = useToast()
  const play = useSound()
  const reshuffleRef = useRef(false)
  const dealtRef = useRef(0)
  const holeRef = useRef(false)
  const resultRef = useRef<RoundResult | null>(null)

  useEffect(() => {
    if (c.state.reshuffled && !reshuffleRef.current && c.handsPlayed > 0) {
      toast({ title: 'Shuffle', message: 'Fresh shoe — reset your count.', variant: 'accent' })
      play('shuffle')
    }
    reshuffleRef.current = c.state.reshuffled
  }, [c.state.reshuffled, c.handsPlayed, toast, play])

  // A card-slide tick per card drawn from the shoe (staggered to match the
  // deal-in animation). `dealt` climbs monotonically within a shoe and resets on
  // reshuffle, so a drop means a fresh deal counted from zero.
  const dealt = c.state.dealt
  useEffect(() => {
    const prev = dealtRef.current
    dealtRef.current = dealt
    const added = dealt >= prev ? dealt - prev : dealt
    if (added <= 0) return
    const ticks = Math.min(added, 8)
    for (let i = 0; i < ticks; i++) {
      if (i === 0) play('deal')
      else window.setTimeout(() => play('deal'), i * 70)
    }
  }, [dealt, play])

  // Dealer hole-card reveal: the card flips face-up.
  const holeRevealed = c.state.dealer.holeRevealed
  useEffect(() => {
    if (holeRevealed && !holeRef.current) play('flip')
    holeRef.current = holeRevealed
  }, [holeRevealed, play])

  // Settlement cue, exactly once per resolved round.
  const result = c.state.result
  useEffect(() => {
    if (!result || resultRef.current === result) return
    resultRef.current = result
    play(settleSound(result))
  }, [result, play])

  const checkModal = (
    <CountCheckModal
      check={c.countCheck}
      onSubmit={c.submitCountCheck}
      onContinue={c.continueAfterCheck}
      onSkip={c.skipCountCheck}
    />
  )

  // Touch: one screen, three bands — status, felt, dock. The felt takes what is
  // left after the other two, and scales its cards to fit it.
  if (!desktop) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <h1 className="sr-only">Live game</h1>
        <TableStatusBar c={c} className="shrink-0" />
        <div className="tbl-fit min-h-0 flex-1">
          <TableFelt state={c.state} compact className="h-full" />
        </div>
        <div className="shrink-0">
          <MobileDock c={c} />
        </div>
        {checkModal}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Live game"
        description="Place your bet, keep the count yourself, and play real hands. Advice, penetration, insurance, and a bustable bankroll all follow your settings."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <Stack gap={4} className="min-w-0">
          <TableFelt state={c.state} />
          <ControlBar c={c} />
        </Stack>
        <Stack gap={4}>
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
          <SessionSummary c={c} />
        </Stack>
      </div>

      {checkModal}
    </>
  )
}

export default function TableGame() {
  const rules = useStore((s) => s.rules)
  const systemId = useStore((s) => s.systemId)
  const seats = useStore((s) => s.tableSeats)
  const desktop = useIsDesktop()

  // On touch the felt and the dock have to share one screen, so the shell stops
  // scrolling and hands this route its exact height.
  useImmersiveScreen(!desktop)

  // A settings change (rules / system / seats) restarts the shoe.
  const sig = `${JSON.stringify(rules)}|${systemId}|${seats}`
  // Validate the system id resolves (defensive, getSystem throws on unknown ids).
  getSystem(systemId)

  return (
    <TableSession key={sig} rules={rules} systemId={systemId} seats={seats} desktop={desktop} />
  )
}

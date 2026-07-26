import { useMemo, useRef, useState } from 'react'
import {
  Panel,
  Stack,
  Inline,
  Text,
  Heading,
  Button,
  Segmented,
  Slider,
  Toggle,
  NumberStepper,
  Badge,
  Spinner,
  useToast,
} from '../../ui'
import { StatTile, LineChart } from '../../ui/charts'
import { PageHeader } from '../../screens/PageHeader'
import { useStore } from '../../store'
import { useEngine } from '../../training'
import { recordResult } from '../../training'
import type { Rules } from '../../engine/types'
import type { BetRamp, SimResult } from '../../engine/betting'
import { BetRampEditor } from './BetRampEditor'
import {
  computeRampStats,
  recommendSpread,
  growthBands,
  type RiskTolerance,
} from './rampStats'

const RISK_OPTIONS = [
  { value: 'low' as const, label: 'Low' },
  { value: 'med' as const, label: 'Medium' },
  { value: 'high' as const, label: 'High' },
]

const money0 = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const moneySigned = (n: number) =>
  `${n < 0 ? '−' : '+'}${money0(Math.abs(n))}`

function Section({
  title,
  description,
  children,
  actions,
}: {
  title: string
  description?: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <Panel padding="lg">
      <Stack gap={4}>
        <Inline justify="between" align="start" wrap className="gap-3">
          <Stack gap={1}>
            <Heading level={3}>{title}</Heading>
            {description && (
              <Text size="sm" tone="muted">
                {description}
              </Text>
            )}
          </Stack>
          {actions}
        </Inline>
        {children}
      </Stack>
    </Panel>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="sm" weight="medium">
        {label}
      </Text>
      {children}
    </Stack>
  )
}

export default function BettingSimView() {
  const engine = useEngine()
  const toast = useToast()

  // Bankroll + unit live in the persisted store.
  const bankroll = useStore((s) => s.bankroll)
  const setBankroll = useStore((s) => s.setBankroll)
  const unit = useStore((s) => s.unit)
  const setUnit = useStore((s) => s.setUnit)
  const storeRamp = useStore((s) => s.betRamp)
  const setStoreRamp = useStore((s) => s.setBetRamp)
  const settingsRules = useStore((s) => s.rules)

  // Working config (local, only bankroll/unit/ramp are persisted).
  const [ramp, setRamp] = useState<BetRamp>(storeRamp)
  const [riskTol, setRiskTol] = useState<RiskTolerance>('med')
  const [pen, setPen] = useState<number>(settingsRules.penetration)
  const [handsPerHour, setHandsPerHour] = useState<number>(100)
  const [handsPerSession, setHandsPerSession] = useState<number>(500)
  const [override, setOverride] = useState<boolean>(false)
  const [ruleOverrides, setRuleOverrides] = useState<Partial<Rules>>({})

  const rules = useMemo<Rules>(
    () => (override ? { ...settingsRules, ...ruleOverrides, penetration: pen } : { ...settingsRules, penetration: pen }),
    [override, settingsRules, ruleOverrides, pen],
  )

  const stats = useMemo(
    () => computeRampStats(ramp, rules, bankroll, unit, pen, handsPerHour),
    [ramp, rules, bankroll, unit, pen, handsPerHour],
  )

  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SimResult | null>(null)
  const seedRef = useRef(1)

  const run = async () => {
    setRunning(true)
    try {
      const res = await engine.simulate({
        rules,
        ramp,
        unit,
        bankroll,
        handsPerSession,
        sessions: 5000,
        seed: seedRef.current++,
        pen,
      })
      setResult(res)
      // Light-touch progress: completing an experiment counts toward the betting category.
      recordResult({ category: 'betting', correct: true, now: Date.now() })
    } catch (err) {
      toast.toast({ variant: 'bad', title: 'Simulation failed', message: String(err) })
    } finally {
      setRunning(false)
    }
  }

  const applyRecommended = () => {
    const rec = recommendSpread(bankroll, unit, rules, riskTol)
    setRamp(rec)
    toast.toast({
      variant: 'good',
      title: 'Spread applied',
      message: `A ${riskTol}-risk ramp for ${money0(bankroll)} at ${money0(unit)}/unit.`,
    })
  }

  const saveRamp = () => {
    setStoreRamp(ramp)
    toast.toast({ variant: 'good', title: 'Saved', message: 'Ramp saved to your bankroll settings.' })
  }

  const bands = useMemo(
    () => (result ? growthBands(result, bankroll, handsPerSession) : null),
    [result, bankroll, handsPerSession],
  )

  const rorPct = stats.riskOfRuin * 100
  const rorTone = stats.riskOfRuin >= 0.1 ? 'bad' : stats.riskOfRuin >= 0.02 ? 'neutral' : 'good'

  return (
    <>
      <PageHeader
        title="Betting & bankroll sim"
        description="Design a bet spread, then run a Monte-Carlo across thousands of sessions to see how your bankroll would grow — and what could sink it."
        actions={
          <Button variant="primary" onClick={run} disabled={running}>
            {running ? (
              <>
                <Spinner size="sm" /> Running…
              </>
            ) : (
              'Run simulation'
            )}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* ---- Left: configuration ---- */}
        <Stack gap={6}>
          <Section title="Bankroll">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bankroll">
                <NumberStepper
                  value={bankroll}
                  onChange={setBankroll}
                  min={0}
                  step={100}
                  formatValue={money0}
                />
              </Field>
              <Field label="Unit (base bet)">
                <NumberStepper value={unit} onChange={setUnit} min={1} step={5} formatValue={money0} />
              </Field>
            </div>
            <Text size="xs" tone="muted">
              Bankroll of {(unit > 0 ? bankroll / unit : 0).toFixed(0)} units.
            </Text>
          </Section>

          <Section
            title="Bet ramp"
            description="Units to wager at each true count."
            actions={
              <Button variant="ghost" size="sm" onClick={saveRamp}>
                Save
              </Button>
            }
          >
            <BetRampEditor ramp={ramp} onChange={setRamp} unit={unit} />
          </Section>

          <Section
            title="Recommend a spread"
            description="Fit a fractional-Kelly ramp to your bankroll and appetite for risk."
          >
            <Field label="Risk tolerance">
              <Segmented
                label="Risk tolerance"
                options={RISK_OPTIONS}
                value={riskTol}
                onChange={setRiskTol}
                block
              />
            </Field>
            <Button variant="secondary" onClick={applyRecommended} block>
              Recommend a spread for my bankroll &amp; risk
            </Button>
          </Section>

          <Section title="Game & pacing">
            <Field label={`Penetration — ${Math.round(pen * 100)}% of shoe`}>
              <Slider value={pen} onChange={setPen} min={0.5} max={0.95} step={0.05} showValue={false} />
            </Field>
            <Field label="Hands per hour">
              <Slider
                value={handsPerHour}
                onChange={setHandsPerHour}
                min={40}
                max={400}
                step={10}
                formatValue={(v) => `${v}`}
              />
            </Field>
            <Field label="Hands per session">
              <Slider
                value={handsPerSession}
                onChange={setHandsPerSession}
                min={100}
                max={2000}
                step={100}
                formatValue={(v) => `${v}`}
              />
            </Field>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
              <Stack gap={1}>
                <Text size="sm" weight="medium">
                  Override table rules
                </Text>
                <Text size="xs" tone="muted">
                  Off = use your Settings rules.
                </Text>
              </Stack>
              <Toggle checked={override} onChange={setOverride} label="Override table rules" />
            </div>
            {override && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Dealer 17">
                  <Segmented
                    label="Dealer 17"
                    options={[
                      { value: 'S17', label: 'S17' },
                      { value: 'H17', label: 'H17' },
                    ]}
                    value={ruleOverrides.soft17 ?? settingsRules.soft17}
                    onChange={(soft17) => setRuleOverrides((o) => ({ ...o, soft17 }))}
                  />
                </Field>
                <Field label="Blackjack pays">
                  <Segmented
                    label="Blackjack pays"
                    options={[
                      { value: '3:2', label: '3:2' },
                      { value: '6:5', label: '6:5' },
                    ]}
                    value={(ruleOverrides.blackjackPayout ?? settingsRules.blackjackPayout) as '3:2' | '6:5'}
                    onChange={(blackjackPayout) => setRuleOverrides((o) => ({ ...o, blackjackPayout }))}
                  />
                </Field>
              </div>
            )}
          </Section>
        </Stack>

        {/* ---- Right: live metrics + results ---- */}
        <Stack gap={6}>
          <Section
            title="At a glance"
            description="Live estimates for the current ramp — no simulation needed."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile
                label="EV / hour"
                value={moneySigned(stats.evHourDollars)}
                hint={`${handsPerHour} hands/hr`}
                deltaTone={stats.evHourDollars >= 0 ? 'good' : 'bad'}
              />
              <StatTile
                label="Risk of ruin"
                value={`${rorPct < 0.1 ? rorPct.toFixed(2) : rorPct.toFixed(1)}%`}
                hint="Lifetime, this bankroll"
                deltaTone={rorTone}
              />
              <StatTile
                label="N0"
                value={Number.isFinite(stats.n0) ? `${Math.round(stats.n0).toLocaleString()}` : '∞'}
                hint="Hands to beat variance"
              />
            </div>
            <Inline gap={2} wrap>
              <Badge>Avg bet {money0(stats.avgBetUnits * unit)}</Badge>
              <Badge>Spread 1–{Math.round(Math.max(...ramp.map((t) => t.units)))}×</Badge>
              <Badge>Plays {Math.round(stats.playRate * 100)}% of hands</Badge>
            </Inline>
          </Section>

          <Section
            title="Bankroll growth"
            description="Percentile outcomes across 5,000 simulated sessions."
          >
            {running && (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Spinner size="lg" />
                <Text size="sm" tone="muted">
                  Simulating 5,000 sessions…
                </Text>
              </div>
            )}

            {!running && !result && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Text tone="muted">Run a simulation to see percentile bankroll trajectories.</Text>
                <Button variant="primary" onClick={run}>
                  Run simulation
                </Button>
              </div>
            )}

            {!running && result && bands && (
              <Stack gap={4}>
                <LineChart
                  height={240}
                  ariaLabel="Bankroll growth percentiles over hands played"
                  yFormat={money0}
                  labels={bands.hands.map((h) => `${h}`)}
                  series={[
                    { name: 'p95', values: bands.p95, color: 'var(--chart-2)' },
                    { name: 'p75', values: bands.p75, color: 'var(--chart-4)' },
                    { name: 'Median', values: bands.p50, color: 'var(--accent)' },
                    { name: 'p25', values: bands.p25, color: 'var(--chart-4)' },
                    { name: 'p5', values: bands.p5, color: 'var(--chart-5)' },
                  ]}
                />
                <Text size="xs" tone="muted">
                  Bands anchored to the simulation's final percentiles; the median drifts from your
                  starting bankroll and the spread widens with the square root of hands played.
                </Text>

                <div className="grid gap-3 sm:grid-cols-3">
                  <StatTile
                    label="Median result"
                    value={moneySigned(result.median - bankroll)}
                    hint={`Ends near ${money0(result.median)}`}
                    deltaTone={result.median - bankroll >= 0 ? 'good' : 'bad'}
                  />
                  <StatTile
                    label="Mean result"
                    value={moneySigned(result.mean)}
                    hint="Average over sessions"
                    deltaTone={result.mean >= 0 ? 'good' : 'bad'}
                  />
                  <StatTile
                    label="Bust rate"
                    value={`${(result.bustRate * 100).toFixed(1)}%`}
                    hint={`Busted within ${handsPerSession} hands`}
                    deltaTone={result.bustRate >= 0.1 ? 'bad' : result.bustRate >= 0.02 ? 'neutral' : 'good'}
                  />
                  <StatTile
                    label="Worst 5%"
                    value={money0(result.percentiles.p5)}
                    hint="p5 final bankroll"
                    deltaTone={result.percentiles.p5 >= bankroll ? 'good' : 'bad'}
                  />
                  <StatTile
                    label="Best 5%"
                    value={money0(result.percentiles.p95)}
                    hint="p95 final bankroll"
                    deltaTone="good"
                  />
                  <StatTile
                    label="Downside SD"
                    value={money0(result.sd)}
                    hint="Std. dev of result"
                  />
                </div>
              </Stack>
            )}
          </Section>
        </Stack>
      </div>
    </>
  )
}

import { useRef, useState } from 'react'
import {
  Panel,
  Text,
  Heading,
  Stack,
  Inline,
  Button,
  Toggle,
  Segmented,
  Select,
  Slider,
  NumberStepper,
  Badge,
  Modal,
  useToast,
} from '../ui'
import { useStore, exportState, importState, resetPersisted, STORE_NAME } from '../store'
import { useSound } from '../audio'
import { RULE_PRESETS } from '../engine/rules'
import { SYSTEMS, FEATURED_SYSTEM_IDS } from '../engine/counting/systems'
import type { Rules } from '../engine/types'
import type { CountingSystem } from '../engine/types'
import { PageHeader } from './PageHeader'

// ---- layout helpers --------------------------------------------------------

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Panel padding="lg">
      <Stack gap={4}>
        <Stack gap={1}>
          <Heading level={3}>{title}</Heading>
          {description && <Text size="sm" tone="muted">{description}</Text>}
        </Stack>
        {children}
      </Stack>
    </Panel>
  )
}

function Row({ label, hint, control }: { label: string; hint?: string; control: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Text size="sm" weight="medium">{label}</Text>
        {hint && <Text size="xs" tone="muted">{hint}</Text>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

// ---- rule preset detection -------------------------------------------------

const RULE_KEYS = [
  'decks', 'soft17', 'das', 'double', 'maxSplitHands', 'resplitAces', 'hitSplitAces',
  'surrender', 'blackjackPayout', 'dealerPeek', 'insurance', 'penetration',
] as const

function rulesEqual(a: Rules, b: Rules): boolean {
  return RULE_KEYS.every((k) => a[k] === b[k])
}

// ---- main ------------------------------------------------------------------

export default function Settings() {
  const rules = useStore((s) => s.rules)
  const patchRules = useStore((s) => s.patchRules)
  const setRules = useStore((s) => s.setRules)
  const systemId = useStore((s) => s.systemId)
  const setSystemId = useStore((s) => s.setSystemId)
  const themeMode = useStore((s) => s.themeMode)
  const setThemeMode = useStore((s) => s.setThemeMode)
  const colorblind = useStore((s) => s.colorblind)
  const setColorblind = useStore((s) => s.setColorblind)
  const sound = useStore((s) => s.sound)
  const setSound = useStore((s) => s.setSound)
  const volume = useStore((s) => s.volume)
  const setVolume = useStore((s) => s.setVolume)
  const haptics = useStore((s) => s.haptics)
  const setHaptics = useStore((s) => s.setHaptics)
  const play = useSound()
  const adviceMode = useStore((s) => s.adviceMode)
  const setAdviceMode = useStore((s) => s.setAdviceMode)
  const dealingSpeed = useStore((s) => s.dealingSpeed)
  const setDealingSpeed = useStore((s) => s.setDealingSpeed)
  const tableSeats = useStore((s) => s.tableSeats)
  const setTableSeats = useStore((s) => s.setTableSeats)
  const trueCountRounding = useStore((s) => s.trueCountRounding)
  const setTrueCountRounding = useStore((s) => s.setTrueCountRounding)
  const showIndexNumbers = useStore((s) => s.showIndexNumbers)
  const setShowIndexNumbers = useStore((s) => s.setShowIndexNumbers)

  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const featured = SYSTEMS.filter((s) => FEATURED_SYSTEM_IDS.includes(s.id))
  const advanced = SYSTEMS.filter((s) => !FEATURED_SYSTEM_IDS.includes(s.id))
  const isAdvancedSelected = advanced.some((s) => s.id === systemId)

  const handleExport = () => {
    const json = exportState()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${STORE_NAME}-backup.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Exported', message: 'Your data was downloaded as JSON.', variant: 'good' })
  }

  const handleImportFile = async (file: File) => {
    const text = await file.text()
    const ok = importState(text)
    toast(
      ok
        ? { title: 'Imported', message: 'Your data was restored.', variant: 'good' }
        : { title: 'Import failed', message: 'That file is not a valid backup.', variant: 'bad' },
    )
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure the game rules the engine solves against, your counting system, appearance, and back up your data. Everything is stored locally on this device."
      />

      <Stack gap={5}>
        {/* -------- Rules -------- */}
        <Section title="Table rules" description="These feed the EV engine — strategy, edge, and advice update instantly.">
          <Stack gap={3}>
            <Text size="xs" tone="muted" weight="semibold" className="uppercase tracking-wide">Presets</Text>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {RULE_PRESETS.map((p) => {
                const active = rulesEqual(rules, p.rules)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setRules({ ...p.rules })}
                    aria-pressed={active}
                    className={
                      'rounded-[var(--radius-lg)] border p-3 text-left transition-colors duration-150 ' +
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ' +
                      (active
                        ? 'border-[var(--accent)] bg-[var(--surface-2)]'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]')
                    }
                  >
                    <Inline justify="between" align="center">
                      <Text size="sm" weight="semibold">{p.name}</Text>
                      {active && <Badge variant="accent" size="sm">Active</Badge>}
                    </Inline>
                    <Text size="xs" tone="muted">{p.description}</Text>
                  </button>
                )
              })}
            </div>
          </Stack>

          <Stack gap={4} className="pt-2">
            <Text size="xs" tone="muted" weight="semibold" className="uppercase tracking-wide">Individual rules</Text>

            <Row
              label="Decks"
              control={
                <Segmented<string>
                  label="Number of decks"
                  value={String(rules.decks)}
                  onChange={(v) => patchRules({ decks: Number(v) as Rules['decks'] })}
                  options={[1, 2, 4, 6, 8].map((n) => ({ value: String(n), label: String(n) }))}
                />
              }
            />
            <Row
              label="Dealer soft 17"
              hint="Hits (H17) or stands (S17) on soft 17"
              control={
                <Segmented<Rules['soft17']>
                  label="Soft 17 rule"
                  value={rules.soft17}
                  onChange={(v) => patchRules({ soft17: v })}
                  options={[
                    { value: 'S17', label: 'S17' },
                    { value: 'H17', label: 'H17' },
                  ]}
                />
              }
            />
            <Row
              label="Blackjack payout"
              control={
                <Segmented<Rules['blackjackPayout']>
                  label="Blackjack payout"
                  value={rules.blackjackPayout}
                  onChange={(v) => patchRules({ blackjackPayout: v })}
                  options={[
                    { value: '3:2', label: '3:2' },
                    { value: '6:5', label: '6:5' },
                    { value: '2:1', label: '2:1' },
                    { value: '1:1', label: '1:1' },
                  ]}
                />
              }
            />
            <Row
              label="Surrender"
              control={
                <Segmented<Rules['surrender']>
                  label="Surrender rule"
                  value={rules.surrender}
                  onChange={(v) => patchRules({ surrender: v })}
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'late', label: 'Late' },
                    { value: 'early', label: 'Early' },
                  ]}
                />
              }
            />
            <Row
              label="Doubling"
              control={
                <Select
                  aria-label="Doubling rule"
                  value={rules.double}
                  onChange={(e) => patchRules({ double: e.target.value as Rules['double'] })}
                  options={[
                    { value: 'any2', label: 'Any two cards' },
                    { value: '9-11', label: 'Totals 9–11' },
                    { value: '10-11', label: 'Totals 10–11' },
                  ]}
                />
              }
            />
            <Row
              label="Double after split (DAS)"
              control={<Toggle checked={rules.das} onChange={(v) => patchRules({ das: v })} ariaLabel="Double after split" />}
            />
            <Row
              label="Max split hands"
              control={
                <NumberStepper
                  label="Max split hands"
                  value={rules.maxSplitHands}
                  min={2}
                  max={4}
                  onChange={(n) => patchRules({ maxSplitHands: n })}
                />
              }
            />
            <Row
              label="Resplit aces"
              control={<Toggle checked={rules.resplitAces} onChange={(v) => patchRules({ resplitAces: v })} ariaLabel="Resplit aces" />}
            />
            <Row
              label="Hit split aces"
              control={<Toggle checked={rules.hitSplitAces} onChange={(v) => patchRules({ hitSplitAces: v })} ariaLabel="Hit split aces" />}
            />
            <Row
              label="Dealer peeks for blackjack"
              hint="US game peeks; European (ENHC) does not"
              control={<Toggle checked={rules.dealerPeek} onChange={(v) => patchRules({ dealerPeek: v })} ariaLabel="Dealer peek" />}
            />
            <Row
              label="Insurance offered"
              control={<Toggle checked={rules.insurance} onChange={(v) => patchRules({ insurance: v })} ariaLabel="Insurance offered" />}
            />
            <Row
              label="Penetration"
              hint="Fraction of the shoe dealt before reshuffle"
              control={
                <div className="w-48">
                  <Slider
                    label="Penetration"
                    min={0.5}
                    max={0.95}
                    step={0.05}
                    value={rules.penetration}
                    onChange={(n) => patchRules({ penetration: Number(n.toFixed(2)) })}
                    formatValue={(n) => `${Math.round(n * 100)}%`}
                  />
                </div>
              }
            />
          </Stack>
        </Section>

        {/* -------- Counting system -------- */}
        <Section title="Counting system" description="Balanced systems report a true count; unbalanced systems (KO) report a running count.">
          <Stack gap={3}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {featured.map((sys) => (
                <SystemButton key={sys.id} sys={sys} active={sys.id === systemId} onSelect={() => setSystemId(sys.id)} />
              ))}
            </div>

            <details className="rounded-[var(--radius-lg)] border border-[var(--border)] p-3" open={isAdvancedSelected}>
              <summary className="cursor-pointer text-sm font-medium">Advanced systems</summary>
              <div className="pt-3">
                <Select
                  label="Advanced counting system"
                  value={isAdvancedSelected ? systemId : ''}
                  onChange={(e) => e.target.value && setSystemId(e.target.value as CountingSystem['id'])}
                >
                  <option value="" disabled>Choose a system…</option>
                  {advanced.map((sys) => (
                    <option key={sys.id} value={sys.id}>
                      {sys.name} · level {sys.level}{sys.sideCountAces ? ' · ace side-count' : ''}
                    </option>
                  ))}
                </Select>
              </div>
            </details>
          </Stack>
        </Section>

        {/* -------- Appearance -------- */}
        <Section title="Appearance">
          <Stack gap={4}>
            <Row
              label="Theme"
              control={
                <Segmented<'light' | 'dark' | 'system'>
                  label="Theme"
                  value={themeMode}
                  onChange={setThemeMode}
                  options={[
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                    { value: 'system', label: 'Auto' },
                  ]}
                />
              }
            />
            <Row
              label="Colorblind-safe palette"
              hint="Uses blue/orange instead of green/red"
              control={<Toggle checked={colorblind} onChange={setColorblind} ariaLabel="Colorblind-safe palette" />}
            />
          </Stack>
        </Section>

        {/* -------- Gameplay & feedback -------- */}
        <Section title="Gameplay & feedback">
          <Stack gap={4}>
            <Row
              label="Advice mode"
              hint="When to surface engine advice"
              control={
                <Segmented<'always' | 'onDemand' | 'mistakes'>
                  label="Advice mode"
                  value={adviceMode}
                  onChange={setAdviceMode}
                  options={[
                    { value: 'always', label: 'Always' },
                    { value: 'onDemand', label: 'On demand' },
                    { value: 'mistakes', label: 'Mistakes' },
                  ]}
                />
              }
            />
            <Row
              label="True-count rounding"
              control={
                <Segmented<'quarter' | 'half' | 'full'>
                  label="True-count rounding"
                  value={trueCountRounding}
                  onChange={setTrueCountRounding}
                  options={[
                    { value: 'quarter', label: '¼' },
                    { value: 'half', label: '½' },
                    { value: 'full', label: 'Full' },
                  ]}
                />
              }
            />
            <Row
              label="Dealing speed"
              hint="Cards per minute in drills and live play"
              control={
                <div className="w-48">
                  <Slider
                    label="Dealing speed"
                    min={20}
                    max={200}
                    step={5}
                    value={dealingSpeed}
                    onChange={setDealingSpeed}
                    formatValue={(n) => `${n} cpm`}
                  />
                </div>
              }
            />
            <Row
              label="Table seats"
              hint="Other players at the live table"
              control={
                <NumberStepper label="Table seats" value={tableSeats} min={0} max={6} onChange={setTableSeats} />
              }
            />
            <Row
              label="Show index numbers"
              hint="Display deviation indices in trainers"
              control={<Toggle checked={showIndexNumbers} onChange={setShowIndexNumbers} ariaLabel="Show index numbers" />}
            />
          </Stack>
        </Section>

        {/* -------- Sound -------- */}
        <Section title="Sound" description="Synthesized cues for deals, chips, wins, and grading. Nothing is downloaded — it all works offline.">
          <Stack gap={4}>
            <Row
              label="Sound effects"
              control={<Toggle checked={sound} onChange={setSound} ariaLabel="Sound effects" />}
            />
            <Row
              label="Volume"
              hint="Master level for all cues"
              control={
                <Inline gap={3} align="center">
                  <div className="w-48">
                    <Slider
                      label="Volume"
                      min={0}
                      max={1}
                      step={0.05}
                      value={volume}
                      disabled={!sound}
                      onChange={setVolume}
                      formatValue={(n) => `${Math.round(n * 100)}%`}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!sound || volume <= 0}
                    onClick={() => play('chipStack')}
                  >
                    Test sound
                  </Button>
                </Inline>
              }
            />
            <Row
              label="Haptics"
              hint="Vibration feedback on supported devices"
              control={<Toggle checked={haptics} onChange={setHaptics} ariaLabel="Haptics" />}
            />
          </Stack>
        </Section>

        {/* -------- Data -------- */}
        <Section title="Data" description="Everything lives in this browser. Export a backup or move it to another device.">
          <Inline gap={2} wrap>
            <Button variant="secondary" onClick={handleExport}>Export data</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>Import data</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleImportFile(file)
              }}
            />
            <div className="flex-1" />
            <Button variant="danger" onClick={() => setConfirmReset(true)}>Reset all data</Button>
          </Inline>
        </Section>
      </Stack>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all data?"
        footer={
          <Inline gap={2} justify="end">
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                resetPersisted()
                setConfirmReset(false)
                toast({ title: 'Reset complete', message: 'All settings and progress were restored to defaults.', variant: 'warn' })
              }}
            >
              Reset everything
            </Button>
          </Inline>
        }
      >
        <Text size="sm" tone="muted">
          This restores rules, counting system, stats, progress, and bankroll to their defaults. This cannot be undone.
        </Text>
      </Modal>
    </>
  )
}

function SystemButton({ sys, active, onSelect }: { sys: CountingSystem; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={
        'rounded-[var(--radius-lg)] border p-3 text-left transition-colors duration-150 ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ' +
        (active
          ? 'border-[var(--accent)] bg-[var(--surface-2)]'
          : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]')
      }
    >
      <Inline justify="between" align="center">
        <Text size="sm" weight="semibold">{sys.name}</Text>
        {active && <Badge variant="accent" size="sm">Active</Badge>}
      </Inline>
      <Text size="xs" tone="muted">
        Level {sys.level} · {sys.balanced ? 'balanced (true count)' : 'unbalanced (running count)'}
      </Text>
    </button>
  )
}

import { Panel, Text, Stack } from '../ui'
import { StrategyChart } from '../ui/charts'
import { useStore } from '../store'
import { getSystem } from '../engine/counting/systems'
import { PageHeader } from './PageHeader'

export default function Reference() {
  const rules = useStore((s) => s.rules)
  const systemId = useStore((s) => s.systemId)
  const system = getSystem(systemId)

  return (
    <>
      <PageHeader
        title="Reference"
        description="Rule-aware, color-coded basic-strategy chart, solved live from your current rules. Index charts, counting-system, and betting references land here next."
      />
      <Stack gap={4}>
        <Panel padding="md" elevation="raised">
          <Stack gap={3}>
            <Text size="sm" tone="muted">
              Basic strategy — {rules.decks}D · {rules.soft17} · {rules.das ? 'DAS' : 'no DAS'} ·{' '}
              {rules.surrender === 'none' ? 'no surrender' : `${rules.surrender} surrender`} ·{' '}
              {rules.blackjackPayout} · counting with {system.name}
            </Text>
            <StrategyChart rules={rules} />
          </Stack>
        </Panel>
      </Stack>
    </>
  )
}

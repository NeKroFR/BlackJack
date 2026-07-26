import { useState } from 'react'
import { Segmented, Stack, Toggle } from '../ui'
import { useStore } from '../store'
import { useTraining } from '../training'
import { PageHeader } from './PageHeader'
import {
  IndexRecall,
  IndexTable,
  InsuranceDrill,
  PlayDeviation,
} from '../modes/deviations'

type SubMode = 'play' | 'recall' | 'insurance'

const SUB_MODES: { value: SubMode; label: string }[] = [
  { value: 'play', label: 'Play a deviation' },
  { value: 'recall', label: 'Index recall' },
  { value: 'insurance', label: 'Insurance' },
]

const DESCRIPTIONS: Record<SubMode, string> = {
  play: 'A hand, the dealer upcard, and a true count. Pick the correct play — deviate above the index, revert to basic below it.',
  recall: 'Recall the true-count index for each canonical play. Exact scores best; within one counts as close.',
  insurance: 'The dealer shows an Ace at a given count. Take insurance only when tens run rich enough — Hi-Lo TC ≥ +3.',
}

export default function Deviations() {
  const rules = useStore((s) => s.rules)
  const [mode, setMode] = useState<SubMode>('play')
  const [showTable, setShowTable] = useState(false)
  const training = useTraining()

  return (
    <>
      <PageHeader
        title="Deviations trainer"
        description={DESCRIPTIONS[mode]}
      />
      <Stack gap={5}>
        <Stack gap={3}>
          <Segmented
            label="Deviation drill"
            options={SUB_MODES}
            value={mode}
            onChange={setMode}
            block
          />
          <Toggle
            checked={showTable}
            onChange={setShowTable}
            label="Show index table"
            description="Reveal the canonical Illustrious 18 and Fab 4 for study."
          />
        </Stack>

        {mode === 'play' && (
          <PlayDeviation key="play" rules={rules} training={training} />
        )}
        {mode === 'recall' && (
          <IndexRecall key="recall" rules={rules} training={training} />
        )}
        {mode === 'insurance' && <InsuranceDrill key="insurance" training={training} />}

        {showTable && <IndexTable />}
      </Stack>
    </>
  )
}

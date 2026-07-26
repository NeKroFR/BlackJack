import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Heading, Inline, Panel, Stack, Text, useToast } from '../ui'
import { useStore, XP_PER_LEVEL } from '../store'
import { LESSONS, LessonCard, useCurriculum } from '../modes/learn'
import { PageHeader } from './PageHeader'

export default function Learn() {
  const { lessons, completedCount, currentId, complete } = useCurriculum()
  const level = useStore((s) => s.level)
  const xp = useStore((s) => s.xp)
  const dailyStreak = useStore((s) => s.dailyStreak)
  const { toast } = useToast()
  const navigate = useNavigate()

  // Which lesson card is open. Defaults to the current lesson. Once the user
  // toggles a card, their choice sticks instead of snapping back.
  const [expanded, setExpanded] = useState<string | null>(currentId)
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (!touched) setExpanded(currentId)
  }, [currentId, touched])

  // Auto-complete a lesson the moment its linked drill proves mastery. The
  // `complete` action is idempotent, so this fires at most once per lesson.
  const readyId = useMemo(
    () => lessons.find((l) => l.readyToComplete)?.lesson.id ?? null,
    [lessons],
  )
  useEffect(() => {
    if (!readyId) return
    const lesson = LESSONS.find((l) => l.id === readyId)
    complete(readyId, Date.now())
    if (lesson) {
      toast({
        variant: 'good',
        title: `${lesson.title} complete`,
        message: `+${lesson.xp} XP earned. Next lesson unlocked.`,
      })
    }
  }, [readyId, complete, toast])

  const total = LESSONS.length
  const pathPct = Math.round((completedCount / total) * 100)
  const xpIntoLevel = xp % XP_PER_LEVEL
  const allDone = completedCount === total

  function handleComplete(id: string) {
    const lesson = LESSONS.find((l) => l.id === id)
    complete(id, Date.now())
    if (lesson) {
      toast({
        variant: 'good',
        title: `${lesson.title} complete`,
        message: `+${lesson.xp} XP earned. Next lesson unlocked.`,
      })
    }
  }

  return (
    <>
      <PageHeader
        title="Learn"
        description="A guided path from basic strategy to live play. Finish a lesson to unlock the next."
      />

      <Stack gap={5}>
        <Panel
          padding="lg"
          elevation="raised"
          className="bg-[var(--felt)] text-[var(--felt-ink)]"
        >
          <Stack gap={2}>
            <Inline gap={2}>
              <Badge variant="accent" size="md">
                Level {level}
              </Badge>
              <Text size="sm" style={{ color: 'var(--felt-ink)', opacity: 0.85 }}>
                {dailyStreak > 0
                  ? `${dailyStreak}-day streak`
                  : 'Practice today to start a streak'}
              </Text>
            </Inline>
            <Heading level={2} style={{ color: 'var(--felt-ink)' }}>
              {allDone
                ? 'Path complete — keep sharpening'
                : `${completedCount} of ${total} lessons complete`}
            </Heading>
            <div className="w-64 max-w-full">
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/25">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
                  style={{ width: `${pathPct}%` }}
                />
              </div>
              <Text
                size="xs"
                style={{ color: 'var(--felt-ink)', opacity: 0.8 }}
                className="mt-1"
              >
                {xpIntoLevel} / {XP_PER_LEVEL} XP to level {level + 1}
              </Text>
            </div>
          </Stack>
        </Panel>

        <div>
          {lessons.map((view, i) => (
            <LessonCard
              key={view.lesson.id}
              view={view}
              index={i + 1}
              last={i === lessons.length - 1}
              expanded={expanded === view.lesson.id}
              onToggle={() => {
                setTouched(true)
                setExpanded((prev) => (prev === view.lesson.id ? null : view.lesson.id))
              }}
              onComplete={() => handleComplete(view.lesson.id)}
            />
          ))}
        </div>

        {allDone && (
          <Panel padding="md" inset>
            <Inline justify="between" align="center" wrap className="gap-3">
              <Text size="sm">
                You have finished the guided path. Keep your edge sharp with focused drills.
              </Text>
              <Button variant="secondary" size="sm" onClick={() => navigate('/drill/strategy')}>
                Drill strategy
              </Button>
            </Inline>
          </Panel>
        )}
      </Stack>
    </>
  )
}

import { useNavigate } from 'react-router-dom'
import { Badge, Button, Inline, Panel, Stack, Text, cn, focusRing } from '../../ui'
import { LessonContent } from './LessonContent'
import type { LessonView } from './useCurriculum'

interface LessonCardProps {
  view: LessonView
  /** 1-based number shown in the stepper node. */
  index: number
  last: boolean
  expanded: boolean
  onToggle(): void
  onComplete(): void
}

const STATUS_BADGE: Record<
  LessonView['status'],
  { label: string; variant: 'good' | 'accent' | 'neutral' | 'outline' } | null
> = {
  completed: { label: 'Completed', variant: 'good' },
  current: { label: 'In progress', variant: 'accent' },
  available: { label: 'Unlocked', variant: 'neutral' },
  locked: null,
}

function StepNode({ view, index }: { view: LessonView; index: number }) {
  const { status } = view
  const done = status === 'completed'
  const locked = status === 'locked'
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
        done && 'border-transparent bg-good text-good-ink',
        !done && !locked && 'border-accent text-accent',
        locked && 'border-border text-ink-muted',
      )}
      aria-hidden="true"
    >
      {done ? '✓' : locked ? '🔒' : index}
    </div>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
        style={{ width: `${Math.round(pct * 100)}%` }}
      />
    </div>
  )
}

/**
 * One node in the guided-path stepper. Collapsed it shows title + status. The
 * current/available/completed lessons expand to their teaching content, a
 * Practice CTA, and a Mark-complete action.
 */
export function LessonCard({
  view,
  index,
  last,
  expanded,
  onToggle,
  onComplete,
}: LessonCardProps) {
  const navigate = useNavigate()
  const { lesson, status, criterion, readyToComplete, completed } = view
  const locked = status === 'locked'
  const badge = STATUS_BADGE[status]

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <StepNode view={view} index={index} />
        {!last && <div className="mt-1 w-px flex-1 bg-border" />}
      </div>

      <Panel
        padding="none"
        elevation={status === 'current' ? 'raised' : 'flat'}
        className={cn('mb-3 flex-1 overflow-hidden', status === 'current' && 'border-accent/40')}
      >
        <button
          type="button"
          onClick={locked ? undefined : onToggle}
          disabled={locked}
          aria-expanded={expanded}
          className={cn(
            'flex w-full items-center justify-between gap-3 p-4 text-left transition-colors',
            !locked && 'hover:bg-surface-2',
            locked && 'cursor-not-allowed opacity-70',
            focusRing,
          )}
        >
          <Stack gap={1} className="min-w-0">
            <Inline gap={2} wrap>
              <Text weight="semibold">{lesson.title}</Text>
              {badge && (
                <Badge variant={badge.variant} size="sm">
                  {badge.label}
                </Badge>
              )}
              {readyToComplete && (
                <Badge variant="accent" size="sm">
                  Ready
                </Badge>
              )}
            </Inline>
            <Text size="sm" tone="muted" className="truncate">
              {locked ? 'Complete the previous lesson to unlock.' : lesson.subtitle}
            </Text>
          </Stack>
          {!locked && (
            <span aria-hidden="true" className="shrink-0 text-ink-muted">
              {expanded ? '▲' : '▼'}
            </span>
          )}
        </button>

        {expanded && !locked && (
          <div className="border-t border-border px-4 pb-4 pt-4">
            <Stack gap={5}>
              <LessonContent blocks={lesson.content} />

              <Panel inset padding="sm">
                <Stack gap={2}>
                  <Inline justify="between" align="center" wrap className="gap-2">
                    <Text size="sm" weight="medium">
                      {completed ? 'Completed' : lesson.criterion.label}
                    </Text>
                    <Text size="xs" tone={criterion.met ? 'good' : 'muted'} numeric>
                      {completed ? 'Done' : criterion.detail}
                    </Text>
                  </Inline>
                  <ProgressBar pct={completed ? 1 : criterion.progress} />
                </Stack>
              </Panel>

              <Inline gap={2} wrap justify="between">
                <Button
                  variant={completed ? 'secondary' : 'primary'}
                  onClick={() => navigate(lesson.drill.route)}
                >
                  {completed ? 'Practice again' : lesson.drill.label}
                </Button>
                {!completed && (
                  <Button
                    variant={readyToComplete ? 'primary' : 'ghost'}
                    onClick={onComplete}
                    title={
                      readyToComplete
                        ? 'Complete this lesson'
                        : 'You can mark this complete now, or keep practicing to earn it.'
                    }
                  >
                    {readyToComplete ? 'Complete & continue' : 'Mark complete'}
                  </Button>
                )}
              </Inline>
            </Stack>
          </div>
        )}
      </Panel>
    </div>
  )
}

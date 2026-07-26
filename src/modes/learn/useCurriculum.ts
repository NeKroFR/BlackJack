import { useCallback, useMemo } from 'react'
import { useStore } from '../../store'
import { checkAchievements, isoDay } from '../../training'
import {
  LESSONS,
  evalCriterion,
  nextLesson,
  type CriterionStatus,
  type Lesson,
} from './lessons'

const DAY_MS = 86_400_000

export type LessonStatus = 'completed' | 'current' | 'available' | 'locked'

export interface LessonView {
  lesson: Lesson
  status: LessonStatus
  unlocked: boolean
  completed: boolean
  criterion: CriterionStatus
  /** True when the criterion is satisfied but the lesson is not yet completed. */
  readyToComplete: boolean
}

export interface CurriculumView {
  lessons: LessonView[]
  completedCount: number
  /** The lesson the user should focus on next, if any remain. */
  currentId: string | null
}

export interface CurriculumApi extends CurriculumView {
  /**
   * Complete a lesson: award XP, mark it done, unlock the next, and record
   * daily activity. Idempotent: completing an already-done lesson is a no-op.
   * `now` is supplied by the caller so the store never reads the clock.
   */
  complete(lessonId: string, now: number): void
}

/**
 * Derives the guided-path view from persisted progress + stats and exposes a
 * `complete` action that advances the path. The first unlocked, not-yet-completed
 * lesson is the "current" one. Earlier completed lessons stay open for review and
 * later ones are locked until their predecessor is done.
 */
export function useCurriculum(): CurriculumApi {
  const curriculum = useStore((s) => s.curriculum)
  const unlockedModules = useStore((s) => s.unlockedModules)
  const accuracy = useStore((s) => s.accuracy)
  const sessions = useStore((s) => s.sessionHistory)

  const view = useMemo<CurriculumView>(() => {
    const input = { accuracy, sessions }
    let currentAssigned = false
    let currentId: string | null = null

    const lessons = LESSONS.map<LessonView>((lesson) => {
      const completed = curriculum[lesson.id] === true
      // First lesson is always unlocked, the rest follow the progress slice.
      const unlocked = lesson.order === 0 || unlockedModules.includes(lesson.id)
      const criterion = evalCriterion(lesson.criterion, input)

      let status: LessonStatus
      if (completed) {
        status = 'completed'
      } else if (!unlocked) {
        status = 'locked'
      } else if (!currentAssigned) {
        status = 'current'
        currentAssigned = true
        currentId = lesson.id
      } else {
        status = 'available'
      }

      return {
        lesson,
        status,
        unlocked,
        completed,
        criterion,
        readyToComplete: unlocked && !completed && criterion.met,
      }
    })

    return {
      lessons,
      completedCount: lessons.filter((l) => l.completed).length,
      currentId,
    }
  }, [curriculum, unlockedModules, accuracy, sessions])

  const complete = useCallback((lessonId: string, now: number) => {
    const s = useStore.getState()
    if (s.curriculum[lessonId]) return
    s.completeModule(lessonId)
    const lesson = LESSONS.find((l) => l.id === lessonId)
    if (lesson) s.addXp(lesson.xp)
    const next = nextLesson(lessonId)
    if (next) s.unlockModule(next.id)
    s.markActiveDay(isoDay(now), isoDay(now - DAY_MS))
    checkAchievements()
  }, [])

  return { ...view, complete }
}

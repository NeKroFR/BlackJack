import type { AccuracyCounter, AccuracyMap, SessionRecord, StatCategory } from '../../store'

/**
 * A single teaching block inside a lesson. Kept as a small discriminated union so
 * the renderer can style prose, lists, tables and callouts consistently.
 */
export type LessonBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][]; caption?: string }
  | { kind: 'note'; text: string }

/**
 * The condition that auto-completes a lesson. Evaluated purely from persisted
 * stats so a lesson finishes itself once its linked drill shows real mastery.
 */
export type Criterion =
  | {
      kind: 'accuracy'
      /** Stat categories whose counters are summed. */
      cats: StatCategory[]
      /** Minimum graded answers before the lesson can auto-complete. */
      minAttempts: number
      /** Target accuracy (0..1) over those answers. */
      targetAccuracy: number
      label: string
    }
  | {
      kind: 'sessions'
      /** Completed-session modes that count (empty = any mode). */
      modes: string[]
      minSessions: number
      label: string
    }

export interface Lesson {
  id: string
  /** 0-based position in the path, also the unlock order. */
  order: number
  title: string
  /** One-line framing shown on the collapsed card. */
  subtitle: string
  content: LessonBlock[]
  /** The drill this lesson sends you to practice in. */
  drill: { route: string; label: string; focus: string }
  criterion: Criterion
  /** XP awarded when the lesson is completed. */
  xp: number
}

/** Inputs the criterion evaluator needs, projected from the store. */
export interface CurriculumProgressInput {
  accuracy: AccuracyMap
  sessions: SessionRecord[]
}

export interface CriterionStatus {
  met: boolean
  /** 0..1 progress toward completion, for the progress bar. */
  progress: number
  /** Short human status, e.g. "12 / 20 hands at 78%". */
  detail: string
}

function sumCounters(acc: AccuracyMap, cats: StatCategory[]): AccuracyCounter {
  return cats.reduce<AccuracyCounter>(
    (a, c) => ({ correct: a.correct + acc[c].correct, total: a.total + acc[c].total }),
    { correct: 0, total: 0 },
  )
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

/** Evaluate a lesson's completion criterion against current progress. Pure. */
export function evalCriterion(c: Criterion, input: CurriculumProgressInput): CriterionStatus {
  if (c.kind === 'accuracy') {
    const { correct, total } = sumCounters(input.accuracy, c.cats)
    const acc = total === 0 ? 0 : correct / total
    const met = total >= c.minAttempts && acc >= c.targetAccuracy
    const volume = clamp01(total / c.minAttempts)
    const quality = clamp01(acc / c.targetAccuracy)
    const progress = met ? 1 : clamp01(volume * quality)
    const detail =
      total === 0
        ? `${c.minAttempts} hands at ${Math.round(c.targetAccuracy * 100)}% to pass`
        : `${total} / ${c.minAttempts} hands at ${Math.round(acc * 100)}%`
    return { met, progress, detail }
  }
  const matches = input.sessions.filter(
    (s) => c.modes.length === 0 || c.modes.includes(s.mode),
  ).length
  const met = matches >= c.minSessions
  const progress = clamp01(matches / c.minSessions)
  const detail = met
    ? `${matches} session${matches === 1 ? '' : 's'} played`
    : `Play ${c.minSessions} live session${c.minSessions === 1 ? '' : 's'}`
  return { met, progress, detail }
}

/**
 * The guided path. Order is load-bearing: each lesson unlocks the next on
 * completion, and `order` drives the stepper layout and unlock logic.
 */
export const LESSONS: Lesson[] = [
  {
    id: 'basic-strategy',
    order: 0,
    title: 'Basic Strategy',
    subtitle: 'The mathematically best play for every hand you can be dealt.',
    content: [
      {
        kind: 'p',
        text: 'Basic strategy is the complete set of correct plays for every combination of your hand and the dealer’s upcard, assuming a fresh shoe. It does not beat the house on its own, but it shrinks the edge to a fraction of a percent — and everything else you learn here is built on top of it. The goal is simple: know the right move instantly, without thinking.',
      },
      {
        kind: 'p',
        text: 'The chart is organized by hand type. Hard totals have no ace (or an ace counted as 1). Soft totals have an ace worth 11. Pairs may be split. Read the row for your hand, the column for the dealer, and play the cell.',
      },
      {
        kind: 'table',
        caption: 'A few anchor rules to memorize first',
        head: ['Hand', 'Play', 'Why'],
        rows: [
          ['11', 'Double (else hit)', 'You are a strong favorite to make 20 or 21.'],
          ['Hard 17+', 'Always stand', 'Too likely to bust; let the dealer risk it.'],
          ['Hard 12–16 vs 2–6', 'Stand', 'The dealer shows a weak card and busts often.'],
          ['Hard 12–16 vs 7–A', 'Hit', 'The dealer is strong; a stiff hand loses if you stand.'],
          ['A,A and 8,8', 'Always split', 'Two fresh hands beat one bad total.'],
          ['5,5 and 10,10', 'Never split', 'Play 10 as a double; keep a made 20.'],
        ],
      },
      {
        kind: 'note',
        text: 'Dealer bust rates drive most of these decisions: a 5 or 6 upcard busts ~42% of the time, but a 10 busts only ~21%. That is why you stand on stiff hands against weak upcards and hit them against strong ones.',
      },
      {
        kind: 'p',
        text: 'The full color-coded chart for your current rules lives on the Reference screen. In the drill you will see one hand at a time, choose an action, and get instant feedback with the exact EV of each option so the pattern sticks.',
      },
    ],
    drill: { route: '/drill/strategy', label: 'Practice basic strategy', focus: 'All hands' },
    criterion: {
      kind: 'accuracy',
      cats: ['basicStiff', 'basicSoft', 'basicSplit'],
      minAttempts: 20,
      targetAccuracy: 0.8,
      label: 'Reach 80% over 20 basic-strategy hands',
    },
    xp: 50,
  },
  {
    id: 'running-count',
    order: 1,
    title: 'Running Count',
    subtitle: 'Track the shoe’s richness one card at a time with Hi-Lo.',
    content: [
      {
        kind: 'p',
        text: 'A shoe rich in tens and aces favors the player; one rich in low cards favors the dealer. Card counting measures this by assigning each rank a tag and keeping a running tally as cards are exposed. The default system, Hi-Lo, is balanced and simple.',
      },
      {
        kind: 'table',
        caption: 'Hi-Lo tag values',
        head: ['Cards', 'Tag'],
        rows: [
          ['2, 3, 4, 5, 6', '+1'],
          ['7, 8, 9', '0'],
          ['10, J, Q, K, A', '−1'],
        ],
      },
      {
        kind: 'p',
        text: 'Start every shoe at 0. Add the tag of each card as it appears — yours, the dealer’s, and every other player’s. A positive running count means proportionally more low cards have left the shoe, so the remaining cards are richer for you.',
      },
      {
        kind: 'note',
        text: 'Because Hi-Lo is balanced, counting down a full 52-card deck always returns to exactly 0. Use that as a self-check: deal through a deck and confirm you land on zero.',
      },
      {
        kind: 'p',
        text: 'The skill to build here is speed and accuracy under pressure. In the drill, cards flash by at an adjustable pace and you call the running count. Learn to cancel pairs (a +1 and a −1 net to zero) and to count in smooth increments rather than re-adding from scratch.',
      },
    ],
    drill: { route: '/drill/count', label: 'Practice the running count', focus: 'Running count' },
    criterion: {
      kind: 'accuracy',
      cats: ['counting'],
      minAttempts: 15,
      targetAccuracy: 0.7,
      label: 'Reach 70% over 15 counting rounds',
    },
    xp: 50,
  },
  {
    id: 'true-count',
    order: 2,
    title: 'True Count & Deck Estimation',
    subtitle: 'Convert the running count into a per-deck edge you can act on.',
    content: [
      {
        kind: 'p',
        text: 'A running count of +6 means very different things with six decks left versus one deck left. The true count normalizes for how much shoe remains, and it is the number you actually bet and deviate from.',
      },
      {
        kind: 'note',
        text: 'True count = running count ÷ decks remaining.',
      },
      {
        kind: 'table',
        caption: 'Same running count, different true counts',
        head: ['Running', 'Decks left', 'True count'],
        rows: [
          ['+6', '6', '+1'],
          ['+6', '3', '+2'],
          ['+6', '1.5', '+4'],
        ],
      },
      {
        kind: 'p',
        text: 'Decks remaining is estimated by eye from the discard tray: judge how many decks of cards have been dealt and subtract from the shoe size. Estimating to the nearest half-deck is accurate enough. With practice you read the tray in a glance.',
      },
      {
        kind: 'p',
        text: 'This lesson reuses the count drill, now with “call the true count” prompts that make you divide by your deck estimate. Getting fast at this conversion is what turns a running count into real decisions.',
      },
    ],
    drill: { route: '/drill/count', label: 'Practice true-count conversion', focus: 'True count' },
    criterion: {
      kind: 'accuracy',
      cats: ['counting'],
      minAttempts: 40,
      targetAccuracy: 0.8,
      label: 'Reach 80% over 40 counting rounds',
    },
    xp: 50,
  },
  {
    id: 'deviations',
    order: 3,
    title: 'Deviations (Illustrious 18)',
    subtitle: 'The count-driven plays that override basic strategy.',
    content: [
      {
        kind: 'p',
        text: 'At extreme counts the composition of the shoe shifts enough that the best play changes. These index plays — the most valuable of which are called the Illustrious 18 — tell you the true count at which to break from basic strategy. Each has an index number: act one way at or above it, the basic-strategy way below it.',
      },
      {
        kind: 'table',
        caption: 'A few high-value Hi-Lo indices',
        head: ['Hand', 'Index', 'At or above the index'],
        rows: [
          ['Insurance', '+3', 'Take insurance'],
          ['16 vs 10', '0', 'Stand instead of hit'],
          ['15 vs 10', '+4', 'Stand instead of hit'],
          ['12 vs 3', '+2', 'Stand instead of hit'],
          ['10 vs 10', '+4', 'Double instead of hit'],
        ],
      },
      {
        kind: 'note',
        text: 'Insurance is the single most important deviation. Never take it as a basic-strategy player, but always take it at a true count of +3 or higher.',
      },
      {
        kind: 'p',
        text: 'The trainer derives every index directly from the EV engine, so it stays correct for your exact rules and system — not just Hi-Lo defaults. The drill shows a hand plus a true count and asks for the correct action, mixing in insurance decisions.',
      },
    ],
    drill: { route: '/drill/deviations', label: 'Practice deviations', focus: 'Illustrious 18' },
    criterion: {
      kind: 'accuracy',
      cats: ['deviations'],
      minAttempts: 20,
      targetAccuracy: 0.75,
      label: 'Reach 75% over 20 deviation hands',
    },
    xp: 60,
  },
  {
    id: 'betting',
    order: 4,
    title: 'Betting & Bankroll',
    subtitle: 'Turn your edge into profit while surviving the variance.',
    content: [
      {
        kind: 'p',
        text: 'Counting only pays if you bet more when you have the edge. As a rule of thumb your advantage rises by roughly half a percent for each point of true count above the break-even pivot. So you flat-bet the minimum at low counts and ramp your bet up as the count climbs — this is your bet spread.',
      },
      {
        kind: 'table',
        caption: 'A simple example bet ramp (in units)',
        head: ['True count', 'Bet'],
        rows: [
          ['≤ +1', '1 unit'],
          ['+2', '2 units'],
          ['+3', '4 units'],
          ['+4 and up', '6–8 units'],
        ],
      },
      {
        kind: 'p',
        text: 'Bet size must respect your bankroll. Bet too big for your edge and a normal losing streak wipes you out — this is risk of ruin. The Kelly criterion sets the mathematically optimal fraction; most players use a fraction of Kelly to smooth the swings. A common guideline is a unit around 1% of a total bankroll of at least a few hundred units.',
      },
      {
        kind: 'note',
        text: 'Two numbers frame the grind: N0, the hands needed for your expected win to overcome one standard deviation of variance, and risk of ruin, the chance of busting before you get there. The Betting sim shows both for any spread.',
      },
      {
        kind: 'p',
        text: 'Head to the Betting sim to configure a spread, run a Monte-Carlo simulation, and see the bankroll-growth percentiles, risk of ruin, N0, and EV per hour for your plan.',
      },
    ],
    drill: { route: '/betting', label: 'Open the betting sim', focus: 'Spread & bankroll' },
    criterion: {
      kind: 'sessions',
      modes: ['betting'],
      minSessions: 1,
      label: 'Run one betting simulation',
    },
    xp: 60,
  },
  {
    id: 'live-play',
    order: 5,
    title: 'Putting It Together',
    subtitle: 'Count, size your bets, and deviate at real table speed.',
    content: [
      {
        kind: 'p',
        text: 'Everything converges at the felt. Now you keep the count yourself through a full round — your cards, the dealer’s, and other players’ — convert to a true count, size your bet before the deal, take insurance only when the index says so, and apply deviations mid-hand. All at real speed, with distractions.',
      },
      {
        kind: 'list',
        items: [
          'Before the deal: estimate decks remaining, compute the true count, place your bet off the ramp.',
          'During the hand: play basic strategy, overriding it only when an index applies.',
          'On a dealer ace: take insurance only at true count +3 or higher.',
          'After the hand: update the count and check your decision EV in the post-hand feedback.',
        ],
      },
      {
        kind: 'note',
        text: 'Set the advice mode to “mistakes only” so the table stays quiet until you slip — the closest thing to real conditions while still catching errors.',
      },
      {
        kind: 'p',
        text: 'The live game seats up to six other players, offers insurance, tracks a session bankroll, and reports the running EV of your decisions. Play a full session to complete the path.',
      },
    ],
    drill: { route: '/play', label: 'Play a live session', focus: 'Full table' },
    criterion: {
      kind: 'sessions',
      modes: ['play'],
      minSessions: 1,
      label: 'Play one live session',
    },
    xp: 80,
  },
]

/** Look up a lesson by id. */
export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id)
}

/** The lesson that follows `id` in the path, if any. */
export function nextLesson(id: string): Lesson | undefined {
  const l = lessonById(id)
  if (!l) return undefined
  return LESSONS.find((x) => x.order === l.order + 1)
}

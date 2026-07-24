import type { Rules } from './types'

/**
 * Canonical modern shoe game: 6 decks, dealer stands on soft 17, double any two,
 * double after split, late surrender, 3:2 blackjack, US peek. ~0.33% house edge
 * (exact off-the-top, no-surrender variant ~0.40%). Out-of-the-box default,
 * everything is user-configurable.
 */
export const DEFAULT_RULES: Rules = {
  decks: 6,
  soft17: 'S17',
  das: true,
  double: 'any2',
  maxSplitHands: 4,
  resplitAces: false,
  hitSplitAces: false,
  surrender: 'late',
  blackjackPayout: '3:2',
  dealerPeek: true,
  insurance: true,
  penetration: 0.75,
}

export interface RulePreset {
  id: string
  name: string
  description: string
  rules: Rules
}

export const RULE_PRESETS: RulePreset[] = [
  {
    id: 'vegas-6d-s17',
    name: 'Vegas 6-Deck (S17)',
    description: '6 decks · S17 · DAS · late surrender · 3:2',
    rules: { ...DEFAULT_RULES },
  },
  {
    id: 'vegas-2d-h17',
    name: 'Vegas 2-Deck (H17)',
    description: '2 decks · H17 · DAS · no surrender · 3:2',
    rules: {
      ...DEFAULT_RULES,
      decks: 2,
      soft17: 'H17',
      surrender: 'none',
      penetration: 0.7,
    },
  },
  {
    id: 'single-deck-h17-65',
    name: 'Single Deck (6:5)',
    description: '1 deck · H17 · no DAS · 6:5 blackjack (a trap — teaches why rules matter)',
    rules: {
      ...DEFAULT_RULES,
      decks: 1,
      soft17: 'H17',
      das: false,
      surrender: 'none',
      blackjackPayout: '6:5',
      penetration: 0.6,
    },
  },
  {
    id: 'euro-enhc',
    name: 'European (ENHC)',
    description: '6 decks · S17 · no hole card · no surrender · 3:2',
    rules: {
      ...DEFAULT_RULES,
      dealerPeek: false,
      surrender: 'none',
    },
  },
]

/** Multiplier applied to a winning natural under the given payout. */
export function blackjackMultiplier(rules: Rules): number {
  switch (rules.blackjackPayout) {
    case '3:2':
      return 1.5
    case '6:5':
      return 1.2
    case '2:1':
      return 2
    case '1:1':
      return 1
  }
}

import { bugRisk } from './bug-risk';
import { constituentBreak } from './constituent-break';
import type { JevDecisionEntry, JevDecisionRow } from './entry';
import { outboxRisk } from './outbox-risk';
import { questionCategory } from './question-category';
import { unknownWorthAsking } from './unknown-worth-asking';

// The registry of Jev decisions (PRD 812, decision 9): one file per decision, listed here. The five
// rows (PRD 855 s4 added Unknown worth asking, PRD 871 s4 `constituent-break`) are the ones public.jev_decision_names() allows, in the page's order; a decision whose entry is
// not registered yet is shown on Settings › Jev as coming, and cannot be switched on. An entry with `terminal` can also be asked from a Claude session, through
// `POST /api/decide/<name>` (./decide-route.ts).

export type { JevDecisionEntry, JevDecisionRow } from './entry';

export const JEV_DECISIONS: readonly JevDecisionRow[] = Object.freeze([
  {
    name: 'question-category',
    title: 'Question category',
    about: 'Sorts each question round into Business, Product, UX/UI, Architecture, Harness or Other.',
    sends: 'The round’s questions, their options and descriptions (never a preview), and its repository, branch, PRD and skill.',
  },
  {
    name: 'outbox-risk',
    title: 'Outbox item risk',
    about: 'Says whether a decision a slice took alone is hard to revert, which sets whether a person is asked.',
    sends: 'The item’s decision text and options, the slice’s title and the paths the slice touches.',
  },
  {
    name: 'bug-risk',
    title: 'Bug risk',
    about: 'Sets a bug’s risk to critical, high, medium or low.',
    sends: 'The issue’s title and body, the reproduction’s path, the domain and the agent’s own one-sentence risk.',
  },
  {
    name: 'unknown-worth-asking',
    title: 'Unknown worth asking',
    about: 'Says whether a question an editor’s agent could not answer is worth asking a person; when not, it is set aside on Settings › Business, with Bring back.',
    sends: 'The agent’s question, its repository and file, and the product’s confirmed claims.',
  },
  {
    name: 'constituent-break',
    title: 'Constituent break',
    about: 'Says whether a phase-0 spec breaks its product’s Statement or one of its Never lines, which turns the inbox check red.',
    sends: 'The spec, the product’s Statement and Never lines, and today’s verdict with the quotes it found.',
  },
]);

const REGISTRY: Readonly<Record<string, JevDecisionEntry<any, any>>> = Object.freeze({ // ts-allow: each entry has its own input and value types; jevEntry hands them out as unknown
  [questionCategory.name]: questionCategory,
  [outboxRisk.name]: outboxRisk,
  [bugRisk.name]: bugRisk,
  [unknownWorthAsking.name]: unknownWorthAsking,
  [constituentBreak.name]: constituentBreak,
});

/** The decision's registry entry, or null when it has none (yet). */
export function jevEntry(name: string): JevDecisionEntry<unknown, unknown> | null {
  return Object.hasOwn(REGISTRY, name) ? REGISTRY[name]! : null;
}

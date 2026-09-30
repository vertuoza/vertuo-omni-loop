import type { JevDecisionEntry, JevDecisionRow } from './entry';
import { questionCategory } from './question-category';

// The registry of Jev decisions (PRD 812, decision 9): one file per decision, listed here. The three
// rows are the ones public.jev_decision_names() allows, in the page's order; a decision whose entry is
// not registered yet is shown on Settings › Jev as coming, and cannot be switched on. `outbox-risk`
// arrives with PRD 812 s3, `bug-risk` with s5.

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
]);

const REGISTRY: Readonly<Record<string, JevDecisionEntry<any, any>>> = Object.freeze({
  [questionCategory.name]: questionCategory,
});

/** The decision's registry entry, or null when it has none (yet). */
export function jevEntry(name: string): JevDecisionEntry<unknown, unknown> | null {
  return Object.hasOwn(REGISTRY, name) ? REGISTRY[name] : null;
}

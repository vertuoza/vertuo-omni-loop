import { bugRisk } from './bug-risk';
import { constituentBreak } from './constituent-break';
import type { JevDecisionEntry, JevDecisionRow } from './entry';
import { hitlCategory } from './hitl-category';
import { lawWorth } from './law-worth';
import { outboxRisk } from './outbox-risk';
import { questionCategory } from './question-category';
import { searchCategory } from './search-category';
import { searchRelevant } from './search-relevant';
import { unknownWorthAsking } from './unknown-worth-asking';
import { defined } from 'omni-loop/kit/lib/narrow.ts';

// The registry of Jev decisions (PRD 812, decision 9): one file per decision, listed here. The nine
// rows (PRD omni-loop-8 s3 added `search-relevant`, PRD omni-loop-7 s2 added `search-category`, PRD 855 s4 added Unknown worth asking, PRD 871 s4 `constituent-break`, PRD 1217 s3 `hitl-category`, PRD 1342 s3 `law-worth`) are the ones public.jev_decision_names() allows, in the page's order; a decision whose entry is
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
  {
    name: 'hitl-category',
    title: 'Human work kind',
    about: 'Sorts each new piece of human work a roadmap waits on into Business, Development, Dev ops or Delivery ops; Off, the kit’s rules sort it.',
    sends: 'The entry’s source, text, act and repository, and its PRD’s title.',
  },
  {
    name: 'law-worth',
    title: 'Worth a law',
    about: 'Says whether a rule or an invariant the harvest found is worth a law, a test that fails when it is broken; when not, it stays in its PRD’s settled decisions.',
    sends: 'The decision’s statement, its why, the principle it serves, its domain and its PRD’s title.',
  },
  {
    name: 'search-category',
    title: 'Search category',
    about: 'Sorts each question an agent searched a product’s knowledge for into one of the product’s domains, or Other; Off, the question keeps no category and is still grouped by its meaning.',
    sends: 'The question searched for and the names of the product’s domains; never a person, a key or a result.',
  },
  {
    name: 'search-relevant',
    title: 'Search relevance',
    about: 'Says whether an entry of a product’s knowledge answers a question an agent searched for, which makes it a right answer of the product’s eval set (at 0.6 or more); Off, no right answer is added and a member gives them on the Eval page.',
    sends: 'The question searched for, and the entry’s title and text; never a person, a key or another hit.',
  },
]);

// Each entry has its own input and value types; the registry, and jevEntry, hand them out as unknown.
const REGISTRY: Readonly<Record<string, JevDecisionEntry<unknown, unknown>>> = Object.freeze({
  [questionCategory.name]: questionCategory,
  [outboxRisk.name]: outboxRisk,
  [bugRisk.name]: bugRisk,
  [unknownWorthAsking.name]: unknownWorthAsking,
  [constituentBreak.name]: constituentBreak,
  [hitlCategory.name]: hitlCategory,
  [lawWorth.name]: lawWorth,
  [searchCategory.name]: searchCategory,
  [searchRelevant.name]: searchRelevant,
});

/** The decision's registry entry, or null when it has none (yet). */
export function jevEntry(name: string): JevDecisionEntry<unknown, unknown> | null {
  return Object.hasOwn(REGISTRY, name) ? defined(REGISTRY[name], `the ${name} decision`) : null;
}

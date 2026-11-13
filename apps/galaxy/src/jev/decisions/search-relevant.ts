import { z } from 'zod';
import type { JevDecisionEntry } from './entry';

// `search-relevant` (PRD omni-loop-8 s3): whether one entry of a product's knowledge answers one question an
// agent searched for, as a Noul built as `law-worth` is. A Noul at or above RELEVANT_FROM is a right answer
// (true); under it, not (false). The workspace's own threshold can only raise that bar: the eval set's right
// answers are never judged looser than 0.6. Jev reads the question, the entry's title and its text, never a
// key, a person or another hit. Asked by the App's `search-eval-promote` job through
// `POST /api/search/relevant` (../../search-eval/relevant-route.ts), signed under SEARCH_CATEGORIZE_SECRET.

/** The Noul from which an entry answers its question. */
export const RELEVANT_FROM = 0.6;

/** The most of an entry's text Jev reads. */
export const ENTRY_TEXT_MAX = 6000;

export interface SearchRelevantInput {
  question: string;
  title: string;
  text: string;
}

const STATE = z.object({
  question: z.string().trim().min(1).max(2000),
  title: z.string().trim().min(1).max(500),
  text: z.string().max(ENTRY_TEXT_MAX),
}).strict();

/** The state a caller sent, as the decision reads it, or null when it is not one. */
export function searchRelevantInput(state: unknown): SearchRelevantInput | null {
  const read = STATE.safeParse(state);
  return read.success ? read.data : null;
}

export const searchRelevant: JevDecisionEntry<SearchRelevantInput, boolean> = {
  name: 'search-relevant',
  question: {
    type: 'noul',
    statement:
      'This entry of a software product\'s knowledge answers the question a coding agent asked: reading it ' +
      'would give the agent what it needs to know, not only a nearby topic or a word in common.',
  },
  state: (input) => [`Question: ${input.question}`, `Entry: ${input.title}`, input.text].join('\n'),
  value: (answer, { threshold }) =>
    typeof answer === 'number' && Number.isFinite(answer) && answer >= 0 && answer <= 1 ? answer >= Math.max(threshold, RELEVANT_FROM) : null,
  show: (value) => String(value),
};

import type { JevDecisionEntry } from './entry';

// `search-category` (PRD omni-loop-7 s2): the category of a logged search question, one of the product's
// domains or `other`, as a Choice. Jev reads the question alone, never a key, a person or a hit. Its
// options are the product's domain keys, so they are given per call (`searchCategoryFor`); the registry
// entry (`searchCategory`) holds the one option every product has, `other`. An answer that is not one of
// the options keeps no category. Asked by the App's `search-categorize` job through
// `POST /api/search/categorize` (../../search-categorize/route.ts), signed under SEARCH_CATEGORIZE_SECRET.

/** The category of a question no domain holds. */
export const OTHER = 'other';

/** A domain of the product, as the choice offers it: its key and its name. */
export interface SearchDomain {
  key: string;
  name: string;
}

export interface SearchCategoryInput {
  question: string;
}

const INSTRUCTIONS = 'Which topic of a software product does this question, asked by a coding agent of the product\'s knowledge, belong to?';

/** The decision for one product: its domains, then `other`, as the options. */
export function searchCategoryFor(domains: readonly SearchDomain[]): JevDecisionEntry<SearchCategoryInput, string> {
  const options = [
    ...domains.filter((d) => d.key !== OTHER).map((d) => ({ key: d.key, description: d.name })),
    { key: OTHER, description: 'A question none of the other topics holds.' },
  ];
  const keys = new Set(options.map((o) => o.key));
  return {
    name: 'search-category',
    question: { type: 'choice', instructions: INSTRUCTIONS, options },
    state: (input) => input.question,
    value: (answer) => (typeof answer === 'string' && keys.has(answer) ? answer : null),
    show: (value) => value,
  };
}

/** The registry's entry: a product with no domain, so `other` alone. */
export const searchCategory = searchCategoryFor([]);

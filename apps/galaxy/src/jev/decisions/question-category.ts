import { CATEGORIES, HOLDS, describeRound, isCategory, type Category, type ClassifyInput } from '../../ask/classify';
import type { JevDecisionEntry } from './entry';

// `question-category` (PRD 812 s2): a question round's category, one of six, as a Choice. Jev reads
// exactly what Haiku reads today (src/ask/classify.ts): the round's questions, their options and
// descriptions, never an option's preview, and its context. Its answer is a category's value; anything
// else is outside the question, and today's answer counts.

export const questionCategory: JevDecisionEntry<ClassifyInput, Category> = {
  name: 'question-category',
  question: {
    type: 'choice',
    instructions: 'Which category does this question, asked of a person by a coding agent, belong to?',
    options: CATEGORIES.map((key) => ({ key, description: HOLDS[key] })),
  },
  state: (input) => describeRound(input),
  value: (answer) => (typeof answer === 'string' && isCategory(answer) ? answer : null),
  show: (value) => value,
};

import type { JevDecisionEntry } from './entry';
import { noulAt } from './outbox-risk';

// `unknown-worth-asking` (PRD 855 s4): whether a question an editor's agent reported through the MCP
// link's report_unknown is worth a person's time, as a Noul. At or above the decision's threshold it is
// worth asking (true); under it, not (false), and a counted "no" sets the question aside on Settings ›
// Business (../../agent-connect/questions/jev.ts). Jev reads the question, its repository and file, and
// the product's confirmed claims (agent_question_for_jev(), 20261028110000_unknown_worth_asking.sql).
// Today's answer, without Jev, is always "worth asking": every question waits for a person. Made in
// Galaxy only, after the report has answered: a terminal never asks it.

export interface UnknownInput {
  question: string;
  repo: string | null;
  file: string | null;
  /** The product's confirmed claims, as `<kind>#<seq>: value`. */
  claims: string[];
}

export const unknownWorthAsking: JevDecisionEntry<UnknownInput, boolean> = {
  name: 'unknown-worth-asking',
  question: {
    type: 'noul',
    statement:
      'A coding agent could not answer this question about the business it builds software for from what ' +
      'the business has on file. It is worth asking a person on the team: the answer is a fact about the ' +
      'business (who the customers are, where it sells, what it offers, against whom, what it never builds) ' +
      'that the claims on file do not already settle, and the question is not junk, a test or a code question.',
  },
  state: (input) =>
    [
      `Question: ${input.question}`,
      ...(input.repo ? [`Repository: ${input.repo}`] : []),
      ...(input.file ? [`File: ${input.file}`] : []),
      ...(input.claims.length ? ['Confirmed claims:', ...input.claims.map((c) => `- ${c}`)] : ['No confirmed claim on file.']),
    ].join('\n'),
  value: (answer, { threshold }) => noulAt(answer, threshold),
  show: (value) => String(value),
};

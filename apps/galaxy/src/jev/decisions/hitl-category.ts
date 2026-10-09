import { isOneOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { HUMAN_WORK_KINDS, type HumanWorkKind, type HumanWorkSource } from '../../roadmap/store';
import type { JevDecisionEntry } from './entry';

// `hitl-category` (PRD 1217 s3): the kind of one piece of human work a roadmap waits on, as a Choice over
// the four kinds, each described as the spec's table says what it holds. Jev reads the entry's source,
// text, act and repository, and the title of its PRD; never a path, a prompt or a transcript. Today's
// answer is the kind the kit's rules gave the entry (`ruleKind`, kit/lib/roadmap/human-work.ts); an
// answer outside the four is dropped, and today's counts. Made in Galaxy only, once per new key, after
// the push has answered (../../roadmap/classify-jev.ts): a terminal never asks it.

export interface HitlInput {
  source: HumanWorkSource;
  text: string;
  act: string | null;
  repo: string;
  prdTitle: string | null;
}

const HITL_HOLDS: Readonly<Record<HumanWorkKind, string>> = Object.freeze({
  business: 'A product or business choice: scope, priority, wording, who it is for.',
  development: 'A code or design decision a developer makes, a stuck slice, a red CI after its attempts.',
  'dev-ops': 'A right missing in the repository: a secret, a token scope, a grant, an app permission, branch protection.',
  'delivery-ops': 'Putting the roadmap in production: a deploy, a migration run, a console step, a production setting or variable.',
});

const FROM: Readonly<Record<HumanWorkSource, string>> = Object.freeze({
  question: 'an open question of the roadmap, for a person',
  outbox: 'a decision a coding agent could not take alone (an outbox item)',
  park: 'a PRD the loop parked until a person acts',
  clarification: 'a question the planner asked before planning a PRD',
});

export const hitlCategory: JevDecisionEntry<HitlInput, HumanWorkKind> = {
  name: 'hitl-category',
  question: {
    type: 'choice',
    instructions: 'Which kind of human work is this, which a roadmap of a software product waits on before a coding agent can go on?',
    options: HUMAN_WORK_KINDS.map((key) => ({ key, description: HITL_HOLDS[key] })),
  },
  state: (input) =>
    [
      `Source: ${FROM[input.source]}`,
      `Repository: ${input.repo}`,
      ...(input.prdTitle ? [`PRD: ${input.prdTitle}`] : []),
      `Work: ${input.text}`,
      ...(input.act ? [`What a person must do: ${input.act}`] : []),
    ].join('\n'),
  value: (answer) => (isOneOf(HUMAN_WORK_KINDS, answer) ? answer : null),
  show: (value) => value,
};

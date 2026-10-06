import { isOneOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { z } from 'zod';
import type { JevDecisionEntry } from './entry';

// `bug-risk` (PRD 812 s5): a bug's risk, as a Score over four levels, lowest first (the client reads a
// Score's reply as one of these keys). Jev answers only the level (decision 5): the bug's kind, domain
// and regression stay the agent's. Each level is worded as the bug-fixing form's default defines it
// (`omni kb show bug-fixing`, "Triage"); a repository that rewords its own form does not reword the
// question, which is Galaxy's alone. Jev reads the issue's title and body, the reproduction's path,
// the domain and the agent's own one-sentence risk (decision 10), which `/omni:bug-fix` step 3 writes
// to the state file of `omni decide bug-risk`; the agent's own level is the old answer.

export const BUG_RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type BugRisk = (typeof BUG_RISK_LEVELS)[number];

const isLevel = (value: unknown): value is BugRisk => isOneOf(BUG_RISK_LEVELS, value);

export interface BugRiskInput {
  title: string;
  body: string;
  reproduction: string | null;
  domain: string | null;
  risk: string | null;
}

const LINE = z.string().max(500).nullable().default(null);
const STATE = z.object({
  title: z.string().trim().min(1).max(300),
  body: z.string().max(16000).default(''),
  reproduction: LINE,
  domain: LINE,
  risk: z.string().max(1000).nullable().default(null),
}).strict();

const WORDING: Record<BugRisk, string> = {
  low: 'Low: cosmetic, or a minor inconvenience.',
  medium: 'Medium: a flow broken with a workaround, or a secondary flow broken.',
  high: 'High: a main flow broken with no workaround.',
  critical: 'Critical: data loss, security, money, or a whole surface down for every user.',
};

export const bugRisk: JevDecisionEntry<BugRiskInput, BugRisk> = {
  name: 'bug-risk',
  question: {
    type: 'score',
    instructions: 'How high is the risk of this bug, reported on a software product, for the people who use it?',
    levels: BUG_RISK_LEVELS.map((key) => ({ key, description: WORDING[key] })),
  },
  state: (input) =>
    [
      `Issue: ${input.title}`,
      ...(input.body.trim() ? ['', input.body.trim(), ''] : []),
      ...(input.reproduction ? [`Reproduction: ${input.reproduction}`] : []),
      ...(input.domain ? [`Domain: ${input.domain}`] : []),
      ...(input.risk ? [`Agent's risk: ${input.risk}`] : []),
    ].join('\n'),
  value: (answer) => (isLevel(answer) ? answer : null),
  show: (value) => value,
  terminal: {
    input: (state) => {
      const read = STATE.safeParse(state);
      return read.success ? read.data : null;
    },
    old: (text) => (isLevel(text) ? text : null),
  },
};

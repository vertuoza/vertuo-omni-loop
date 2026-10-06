// A stored GitHub summary, parsed where it comes in (PRD 902, s2): dossier_github's `summary` column is
// the reader's GithubSummary as it was written, and is read back through this schema, never cast. A
// part GitHub could not read is the string 'unread'; a part a summary made before it left out stays out.
import { z } from 'zod';
import { UNREAD, type GithubSummary } from '../github/summary';
import { IssueNumberSchema, PrdNumberSchema, PrNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

/** A part as stored: its value, or UNREAD. */
const read = <T extends z.ZodType>(part: T) => z.union([z.literal(UNREAD), part]);

const Issue = z.object({ number: IssueNumberSchema, url: z.string(), state: z.enum(['open', 'closed']) });

const Pull = z.object({
  number: PrNumberSchema, url: z.string(), state: z.enum(['open', 'merged']), draft: z.boolean(),
  mergedAt: z.string().nullable().exactOptional(),
});

const Item = z.object({
  id: z.string(),
  rank: z.enum(['human-action', 'high', 'medium']),
  question: z.string(),
  decision: z.string().nullable(),
  options: z.array(z.object({ letter: z.string(), text: z.string() })),
  personSteps: z.string().nullable(),
  bearsOn: z.string().exactOptional(),
  intro: z.string().nullable().exactOptional(),
  punchline: z.string().nullable().exactOptional(),
  details: z.object({
    decide: z.string().exactOptional(), meanwhile: z.string().exactOptional(), cost: z.string().exactOptional(), unknown: z.string().exactOptional(),
  }).exactOptional(),
});

const Settled = z.object({
  id: z.string(), title: z.string(), verdict: z.string(), answer: z.string(),
  by: z.string().nullable().exactOptional(), at: z.string().nullable().exactOptional(), url: z.string().nullable().exactOptional(),
});

const Outbox = z.object({ open: z.array(Item), settled: z.array(Settled), adopted: z.array(Item).exactOptional() });

const Replies = z.object({
  numbering: z.array(z.object({ number: z.number(), id: z.string() })),
  pending: z.array(z.object({
    number: z.number(), id: z.string(), text: z.string(), by: z.string(), at: z.string().nullable(), url: z.string().nullable(),
    counted: z.boolean(), door: z.enum(['page', 'terminal', 'github']),
  })),
});

const Care = z.object({
  ci: z.enum(['green', 'red', 'running', 'none']),
  failedUrl: z.string().nullable(),
  conflict: z.boolean().nullable(),
  base: z.string(),
  threads: z.array(z.object({
    url: z.string(), login: z.string(), avatar: z.string().nullable(), firstLine: z.string(),
    verdict: z.enum(['open', 'fixed', 'pushed-back', 'asked']), reason: z.string().nullable(), resolved: z.boolean(),
  })),
  watchingSince: z.string().nullable(),
  lastRound: z.string().nullable(),
});

/** A GithubSummary, as dossier_github stores it. */
export const StoredSummary: z.ZodType<GithubSummary> = z.object({
  repo: z.string(),
  prd: PrdNumberSchema,
  folder: z.string().nullable(),
  topic: z.string().nullable(),
  issue: read(Issue.nullable()),
  phase0: read(Pull.nullable()),
  feature: read(Pull.nullable()),
  retro: read(Pull.nullable()),
  mergedSlices: read(z.number()),
  outbox: read(Outbox.nullable()).optional(),
  outboxComment: read(z.string().nullable()).exactOptional(),
  replies: read(Replies.nullable()).optional(),
  retroText: read(z.string().nullable()).optional(),
  care: read(Care.nullable()).optional(),
});

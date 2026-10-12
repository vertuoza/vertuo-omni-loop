// What the ask pages' read routes answer (PRD 1318, s2; ADR-0095), as zod schemas both sides share:
// the controller (src/ask/ask.controller.ts) answers these shapes, and the browser's client
// (src/ask/ask.client.ts) parses every response with them. Browser-safe: zod and the kit's ids only.
//
//   GET /api/ask/tabs           → { tabs: TabRow[] }    the person's open terminals (PRD 142)
//   GET /api/ask/sessions/:id   → SessionState          a session, its rounds and its heartbeat
//   GET /api/ask/rounds/:id     → QuestionState         a round, its session, its earlier rounds, its shares
//   GET /api/ask/dossiers/:id/rounds → DossierRounds    a dossier's rounds, for the way back (PRD 384)
//
// The page's writes (PRD 1318, s3) go through the routes the terminal calls (src/ask/api.ts), which
// answer a sort with CategorySet; their other answers are read by status alone.
//
// A refusal is `{ error: <kind> }` (with the `field` of an `invalid` one): 401 `signed-out`, 404
// `not-found` (missing, or of another workspace), 422 `invalid`, 500 `database`.
import { z } from 'zod';
import { PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { CATEGORIES } from './classify';

const ASK_ERRORS = ['signed-out', 'not-a-member', 'not-found', 'too-large', 'invalid', 'database'] as const;
export type AskErrorKind = (typeof ASK_ERRORS)[number];

/** Every refusal of the ask routes. */
export const AskErrorSchema = z.object({ error: z.enum(ASK_ERRORS), field: z.string().optional() });
export type AskError = z.infer<typeof AskErrorSchema>;

/** Each refusal's status. */
export const ASK_ERROR_STATUS: Readonly<Record<AskErrorKind, number>> = {
  'signed-out': 401, 'not-a-member': 403, 'not-found': 404, 'too-large': 413, invalid: 422, database: 500,
};

/** A fact a round records about itself that an older or odd row may lack: read as unknown (null). */
const fact = <T extends z.ZodType>(schema: T) => schema.nullable().catch(null);

const SessionRowSchema = z.object({
  id: z.string(),
  owner: z.string(),
  title: z.string(),
  status: z.enum(['open', 'closed']),
  created_at: z.string(),
  last_seen_at: z.string(),
  workspace_id: z.string().nullable(),
  repo: z.string().nullable(),
  branch: z.string().nullable(),
  claude_session_id: z.string().nullable(),
});

const RoundRowSchema = z.object({
  id: z.string(),
  questions: z.array(z.unknown()),
  answers: z.record(z.string(), z.string()).nullable(),
  answered_via: z.enum(['page', 'terminal']).nullable(),
  status: z.enum(['open', 'answered', 'abandoned']),
  created_at: z.string(),
  answered_at: z.string().nullable(),
  attachments: fact(z.record(z.string(), z.array(z.string()))),
  prd: fact(PrdNumberSchema),
  skill: fact(z.string()),
  model: fact(z.string()),
  tokens: fact(z.object({ input: z.number(), output: z.number(), cacheRead: z.number(), cacheWrite: z.number() })),
  cost_usd: fact(z.number()),
  answered_by: fact(z.string()),
  category: fact(z.enum(CATEGORIES)),
  category_by: fact(z.string()),
  lead: fact(z.string()),
});

const PingSchema = z.object({ seen_at: z.string(), ended_at: z.string().nullable() });

export const SessionStateSchema = z.object({
  session: SessionRowSchema,
  rounds: z.array(RoundRowSchema),
  ping: PingSchema.nullable().optional(),
});

const TabRowSchema = z.object({
  session: SessionRowSchema,
  newest: z.object({ id: z.string(), status: z.enum(['open', 'answered', 'abandoned']), created_at: z.string(), header: z.string().nullable() }).nullable(),
});

export const TabsSchema = z.object({ tabs: z.array(TabRowSchema) });

export const QuestionStateSchema = z.object({
  session: SessionRowSchema,
  round: RoundRowSchema,
  earlier: z.array(RoundRowSchema),
  sharedWith: z.array(z.string()),
});

/** A dossier's rounds, as the question page's way back reads them (PRD 384): which is still open, in
 * the order asked. */
export const DossierRoundsSchema = z.object({
  rounds: z.array(z.object({ round_id: z.string(), status: z.enum(['open', 'answered', 'abandoned']), created_at: z.string() })),
});

/** A round's category once a member set it (PATCH /api/ask/rounds/:id/category). */
export const CategorySetSchema = z.object({ id: z.string(), category: z.enum(CATEGORIES).nullable(), category_by: z.string().nullable() });

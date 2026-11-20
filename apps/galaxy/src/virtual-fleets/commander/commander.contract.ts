import { z } from 'zod';

// The Commander tab's contract (PRD 3107 s1; ADR-0095): what a Virtual Fleet's Commander thread is as the tab reads it,
// and what its box sends, safe for the browser. Every refusal is `{error}` in plain words, with the thread's state when
// the Commander cannot answer (off, tokens used up).
//
//   GET  /api/virtual-fleets/commander?workspace=<id>&fleet=<key>   200 {view}
//   POST /api/virtual-fleets/commander {workspace, fleet, text}      201 {question, reply}

/** Where a claim comes from: the link the app built (inside the app or on GitHub), its chip's words and the record's own line. */
const SourceSchema = z.object({
  label: z.string().min(1).max(60),
  href: z.string().regex(/^(\/[^/]|https:\/\/github\.com\/)/).max(500),
  line: z.string().min(1).max(400),
});
export type Source = z.infer<typeof SourceSchema>;

/** One sentence the app kept: every reference it cited was in the turn's record. */
const ClaimSchema = z.object({ text: z.string().min(1).max(300), sources: z.array(SourceSchema).min(1).max(5) });
export type Claim = z.infer<typeof ClaimSchema>;

/** A reply as kept: the verdict (null when nothing was kept), its claims, the events read and the sentences removed. */
export const ReplySchema = z.object({
  verdict: z.string().min(1).max(300).nullable(),
  claims: z.array(ClaimSchema).max(12),
  read: z.number().int().min(0),
  removed: z.number().int().min(0),
});
export type Reply = z.infer<typeof ReplySchema>;

/** A message of the thread: a member's question, signed by their login, or the Commander's reply to one. */
const MessageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('question'), id: z.uuid(), at: z.string(), login: z.string().min(1), text: z.string().min(1) }),
  z.object({ kind: z.literal('reply'), id: z.uuid(), at: z.string(), replyTo: z.uuid(), reply: ReplySchema }),
]);
export type Message = z.infer<typeof MessageSchema>;

/** Whether the Commander answers now: ready, off (no model key on the server) or out of the fleet's daily tokens until a time. */
const StateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ready') }),
  z.object({ kind: z.literal('off') }),
  z.object({ kind: z.literal('used-up'), backAt: z.string() }),
]);
export type CommanderState = z.infer<typeof StateSchema>;

/** The status line, read from the database: the fleet's missions by status, and today's tokens against its daily cap. */
const StatusSchema = z.object({
  running: z.number().int().min(0),
  waiting: z.number().int().min(0),
  paused: z.number().int().min(0),
  spent: z.number().int().min(0),
  cap: z.number().int().positive().nullable(),
});
export type Status = z.infer<typeof StatusSchema>;

/** The tab as it opens: its state, the status line, the thread, the first visit's questions and what a question reads. */
const CommanderViewSchema = z.object({
  workspace: z.uuid(),
  fleet: z.string().min(1),
  state: StateSchema,
  status: StatusSchema,
  messages: z.array(MessageSchema),
  suggestions: z.array(z.string().min(1)).max(3),
  reading: z.object({ missions: z.number().int().min(0), jobs: z.number().int().min(0) }),
});
export type CommanderView = z.infer<typeof CommanderViewSchema>;

export const ViewQuerySchema = z.object({ workspace: z.uuid(), fleet: z.string().min(1).max(60) });
export type ViewQuery = z.infer<typeof ViewQuerySchema>;

export const AskRequestSchema = z.object({ workspace: z.uuid(), fleet: z.string().min(1).max(60), text: z.string().trim().min(1).max(2000) });
export type AskRequest = z.infer<typeof AskRequestSchema>;

export const ViewAnswerSchema = z.object({ view: CommanderViewSchema });

/** A question and the Commander's reply to it. */
export const AskAnswerSchema = z.object({
  question: MessageSchema,
  reply: MessageSchema,
});
export type AskAnswer = z.infer<typeof AskAnswerSchema>;

/** A refusal: its words; the question when it was kept with no answer; the state when the Commander cannot answer. */
export const CommanderRefusalSchema = z.object({
  error: z.string(),
  question: MessageSchema.optional(),
  state: StateSchema.optional(),
});

/** Each refusal's status. */
export const COMMANDER_REFUSALS = {
  malformed: 400,
  'signed-out': 401,
  forbidden: 403,
  invalid: 422,
  'used-up': 429,
  database: 500,
  'no-answer': 502,
  off: 503,
  unavailable: 503,
} as const;
export type CommanderRefusalKind = keyof typeof COMMANDER_REFUSALS;

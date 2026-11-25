import { z } from 'zod';

// The Supervisor API's shapes (PRD omni-loop-34 s3; ADR-0095), browser-safe: what the seat on a runner and the
// Supervisor page send and get back from `/api/supervisor/*`. The tables are supabase/migrations/
// 20270129160000_supervisor.sql's; every answer leaves the controller checked against these schemas, and every
// refusal is `{error}` in plain words.

/** How long `next` holds a seat's check-in, as `next` holds a runner's (PRD 1830). */
export const SUPERVISOR_NEXT_HOLD_MS = 40_000;
/** How often a held `next` looks again. */
export const SUPERVISOR_NEXT_POLL_MS = 2_000;
/** The most of a job's lines one read answers. */
export const SUPERVISOR_LINES_PAGE = 500;

export const SUPERVISOR_REFUSALS = { malformed: 400, 'signed-out': 401, forbidden: 403, missing: 404, conflict: 409, unavailable: 503, database: 500 } as const;
export type SupervisorRefusal = keyof typeof SUPERVISOR_REFUSALS;

const FINDING_KINDS = ['stuck', 'bug', 'health'] as const;
const SEVERITIES = ['high', 'medium'] as const;
const FINDING_STATES = ['open', 'acted', 'dismissed', 'resolved'] as const;
/** Only the actions the App already has: never a merge, an approval, a skipped check or a retry until green. */
const SUGGESTION_ACTIONS = ['stop-resume-job', 'open-terminal', 'open-bug-fix', 'pause-mission', 'resume-mission', 'wake-mission', 'open-mission', 'clean-worktrees', 'copy-kit-update'] as const;
const MEMORY_SCOPES = ['short', 'long'] as const;

const Id = z.uuid();
const OneLine = (max: number) => z.string().trim().min(1).max(max).refine((text) => !/[\r\n]/.test(text), 'one line');

// ── Requests ──────────────────────────────────────────────────────────────────

export const SeatQuerySchema = z.object({ runner: Id });
export const NextQuerySchema = z.object({ runner: Id, since: z.iso.datetime({ offset: true }).optional() });
export const LinesQuerySchema = z.object({ runner: Id, job: Id, after: z.coerce.number().int().min(0).default(0) });
export const WorkspaceQuerySchema = z.object({ workspace: Id });
export const FindingsQuerySchema = z.object({ state: z.enum(['open', 'done']).default('open') });
export const MemoryQuerySchema = z.object({ scope: z.enum(MEMORY_SCOPES).optional() });
export const MessagesQuerySchema = z.object({ finding: Id.optional(), after: z.iso.datetime({ offset: true }).optional() });
export const ClearQuerySchema = z.union([z.object({ note: Id }), z.object({ scope: z.enum(['short', 'long', 'all']) })]);

const SuggestionSchema = z.strictObject({
  action: z.enum(SUGGESTION_ACTIONS),
  label: OneLine(120),
  target: z.record(z.string(), z.unknown()),
});

/** The seat raises a finding: from signals (the check that fired is the first signal's, shown first) or alone. */
export const RaiseRequestSchema = z.strictObject({
  kind: z.enum(FINDING_KINDS),
  severity: z.enum(SEVERITIES),
  title: OneLine(200),
  signals: z.array(Id).max(10).default([]),
  /** A finding raised with no signal: its own fingerprint, so it is raised once. */
  fingerprint: z.string().min(3).max(200).optional(),
  evidence: z.array(z.unknown()).max(50).default([]),
  explanation: z.string().trim().min(1).max(4000),
  suggestions: z.array(SuggestionSchema).max(2).default([]),
});
export type RaiseRequest = z.infer<typeof RaiseRequestSchema>;

export const NoteRequestSchema = z.strictObject({
  scope: z.enum(MEMORY_SCOPES),
  line: OneLine(300),
  cites: z.array(Id).min(1).max(10),
});
export type NoteRequest = z.infer<typeof NoteRequestSchema>;

/** The seat answers in a thread, signed Supervisor · agent on the page. */
export const AnswerRequestSchema = z.strictObject({
  finding: Id.nullable().default(null),
  body: z.string().trim().min(1).max(4000),
  replyTo: Id.optional(),
  remembered: OneLine(300).optional(),
  tokens: z.number().int().min(0).default(0),
});
export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;

/** An owner writes in a thread. */
export const SayRequestSchema = z.strictObject({ workspace: Id, finding: Id.nullable().default(null), text: z.string().trim().min(1).max(4000) });
export const PlaceRequestSchema = z.strictObject({ workspace: Id, runner: Id });
export const SeatSetRequestSchema = z.strictObject({
  workspace: Id,
  paused: z.boolean().optional(),
  dailyTokens: z.number().int().min(1).max(1_000_000_000).optional(),
});
/** The seat checks in with the tokens it used since its last check-in. */
export const CheckInRequestSchema = z.strictObject({ tokens: z.number().int().min(0).max(100_000_000).default(0) });

// ── Answers ───────────────────────────────────────────────────────────────────

export const SeatSchema = z.object({
  workspace: z.string(),
  runner: z.string(),
  placedBy: z.string(),
  paused: z.boolean(),
  dailyTokens: z.number(),
  /** The tokens of today (UTC); 0 when the seat used none today. */
  tokensToday: z.number(),
  /** False past the daily limit: the seat checks in without thinking until midnight. */
  thinking: z.boolean(),
  lastLookAt: z.string().nullable(),
  missedLooks: z.number(),
});
export type Seat = z.infer<typeof SeatSchema>;
export const SeatReplySchema = z.object({ seat: SeatSchema.nullable() });

export const NextReplySchema = z.object({
  at: z.string(),
  wake: z.object({ signals: z.number(), messages: z.number(), presses: z.number() }),
  seat: SeatSchema,
});
export type NextReply = z.infer<typeof NextReplySchema>;

const SignalSchema = z.object({
  id: z.string(),
  fingerprint: z.string(),
  check: z.string(),
  kind: z.enum(FINDING_KINDS),
  checkLine: z.string(),
  figures: z.record(z.string(), z.unknown()),
  evidence: z.array(z.unknown()),
  finding: z.string().nullable(),
  openedAt: z.string(),
  seenAt: z.string(),
});
export type Signal = z.infer<typeof SignalSchema>;

const ProposalSchema = z.object({
  id: z.string(),
  kind: z.enum(['suggestion', 'press', 'result', 'dismiss']),
  action: z.enum(SUGGESTION_ACTIONS).nullable(),
  label: z.string().nullable(),
  target: z.record(z.string(), z.unknown()).nullable(),
  replyTo: z.string().nullable(),
  by: z.string().nullable(),
  outcome: z.enum(['done', 'refused', 'failed']).nullable(),
  note: z.string().nullable(),
  at: z.string(),
});
export type Proposal = z.infer<typeof ProposalSchema>;

const FindingSchema = z.object({
  id: z.string(),
  fingerprint: z.string().nullable(),
  kind: z.enum(FINDING_KINDS),
  severity: z.enum(SEVERITIES),
  title: z.string(),
  /** The check that fired with its figures, shown first; null when the Supervisor raised it with no check behind it. */
  checkLine: z.string().nullable(),
  figures: z.record(z.string(), z.unknown()),
  evidence: z.array(z.unknown()),
  explanation: z.string().nullable(),
  raisedBy: z.enum(['check', 'supervisor']),
  /** Null: no Supervisor look yet. */
  lookedAt: z.string().nullable(),
  state: z.enum(FINDING_STATES),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
  proposals: z.array(ProposalSchema),
});
export type Finding = z.infer<typeof FindingSchema>;
export const FindingsReplySchema = z.object({ findings: z.array(FindingSchema) });
export const RaiseReplySchema = z.object({ finding: FindingSchema, raised: z.boolean(), notified: z.boolean() });
export type RaiseReply = z.infer<typeof RaiseReplySchema>;

const NoteSchema = z.object({ id: z.string(), scope: z.enum(MEMORY_SCOPES), line: z.string(), cites: z.array(z.string()), createdAt: z.string(), expiresAt: z.string().nullable() });
export type Note = z.infer<typeof NoteSchema>;
export const MemoryReplySchema = z.object({ notes: z.array(NoteSchema) });
export const NoteReplySchema = z.object({ note: NoteSchema });
export const ClearReplySchema = z.object({ cleared: z.number() });

const MessageSchema = z.object({
  id: z.string(),
  finding: z.string().nullable(),
  kind: z.enum(['owner', 'supervisor', 'result']),
  /** The owner's login; null for the Supervisor's answers and the results of presses. */
  by: z.string().nullable(),
  body: z.string(),
  replyTo: z.string().nullable(),
  remembered: z.string().nullable(),
  at: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;
export const MessagesReplySchema = z.object({ messages: z.array(MessageSchema) });
export const MessageReplySchema = z.object({ message: MessageSchema });

export const LinesReplySchema = z.object({ lines: z.array(z.object({ seq: z.number(), text: z.string(), at: z.string() })) });

export const SnapshotSchema = z.object({
  at: z.string(),
  seat: SeatSchema,
  signals: z.array(SignalSchema),
  findings: z.array(FindingSchema),
  runners: z.array(z.object({ id: z.string(), name: z.string(), slots: z.number(), version: z.string(), lastSeenAt: z.string(), health: z.unknown() })),
  jobs: z.array(z.object({
    id: z.string(), line: z.string(), repo: z.string(), status: z.string(), runner: z.string().nullable(), attempt: z.number(),
    queuedAt: z.string(), runningAt: z.string().nullable(), endedAt: z.string().nullable(), reason: z.string().nullable(), mission: z.string().nullable(),
  })),
  missions: z.array(z.object({ id: z.string(), title: z.string(), status: z.string(), updatedAt: z.string(), nextWakeAt: z.string().nullable(), waitingOn: z.string().nullable() })),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

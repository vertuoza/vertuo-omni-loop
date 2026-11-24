import { z } from 'zod';
import { PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';

// The Commander tab's contract (PRD 3107 s1; ADR-0095): what an AI Fleet's Commander thread is as the tab reads it,
// and what its box sends, safe for the browser. Every refusal is `{error}` in plain words, with the thread's state when
// the Commander cannot answer (off, tokens used up).
//
//   GET  /api/virtual-fleets/commander?workspace=<id>&fleet=<key>   200 {view}
//   POST /api/virtual-fleets/commander {workspace, fleet, text}      201 {question, reply}
//   POST /api/virtual-fleets/commander/answer {workspace, fleet, source, id, choice}   200 {card} (s2)
//   POST /api/virtual-fleets/commander/message {workspace, fleet, text}   201 {message} (s3)
//   POST /api/virtual-fleets/commander/notes {workspace, fleet, note}   200 {note} (s4)

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

/** A runner job that read a message to the fleet (PRD 3107 s3): its role, its id and when its claim carried it. */
const ReadSchema = z.object({ role: z.string().min(1).max(30), job: z.uuid(), at: z.string() });

/** A message of the thread: a member's question, signed by their login, the Commander's reply to one, or a member's message
 * to the fleet's agents, tagged `To the fleet`, with the jobs that read it (none while it waits for the next job). */
const MessageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('question'), id: z.uuid(), at: z.string(), login: z.string().min(1), text: z.string().min(1) }),
  z.object({ kind: z.literal('reply'), id: z.uuid(), at: z.string(), replyTo: z.uuid(), reply: ReplySchema }),
  z.object({ kind: z.literal('fleet'), id: z.uuid(), at: z.string(), login: z.string().min(1), text: z.string().min(1), reads: z.array(ReadSchema).max(60) }),
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

/** Where a card's question comes from: a runner job's questions, a mission item, a PRD's outbox, an approval request. */
const CardSourceSchema = z.enum(['job', 'item', 'outbox', 'approval']);
export type CardSource = z.infer<typeof CardSourceSchema>;

/** Who answered a card, when and with which choice: read from the question's own record. */
const AnsweredSchema = z.object({ login: z.string().min(1).max(100), at: z.string(), choice: z.string().min(1).max(200) });

/** One card of the Waiting on you rail (PRD 3107 s2): built from its question's own record, never from the model. Its
 * choices are empty when it is answered on its own page (`href`) alone; `answered` is null while it waits. */
const CardSchema = z.object({
  source: CardSourceSchema,
  id: z.string().min(1).max(300),
  /** A job's short id, a mission's number: what the source line names besides its PRD. */
  ref: z.string().max(60).nullable(),
  prd: PrdNumberSchema.nullable(),
  question: z.string().min(1).max(1000),
  choices: z.array(z.string().min(1).max(200)).max(6),
  href: z.string().regex(/^\/[^/]/).max(500),
  at: z.string(),
  answered: AnsweredSchema.nullable(),
});
export type Card = z.infer<typeof CardSchema>;

/** A line of a notebook (PRD 3107 s4): its day, its words, how many events it cites and where to read them. */
const NoteSchema = z.object({
  id: z.uuid(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  line: z.string().min(1).max(300),
  events: z.number().int().min(1).max(10),
  href: z.string().regex(/^\/[^/]/).max(500),
});
export type Note = z.infer<typeof NoteSchema>;

/** One mission's notebook: the mission, and its lines, newest first. */
const MissionNotebookSchema = z.object({
  mission: z.uuid(),
  number: z.number().int().positive(),
  title: z.string(),
  status: z.string(),
  lines: z.array(NoteSchema).min(1).max(50),
});
export type MissionNotebook = z.infer<typeof MissionNotebookSchema>;

/** The Notebooks drawer: the fleet notebook's lines, then each mission's notebook, and how many lines in all. */
const NotebooksSchema = z.object({
  fleet: z.array(NoteSchema).max(50),
  missions: z.array(MissionNotebookSchema).max(50),
  count: z.number().int().min(0),
});
export type Notebooks = z.infer<typeof NotebooksSchema>;

/** The tab as it opens: its state, the status line, the thread, the first visit's questions, what a question reads, the
 * rail's cards, the notebooks and the signed-in member's login (null when their sign-in carries none). */
const CommanderViewSchema = z.object({
  workspace: z.uuid(),
  fleet: z.string().min(1),
  state: StateSchema,
  status: StatusSchema,
  messages: z.array(MessageSchema),
  suggestions: z.array(z.string().min(1)).max(3),
  reading: z.object({ missions: z.number().int().min(0), jobs: z.number().int().min(0) }),
  cards: z.array(CardSchema).max(50),
  notebooks: NotebooksSchema,
  me: z.string().min(1).nullable(),
});
export type CommanderView = z.infer<typeof CommanderViewSchema>;

export const ViewQuerySchema = z.object({ workspace: z.uuid(), fleet: z.string().min(1).max(60) });
export type ViewQuery = z.infer<typeof ViewQuerySchema>;

export const AskRequestSchema = z.object({ workspace: z.uuid(), fleet: z.string().min(1).max(60), text: z.string().trim().min(1).max(2000) });
export type AskRequest = z.infer<typeof AskRequestSchema>;

export const SendRequestSchema = AskRequestSchema;
export type SendRequest = AskRequest;

export const ViewAnswerSchema = z.object({ view: CommanderViewSchema });

/** A question and the Commander's reply to it. */
export const AskAnswerSchema = z.object({
  question: MessageSchema,
  reply: MessageSchema,
});
export type AskAnswer = z.infer<typeof AskAnswerSchema>;

/** A message to the fleet, as stored. */
export const SendAnswerSchema = z.object({ message: MessageSchema });

/** A refusal: its words; the question when it was kept with no answer; the state when the Commander cannot answer. */
export const CommanderRefusalSchema = z.object({
  error: z.string(),
  question: MessageSchema.optional(),
  state: StateSchema.optional(),
});

/** A member's answer from a card: the card (its source and id) and the choice, one of the card's own. */
export const CardAnswerRequestSchema = z.object({
  workspace: z.uuid(),
  fleet: z.string().min(1).max(60),
  source: CardSourceSchema,
  id: z.string().min(1).max(300),
  choice: z.string().min(1).max(200),
});
export type CardAnswerRequest = z.infer<typeof CardAnswerRequestSchema>;

/** The card once answered, by this member. */
export const CardAnswerSchema = z.object({ card: CardSchema });

/** A card's refusal: its words, and the card as it stands when it was answered elsewhere or the route refused. */
export const CardRefusalSchema = z.object({ error: z.string(), card: CardSchema.optional() });

/** A member deletes a line of their fleet's notebooks (s4). */
export const NoteDeleteRequestSchema = z.object({ workspace: z.uuid(), fleet: z.string().min(1).max(60), note: z.uuid() });
export type NoteDeleteRequest = z.infer<typeof NoteDeleteRequestSchema>;

/** The line once deleted: who deleted it and when. */
const DeletedSchema = z.object({ id: z.uuid(), at: z.string(), login: z.string().min(1) });
export type Deleted = z.infer<typeof DeletedSchema>;
export const NoteDeletedSchema = z.object({ note: DeletedSchema });

/** Each refusal's status. */
export const COMMANDER_REFUSALS = {
  malformed: 400,
  'signed-out': 401,
  forbidden: 403,
  missing: 404,
  answered: 409,
  invalid: 422,
  'used-up': 429,
  database: 500,
  'no-answer': 502,
  'not-sent': 502,
  off: 503,
  unavailable: 503,
} as const;
export type CommanderRefusalKind = keyof typeof COMMANDER_REFUSALS;

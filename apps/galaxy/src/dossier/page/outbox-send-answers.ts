import { z } from 'zod';
import { orNull, parseRow } from '../../data/parse-rows';
import type { SentView } from '../../outbox/sent';

// What /api/outbox/send answers the Outbox tab's Send (src/outbox/send.ts, PRD 251 s11), parsed where
// the tab reads it (PRD 1030) instead of cast to the shape the route is meant to answer. A body that
// does not parse is the tab's failed read, as an unreadable body always was: no outcome on the way
// back from GitHub, no send on the way out.

const SentAnswer: z.ZodType<SentView> = z.discriminatedUnion('state', [
  z.object({ state: z.literal('posted'), login: z.string(), url: z.string(), counted: z.boolean(), next: z.string(), reply: z.string(), at: z.string() }),
  z.object({ state: z.literal('failed'), error: z.string() }),
  z.object({ state: z.literal('waiting') }),
]);

/** What the route answers when it refuses: why, and the questions it dropped. */
const Refusal = z.object({ error: z.string(), dropped: z.array(z.number().int()).optional() });

/** GET /api/outbox/send?id=: the send's outcome, or why it was refused. */
export const ReadAnswer = z.union([SentAnswer, Refusal]);
export type ReadAnswer = z.infer<typeof ReadAnswer>;

/** POST /api/outbox/send: the send and GitHub's authorisation, or why it was refused, with the questions dropped. */
export const StartAnswer = z.object({
  send: z.string().optional(),
  authorize: z.string().optional(),
  dropped: z.array(z.number().int()).optional(),
  error: z.string().optional(),
});
export type StartAnswer = z.infer<typeof StartAnswer>;

/** The body of a GET's answer (null when it had none), parsed: null when it does not parse. */
export function readAnswerOf(body: unknown): ReadAnswer | null {
  return body === null ? null : orNull(parseRow(ReadAnswer, body, 'dossier/OutboxSend: GET /api/outbox/send'));
}

/** The body of a POST's answer (null when it had none), parsed: nothing said when it does not parse. */
export function startAnswerOf(body: unknown): StartAnswer {
  return (body === null ? null : orNull(parseRow(StartAnswer, body, 'dossier/OutboxSend: POST /api/outbox/send'))) ?? {};
}

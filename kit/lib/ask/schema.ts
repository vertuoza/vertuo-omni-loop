// The shapes ask mode reads from outside the process (PRD 725, s12): its local state files, the
// sign-in kept in the person's home, a hook's input, a transcript's lines and the server's replies.
// Every read here is lenient by design, as it always was: a file or a reply that is not the shape
// reads as absent (`null`), never as an error, because the hooks never block a question. So each
// schema is used through `safeParse`, and a value that fails it is dropped, not reported.
import { z } from 'zod';

/** A string with at least one character. */
const text = z.string().min(1);

/** Any JSON object: not null, not a list. Its fields are still unknown. */
export const JsonObjectSchema = z.record(z.string(), z.unknown());
export type JsonObject = z.infer<typeof JsonObjectSchema>;

/** `value` when it is a JSON object, else `null`. */
export function jsonObject(value: unknown): JsonObject | null {
  const parsed = JsonObjectSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * `value[key]` for any object `value` (a list too, as a property read always allowed), else
 * `undefined`. For the transcripts and hook inputs read here field by field: a line of a transcript
 * is any JSON at all, and each field it lacks or holds in another shape counts as absent.
 */
export function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && key in value ? Reflect.get(value, key) : undefined;
}

/** `value` when it is a non-empty string, else `null`. */
export function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** `ask.json`: the host the mode is on against; PRD 71's shape also names its session. */
export const ModeFileSchema = z.object({
  host: text,
  sessionId: text.nullable().catch(null),
});

/** `ask/<terminal id>.json`: one terminal's session. */
export const TerminalFileSchema = z.object({ sessionId: text, host: text });

/** The states a question's round goes through. */
export const ROUND_STATUSES = ['open', 'answered', 'abandoned'] as const;
export type RoundStatus = (typeof ROUND_STATUSES)[number];

/** `ask/rounds/<tool use id>.json`: one question's round; a status it does not know reads as open. */
export const RoundFileSchema = z.object({
  roundId: text,
  status: z.enum(ROUND_STATUSES).catch('open'),
});

/** `heartbeat/<Claude session id>.json`: when the session's last call went out. */
export const HeartbeatWindowSchema = z.object({ sentAt: z.number() });

/** One host's sign-in, as the token store keeps it: an access token, and whatever else the reply
 * had (`refresh_token`, `expires_at`, `email`, `login`), kept as it was written. */
export const TokensSchema = z.looseObject({ access_token: text });
export type Tokens = z.infer<typeof TokensSchema>;

/** The token exchange's reply, as a sign-in keeps it: both tokens are required. */
export const TokenReplySchema = z.object({ access_token: text, refresh_token: text });

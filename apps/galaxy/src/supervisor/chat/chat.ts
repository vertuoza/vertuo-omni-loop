import { MessageReplySchema, type Message } from '../api/supervisor.contract';
import type { HeaderState } from '../page/model';
import { UNREACHABLE, call, type Called } from '../../runners/runners.client';

// The chat box's words and its call (PRD omni-loop-34 s6): an owner writes in the general thread or a finding's
// through POST /api/supervisor/messages, which stores the message as that owner (the database checks is_owner); the
// seat wakes on it and answers, signed Supervisor · agent. While the seat cannot answer (offline, paused, past its
// token limit, or not placed), the box says so and the message waits. Never `@supabase/*`: the page's session
// cookies go with the call.

/** The two questions the box offers under the thread (2.B). */
export const QUICK_ASKS = ['What is running now?', 'Summarize today'] as const;
/** The longest message the route takes. */
const MAX_TEXT = 4000;

const WAITS: Readonly<Record<HeaderState, string | null>> = {
  watching: null,
  offline: 'The Supervisor is offline. Your message waits until it looks again.',
  paused: 'The Supervisor is paused. Your message waits until an owner resumes it.',
  limit: 'Thinking paused until midnight. Your message waits until then.',
  none: 'No Supervisor seat yet. Your message waits until an owner places it.',
};

/** What the box says while the seat cannot answer now; null while it watches. */
export const waitWords = (state: HeaderState): string | null => WAITS[state];

/** The text to send, trimmed; null when there is nothing to send or too much. */
export function sayable(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === '' || trimmed.length > MAX_TEXT ? null : trimmed;
}

/** Writes `text` in the workspace's general thread (finding null) or a finding's, as the signed-in owner. */
export function say(workspace: string, finding: string | null, text: string, fetcher: typeof fetch = fetch): Promise<Called<Message>> {
  const read = (body: unknown) => MessageReplySchema.parse(body).message;
  return call(fetcher, '/api/supervisor/messages', { method: 'POST', body: JSON.stringify({ workspace, finding, text }) }, read)
    .catch((): Called<Message> => ({ ok: false, error: UNREACHABLE }));
}

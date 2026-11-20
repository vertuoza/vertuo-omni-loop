import {
  AskAnswerSchema, CardAnswerSchema, CardRefusalSchema, CommanderRefusalSchema, NoteDeletedSchema, SendAnswerSchema, ViewAnswerSchema,
  type AskAnswer, type Card, type CardSource, type CommanderState, type CommanderView, type Message,
} from './commander.contract';
import { WORDS } from './commander';
import { RAIL_WORDS } from './rail';

// The Commander tab's calls from the browser (PRD 3107 s1; ADR-0095): GET and POST /api/virtual-fleets/commander, as
// the signed-in person, each answer checked against the contract. A refusal comes back with its words, the question when
// it was kept with no answer, and the state when the Commander is off or out of tokens. A card of the rail is answered
// through POST /api/virtual-fleets/commander/answer (s2): the card as answered, or as it stands with the refusal's words.

export type Loaded = { ok: true; view: CommanderView } | { ok: false; message: string };
export type Asked = { ok: true; answer: AskAnswer } | { ok: false; message: string; question: Message | null; state: CommanderState | null };

export type Answered = { ok: true; card: Card } | { ok: false; message: string; card: Card | null };

/** A message to the fleet (s3): as stored, or why it was not sent. */
export type Sent = { ok: true; message: Message } | { ok: false; message: string };

/** A line of a notebook deleted (s4), or why it was not. */
export type NoteGone = { ok: true } | { ok: false; message: string };

export interface CommanderPort {
  load(): Promise<Loaded>;
  ask(text: string): Promise<Asked>;
  answer(source: CardSource, id: string, choice: string): Promise<Answered>;
  send(text: string): Promise<Sent>;
  deleteNote(note: string): Promise<NoteGone>;
}

const ROUTE = '/api/virtual-fleets/commander';
const ANSWER_ROUTE = `${ROUTE}/answer`;
const MESSAGE_ROUTE = `${ROUTE}/message`;
const NOTES_ROUTE = `${ROUTE}/notes`;
const NOT_SENT = { ok: false as const, message: RAIL_WORDS.notSent, card: null };

export function httpCommanderPort(workspace: string, fleet: string, fetch: typeof globalThis.fetch = globalThis.fetch): CommanderPort {
  return {
    async load() {
      try {
        const res = await fetch(`${ROUTE}?${new URLSearchParams({ workspace, fleet }).toString()}`, { cache: 'no-store' });
        const json: unknown = await res.json().catch(() => null);
        const read = ViewAnswerSchema.safeParse(json);
        if (res.ok && read.success) return { ok: true, view: read.data.view };
        const refusal = CommanderRefusalSchema.safeParse(json);
        return { ok: false, message: refusal.success ? refusal.data.error : WORDS.couldNotLoad };
      } catch {
        return { ok: false, message: WORDS.couldNotLoad };
      }
    },
    async ask(text) {
      try {
        const res = await fetch(ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace, fleet, text }) });
        const json: unknown = await res.json().catch(() => null);
        const read = AskAnswerSchema.safeParse(json);
        if (res.ok && read.success) return { ok: true, answer: read.data };
        const refusal = CommanderRefusalSchema.safeParse(json);
        if (!refusal.success) return { ok: false, message: WORDS.noAnswer, question: null, state: null };
        return { ok: false, message: refusal.data.error, question: refusal.data.question ?? null, state: refusal.data.state ?? null };
      } catch {
        return { ok: false, message: WORDS.noAnswer, question: null, state: null };
      }
    },
    async send(text) {
      try {
        const res = await fetch(MESSAGE_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace, fleet, text }) });
        const json: unknown = await res.json().catch(() => null);
        const read = SendAnswerSchema.safeParse(json);
        if (res.ok && read.success) return { ok: true, message: read.data.message };
        const refusal = CommanderRefusalSchema.safeParse(json);
        return { ok: false, message: refusal.success ? refusal.data.error : WORDS.notSent };
      } catch {
        return { ok: false, message: WORDS.notSent };
      }
    },
    async deleteNote(note) {
      try {
        const res = await fetch(NOTES_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace, fleet, note }) });
        const json: unknown = await res.json().catch(() => null);
        if (res.ok && NoteDeletedSchema.safeParse(json).success) return { ok: true };
        const refusal = CommanderRefusalSchema.safeParse(json);
        return { ok: false, message: refusal.success ? refusal.data.error : WORDS.notDeleted };
      } catch {
        return { ok: false, message: WORDS.notDeleted };
      }
    },
    async answer(source, id, choice) {
      try {
        const res = await fetch(ANSWER_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace, fleet, source, id, choice }) });
        const json: unknown = await res.json().catch(() => null);
        const read = CardAnswerSchema.safeParse(json);
        if (res.ok && read.success) return { ok: true, card: read.data.card };
        const refusal = CardRefusalSchema.safeParse(json);
        return refusal.success ? { ok: false, message: refusal.data.error, card: refusal.data.card ?? null } : NOT_SENT;
      } catch {
        return NOT_SENT;
      }
    },
  };
}

const DEMO = { ok: false as const, message: WORDS.demo };

/** The demo's port: the demo world has no Commander. */
export const demoCommanderPort: CommanderPort = {
  load: () => Promise.resolve(DEMO),
  ask: () => Promise.resolve({ ...DEMO, question: null, state: null }),
  answer: () => Promise.resolve({ ...DEMO, card: null }),
  send: () => Promise.resolve(DEMO),
  deleteNote: () => Promise.resolve(DEMO),
};

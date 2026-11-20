import { AskAnswerSchema, CommanderRefusalSchema, ViewAnswerSchema, type AskAnswer, type CommanderState, type CommanderView, type Message } from './commander.contract';
import { WORDS } from './commander';

// The Commander tab's calls from the browser (PRD 3107 s1; ADR-0095): GET and POST /api/virtual-fleets/commander, as
// the signed-in person, each answer checked against the contract. A refusal comes back with its words, the question when
// it was kept with no answer, and the state when the Commander is off or out of tokens.

export type Loaded = { ok: true; view: CommanderView } | { ok: false; message: string };
export type Asked = { ok: true; answer: AskAnswer } | { ok: false; message: string; question: Message | null; state: CommanderState | null };

export interface CommanderPort {
  load(): Promise<Loaded>;
  ask(text: string): Promise<Asked>;
}

const ROUTE = '/api/virtual-fleets/commander';

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
  };
}

const DEMO = { ok: false as const, message: WORDS.demo };

/** The demo's port: the demo world has no Commander. */
export const demoCommanderPort: CommanderPort = {
  load: () => Promise.resolve(DEMO),
  ask: () => Promise.resolve({ ...DEMO, question: null, state: null }),
};

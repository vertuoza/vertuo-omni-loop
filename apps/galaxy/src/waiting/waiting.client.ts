import { DocumentsSchema, QuestionsSchema } from './waiting.contract';
import type { DocumentRow } from './documents';
import type { WaitingQuestion } from './waiting';

// The bell's reads from the browser (PRD 1318, s4; ADR-0095): the app's /api/waiting/questions and
// /api/waiting/documents routes, every response parsed with src/waiting/waiting.contract.ts. The
// waiting provider builds no Supabase client: its sign-in cookie goes with each request. A 401 throws
// WaitingSignedOut, which the provider reads as "stop both polls" (bug #1316); any other failure throws
// WaitingReadFailed, and the provider keeps the part's last items, marked unread.

/** The person is signed out (401 `signed-out`): nothing is asked again until a reload. */
export class WaitingSignedOut extends Error {
  constructor() {
    super('signed out');
    this.name = 'WaitingSignedOut';
  }
}

/** A route that failed, or answered a shape the contract does not know. */
export class WaitingReadFailed extends Error {
  readonly status: number;
  constructor(what: string, status: number) {
    super(`${what}: ${status}`);
    this.name = 'WaitingReadFailed';
    this.status = status;
  }
}

/** Whether a read of any part heard the person is signed out: shared by the parts of one provider. */
export type SignedOutGate = { out: boolean };

/** What a part does with each read of its poll: `seen` with what it read, `failed` when it could not
 * read (it keeps its last items, marked unread). */
export type PartPoll<T> = { read(): Promise<T>; seen(next: T): void; failed(error: unknown): void };

/** A part's poll tick over `on`, resolving whether to keep polling. Once any part sharing `gate` hears a
 * 401, every one of them stops at its next tick, asking nothing. */
export function partTick<T>(gate: SignedOutGate, on: PartPoll<T>): () => Promise<boolean> {
  return async () => {
    if (gate.out) return false;
    try {
      on.seen(await on.read());
    } catch (error) {
      if (error instanceof WaitingSignedOut) {
        gate.out = true;
        return false;
      }
      on.failed(error);
    }
    return true;
  };
}

/** The browser's fetch, or a stub in a test. */
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export function waitingClient(fetchFn: Fetch = (url, init) => fetch(url, init)) {
  async function read(what: string, url: string): Promise<unknown> {
    const response = await fetchFn(url, { headers: { accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin' });
    if (response.status === 401) throw new WaitingSignedOut();
    if (!response.ok) throw new WaitingReadFailed(what, response.status);
    return response.json();
  }

  return {
    /** The Questions part. */
    async questions(): Promise<WaitingQuestion[]> {
      return QuestionsSchema.parse(await read('read the questions', '/api/waiting/questions')).questions;
    },

    /** The New documents part's versions, newest first. */
    async documents(): Promise<DocumentRow[]> {
      return DocumentsSchema.parse(await read('read the new documents', '/api/waiting/documents')).documents;
    },
  };
}

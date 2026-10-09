import type { z } from 'zod';
import { AskErrorSchema, QuestionStateSchema, SessionStateSchema, TabsSchema } from './ask.contract';
import type { QuestionState } from './page/question';
import type { TabRow } from './page/tabs';
import type { SessionState } from './page/view';

// The ask pages' reads from the browser (PRD 1318, s2; ADR-0095): the app's /api/ask/* routes, every
// response parsed with src/ask/ask.contract.ts. The page builds no Supabase client: its sign-in cookie
// goes with each request. A 401 throws AskSignedOut, which the page reads as "stop every poll and show
// the sign-in card"; a session or round that is missing or of another workspace reads as null; any
// other failure throws, and the page keeps what it last read.

/** The person is signed out (401 `signed-out`): nothing is asked again until a reload. */
export class AskSignedOut extends Error {
  constructor() {
    super('signed out');
    this.name = 'AskSignedOut';
  }
}

/** A poll's tick that ends the polling once a read says the person is signed out: `onSignedOut` hears
 * it once, and nothing is asked again. Any other failure is the tick's own to show. */
export const untilSignedOut = (tick: () => Promise<boolean>, onSignedOut: () => void) => async (): Promise<boolean> => {
  try {
    return await tick();
  } catch (error) {
    if (!(error instanceof AskSignedOut)) throw error;
    onSignedOut();
    return false;
  }
};

/** A route that answered neither its shape nor a known refusal, or refused with a failure. */
export class AskReadFailed extends Error {
  readonly status: number;
  readonly kind: string | null;
  constructor(what: string, status: number, kind: string | null) {
    super(`${what}: ${status}${kind ? ` ${kind}` : ''}`);
    this.name = 'AskReadFailed';
    this.status = status;
    this.kind = kind;
  }
}

/** The browser's fetch, or a stub in a test. */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** The kind of refusal a failed response carries, or null when its body says none. */
async function kindOf(response: Response): Promise<string | null> {
  try {
    const parsed = AskErrorSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.error : null;
  } catch {
    return null;
  }
}

export function askClient(fetchFn: Fetch = (url, init) => fetch(url, init)) {
  /** One read: the body parsed with `schema`, null when not found, AskSignedOut on a 401. */
  async function read<S extends z.ZodType>(what: string, url: string, schema: S): Promise<z.output<S> | null> {
    const response = await fetchFn(url, { headers: { accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin' });
    if (response.status === 401) throw new AskSignedOut();
    if (response.status === 404 || response.status === 403) return null;
    if (!response.ok) throw new AskReadFailed(what, response.status, await kindOf(response));
    return schema.parse(await response.json());
  }

  return {
    /** The person's open terminals, as tabs. */
    async tabs(): Promise<TabRow[]> {
      const found = await read('read the tabs', '/api/ask/tabs', TabsSchema);
      if (!found) throw new AskReadFailed('read the tabs', 404, 'not-found');
      return found.tabs;
    },

    /** A session, its rounds and its terminal's heartbeat; null when it is gone or not readable. */
    session: (id: string): Promise<SessionState | null> =>
      read('read the session', `/api/ask/sessions/${encodeURIComponent(id)}`, SessionStateSchema),

    /** A round, its session, its earlier rounds and its shares; null when it is gone or not readable. */
    round: (id: string): Promise<QuestionState | null> =>
      read('read the round', `/api/ask/rounds/${encodeURIComponent(id)}`, QuestionStateSchema),
  };
}

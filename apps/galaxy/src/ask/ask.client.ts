import type { z } from 'zod';
import { SHOT_MAX_BYTES } from './answer-model';
import { AskErrorSchema, CategorySetSchema, DossierRoundsSchema, QuestionStateSchema, SessionStateSchema, TabsSchema } from './ask.contract';
import type { Category } from './classify';
import type { Bucket } from './page/attachments';
import type { BackRounds } from './page/back';
import type { QuestionState } from './page/question';
import type { AskAnswers, AskAttachments, AskCategory } from './rows';
import type { TabRow } from './page/tabs';
import type { SessionState } from './page/view';

// The ask pages' reads from the browser (PRD 1318, s2; ADR-0095): the app's /api/ask/* routes, every
// response parsed with src/ask/ask.contract.ts. The page builds no Supabase client: its sign-in cookie
// goes with each request. A 401 throws AskSignedOut, which the page reads as "stop every poll and show
// the sign-in card"; a session or round that is missing or of another workspace reads as null; any
// other failure throws, and the page keeps what it last read.
//
// Its writes (PRD 1318, s3) go through the routes the terminal calls, with the same cookie: answering
// (each screenshot first, one per request, refused here before any request when it is over 4 MB),
// deleting a session, sorting and sharing a round. A 401 throws AskSignedOut there too; a refusal the
// page has words for reads as `taken`, false or null, and any other failure throws.

/** What the page says of a screenshot over 4 MB, as the server would refuse it (413 `too-large`). */
export const TOO_LARGE = 'The screenshot is over 4 MB.';

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

  /** One write, with the sign-in cookie: AskSignedOut on a 401, the response otherwise. */
  async function write(url: string, method: string, body?: { json: unknown } | { file: Blob; type: string }): Promise<Response> {
    const sent: RequestInit = !body ? {} : 'json' in body
      ? { body: JSON.stringify(body.json), headers: { accept: 'application/json', 'content-type': 'application/json' } }
      : { body: body.file, headers: { accept: 'application/json', 'content-type': body.type } };
    const response = await fetchFn(url, { headers: { accept: 'application/json' }, ...sent, method, cache: 'no-store', credentials: 'same-origin' });
    if (response.status === 401) throw new AskSignedOut();
    return response;
  }

  /** A write's refusal the page has no words for. */
  const failed = async (what: string, response: Response) => new AskReadFailed(what, response.status, await kindOf(response));

  const roundPath = (id: string) => `/api/ask/rounds/${encodeURIComponent(id)}`;
  /** `<round id>/<n>.<ext>` as its route: the round's folder, then the file. */
  const shotUrl = (path: string) => {
    const at = path.indexOf('/');
    return `${roundPath(path.slice(0, at))}/attachments/${encodeURIComponent(path.slice(at + 1))}`;
  };

  return {
    /** Records an answer given on the page, with its screenshots' paths: `taken` when the round is no
     * longer open (the terminal took it, or someone answered first) or not this person's to answer. */
    async answer(roundId: string, answers: AskAnswers, attachments?: AskAttachments): Promise<'answered' | 'taken'> {
      const response = await write(`${roundPath(roundId)}/answers`, 'POST', { json: { answers, via: 'page', ...(attachments ? { attachments } : {}) } });
      if (response.ok) return 'answered';
      if (response.status === 409 || response.status === 404) return 'taken';
      throw await failed('send the answer', response);
    },

    /** Deletes a session for good: false when the person is not its owner, or it is gone. */
    async remove(sessionId: string): Promise<boolean> {
      const response = await write(`/api/ask/sessions/${encodeURIComponent(sessionId)}`, 'DELETE');
      if (response.ok) return true;
      if (response.status === 403 || response.status === 404) return false;
      throw await failed('delete the session', response);
    },

    /** Sorts a round, or clears it with null: its category and who set it, or null when the person may
     * not read it. */
    async sort(roundId: string, category: Category | null): Promise<AskCategory | null> {
      const response = await write(`${roundPath(roundId)}/category`, 'PATCH', { json: { category } });
      if (response.status === 404) return null;
      if (!response.ok) throw await failed('sort the round', response);
      const set = CategorySetSchema.parse(await response.json());
      return { category: set.category, category_by: set.category_by };
    },

    /** Shares a round with another member: false when the person does not own its session, or the
     * member is not in its workspace. */
    async share(roundId: string, member: string): Promise<boolean> {
      const response = await write(`${roundPath(roundId)}/shares`, 'POST', { json: { member } });
      if (response.ok) return true;
      if (response.status === 400 || response.status === 403 || response.status === 404) return false;
      throw await failed('share the round', response);
    },

    /** The screenshots' bucket, as the answer form's uploads reach it (src/ask/page/attachments.ts):
     * one screenshot per request, never one over 4 MB. */
    bucket(): Bucket {
      return {
        async upload(path, file, options) {
          if (file.size > SHOT_MAX_BYTES) return { error: { message: TOO_LARGE, statusCode: '413' } };
          const response = await write(shotUrl(path), 'POST', { file, type: options.contentType });
          if (response.ok) return { error: null };
          const message = response.status === 413 ? TOO_LARGE : `upload the screenshot: ${response.status}`;
          return { error: { message, statusCode: String(response.status) } };
        },
        async remove(paths) {
          const responses = await Promise.all(paths.map((path) => write(shotUrl(path), 'DELETE')));
          const refused = responses.find((r) => !r.ok);
          return { error: refused ? await failed('remove the screenshots', refused) : null };
        },
      };
    },

    /** A dossier's rounds, for the way back after an answer (PRD 384); null when they cannot be read. */
    async dossierRounds(dossierId: string): Promise<BackRounds> {
      const found = await read('read the dossier\'s rounds', `/api/ask/dossiers/${encodeURIComponent(dossierId)}/rounds`, DossierRoundsSchema);
      return found ? found.rounds : null;
    },

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

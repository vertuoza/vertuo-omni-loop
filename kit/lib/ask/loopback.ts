// The one-shot listener `omni signin` catches the sign-in on: a tiny HTTP server on 127.0.0.1, at a
// port the system picks, waiting for the browser to come back to
// `http://127.0.0.1:<port>/callback?state=<state>&code=<code>`. Only a callback carrying the state
// this terminal made is taken: any other is refused and the listener keeps waiting, so a stale tab or
// a planted link never signs anyone in. The first good callback ends it, and so does its wait.
//
// `omni setup-token` (PRD 1628) listens the same way for a kit token instead of a code:
// `http://127.0.0.1:<port>/callback?state=<state>&token=<omk_…>&expires_at=<ISO date>`, the way back
// `apps/galaxy/src/ask/kit-token.ts` sends. The token is taken only when it is well formed and its
// expiry readable; no page this listener answers, and no error it raises, ever holds it.
import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

/** The listener `startLoopback` gives: where the browser comes back to, and the code it brings. */
export type Loopback = {
  port: number;
  address: string;
  redirectUri: string;
  code: Promise<string>;
  closed: Promise<void>;
  close(): Promise<void>;
};

/** The listener `startTokenLoopback` gives: the same, with the token and its expiry it brings. */
export type TokenLoopback = Omit<Loopback, 'code'> & { token: Promise<MadeToken> };

/** A kit token as the browser brought it back: the token, and when it expires (an ISO date). */
export type MadeToken = { token: string; expiresAt: string };

/** How long a sign-in may take in the browser. */
export const LOOPBACK_WAIT_MS = 5 * 60_000;

const HOST = '127.0.0.1';
const PATH = '/callback';

export class LoopbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoopbackError';
  }
}

function page(title: string, text: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>`
    + '<body style="font:17px/1.6 system-ui,sans-serif;max-width:34rem;margin:15vh auto;padding:0 1rem">'
    + `<h1 style="font-size:1.3rem">${title}</h1><p>${text}</p></body></html>`;
}

/** What a listener catches from a good callback's query, the pages it answers, and how it names what
 * it waits for in its errors. */
type Catch<T> = {
  take: (params: URLSearchParams) => T | null;
  pages: { done: string; notOurs: string; incomplete: string };
  what: string;
};

const SIGN_IN: Catch<string> = {
  take: (params) => params.get('code') || null,
  pages: {
    done: page('Back to the terminal', 'The terminal is finishing the sign-in. You can close this tab.'),
    notOurs: page('Sign-in refused', 'This sign-in was not started by this terminal. Run <code>omni signin</code> again.'),
    incomplete: page('Sign-in incomplete', 'The sign-in came back without its code. Run <code>omni signin</code> again.'),
  },
  what: 'sign-in',
};

/** A kit token's shape, as `OMNI_TOKEN` must have it (`../env/read.ts`). */
const KIT_TOKEN = /^omk_[A-Za-z0-9_-]{43}$/;

const TOKEN: Catch<MadeToken> = {
  take: (params) => {
    const token = params.get('token') ?? '';
    const expiresAt = params.get('expires_at') ?? '';
    return KIT_TOKEN.test(token) && !Number.isNaN(Date.parse(expiresAt)) ? { token, expiresAt } : null;
  },
  pages: {
    done: page('Back to the terminal', 'The terminal has your token. You can close this tab.'),
    notOurs: page('Token refused', 'This token was not asked for by this terminal. Run <code>omni setup-token</code> again.'),
    incomplete: page('Token incomplete', 'The token came back incomplete. Run <code>omni setup-token</code> again.'),
  },
  what: 'token',
};

const sameText = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

type Options = { state: unknown; timeoutMs?: number };

/** Listens for the browser's callback carrying `state` and a code, until `timeoutMs` has passed. */
export async function startLoopback(options: Options): Promise<Loopback> {
  const { caught, ...rest } = await listen(options, SIGN_IN);
  return { ...rest, code: caught };
}

/** Listens for the browser's callback carrying `state`, a kit token and its expiry, until `timeoutMs`
 * has passed. */
export async function startTokenLoopback(options: Options): Promise<TokenLoopback> {
  const { caught, ...rest } = await listen(options, TOKEN);
  return { ...rest, token: caught };
}

async function listen<T>(
  { state, timeoutMs = LOOPBACK_WAIT_MS }: Options,
  { take, pages, what }: Catch<T>,
): Promise<Omit<Loopback, 'code'> & { caught: Promise<T> }> {
  if (typeof state !== 'string' || state.length === 0) throw new LoopbackError('the listener needs a state to compare with.');
  let settle: { resolve: (caught: T) => void; reject: (error: Error) => void } = { resolve: () => {}, reject: () => {} };
  const caught = new Promise<T>((resolve, reject) => {
    settle = { resolve, reject };
  });
  caught.catch(() => {});
  let done = false;

  const server = createServer((request, response) => {
    const answer = (status: number, body: string, type = 'text/html; charset=utf-8'): void => {
      response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', connection: 'close' });
      response.end(body);
    };
    const url = new URL(request.url ?? '/', `http://${HOST}`);
    if (request.method !== 'GET' || url.pathname !== PATH || done) {
      answer(404, 'not found\n', 'text/plain; charset=utf-8');
      return;
    }
    if (!sameText(url.searchParams.get('state') ?? '', state)) {
      answer(400, pages.notOurs);
      return;
    }
    const given = take(url.searchParams);
    if (given === null) {
      answer(400, pages.incomplete);
      return;
    }
    done = true;
    response.on('finish', () => {
      finish(() => {
        settle.resolve(given);
      });
    });
    answer(200, pages.done);
  });

  let closedResolve: () => void = () => {};
  const closed = new Promise<void>((resolve) => {
    closedResolve = resolve;
  });
  let timer: NodeJS.Timeout | undefined = undefined;
  function finish(outcome: () => void): void {
    done = true;
    clearTimeout(timer);
    outcome();
    server.close(() => {
      closedResolve();
    });
    server.closeAllConnections();
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, () => {
      server.off('error', reject);
      resolve();
    });
  });
  // Listening on a host and port, the server's address is always an `AddressInfo`.
  const listening = server.address();
  if (listening === null || typeof listening === 'string') {
    server.close();
    throw new LoopbackError('the sign-in listener has no TCP address.');
  }
  const { port, address } = listening;
  const minutes = Math.round(timeoutMs / 60_000);
  timer = setTimeout(
    () => {
      finish(() => {
        settle.reject(new LoopbackError(`no ${what} came back within ${minutes >= 1 ? `${minutes} min` : `${timeoutMs} ms`}.`));
      });
    },
    timeoutMs,
  );

  return {
    port,
    address,
    redirectUri: `http://${HOST}:${port}${PATH}`,
    caught,
    closed,
    async close() {
      if (server.listening) {
        finish(() => {
          settle.reject(new LoopbackError(`the listener was stopped before a ${what} came back.`));
        });
      }
      await closed;
    },
  };
}

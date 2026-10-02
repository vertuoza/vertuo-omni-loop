// The one-shot listener `omni signin` catches the sign-in on: a tiny HTTP server on 127.0.0.1, at a
// port the system picks, waiting for the browser to come back to
// `http://127.0.0.1:<port>/callback?state=<state>&code=<code>`. Only a callback carrying the state
// this terminal made is taken: any other is refused and the listener keeps waiting, so a stale tab or
// a planted link never signs anyone in. The first good callback ends it, and so does its wait.
import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/** The listener `startLoopback` gives: where the browser comes back to, and the code it brings. */
export type Loopback = {
  port: number;
  address: string;
  redirectUri: string;
  code: Promise<string>;
  closed: Promise<void>;
  close(): Promise<void>;
};

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

const SIGNED_IN = page('Back to the terminal', 'The terminal is finishing the sign-in. You can close this tab.');
const NOT_OURS = page('Sign-in refused', 'This sign-in was not started by this terminal. Run <code>omni signin</code> again.');
const NO_CODE = page('Sign-in incomplete', 'The sign-in came back without its code. Run <code>omni signin</code> again.');

const sameText = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** Listens for the browser's callback carrying `state`, until `timeoutMs` has passed. */
export async function startLoopback({ state, timeoutMs = LOOPBACK_WAIT_MS }: { state: unknown; timeoutMs?: number }): Promise<Loopback> {
  if (typeof state !== 'string' || state.length === 0) throw new LoopbackError('the listener needs a state to compare with.');
  let settle: { resolve: (code: string) => void; reject: (error: Error) => void } = { resolve: () => {}, reject: () => {} };
  const code = new Promise<string>((resolve, reject) => {
    settle = { resolve, reject };
  });
  code.catch(() => {});
  let done = false;

  const server = createServer((request, response) => {
    const answer = (status: number, body: string, type = 'text/html; charset=utf-8'): void => {
      response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', connection: 'close' });
      response.end(body);
    };
    const url = new URL(request.url ?? '/', `http://${HOST}`);
    if (request.method !== 'GET' || url.pathname !== PATH || done) return answer(404, 'not found\n', 'text/plain; charset=utf-8');
    if (!sameText(url.searchParams.get('state') ?? '', state)) return answer(400, NOT_OURS);
    const given = url.searchParams.get('code');
    if (!given) return answer(400, NO_CODE);
    done = true;
    response.on('finish', () => finish(() => settle.resolve(given)));
    return answer(200, SIGNED_IN);
  });

  let closedResolve: () => void = () => {};
  const closed = new Promise<void>((resolve) => {
    closedResolve = resolve;
  });
  let timer: NodeJS.Timeout | undefined;
  function finish(outcome: () => void): void {
    done = true;
    clearTimeout(timer);
    outcome();
    server.close(() => closedResolve());
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
  const { port, address } = server.address() as AddressInfo; // ts-allow: a TCP listener's address is never a pipe's string or null
  const minutes = Math.round(timeoutMs / 60_000);
  timer = setTimeout(
    () => finish(() => settle.reject(new LoopbackError(`no sign-in came back within ${minutes >= 1 ? `${minutes} min` : `${timeoutMs} ms`}.`))),
    timeoutMs,
  );

  return {
    port,
    address,
    redirectUri: `http://${HOST}:${port}${PATH}`,
    code,
    closed,
    async close() {
      if (server.listening) finish(() => settle.reject(new LoopbackError('the listener was stopped before a sign-in came back.')));
      await closed;
    },
  };
}

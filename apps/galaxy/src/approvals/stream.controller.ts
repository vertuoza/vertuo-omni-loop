import { z } from 'zod';
import { PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { TokenCheck } from '../ask/auth';
import { refuse } from '../business-api/reply';
import { callerOf, refusalOf } from './approvals.controller';
import type { HistoryRepository } from './approvals.repository';
import { openFeed, type StreamEvent } from './stream.service';

// The approval stream's HTTP edge (PRD 1322 s3, spec §4), a plain function of a Request so it is tested
// with a fake repository and its route stays one line:
//
//   GET /api/dossiers/approval/stream?repo=<owner/name>&prd=<n>   (Last-Event-ID when resuming)
//     → 200 text/event-stream: asked, re-asked, approved, voided (each with its id), ping every 15 s,
//       and `reconnect` just before the function's time limit, when the stream closes
//
// The caller is `omni wait approval`, with the terminal's sign-in (a bearer token). Refusals before the
// stream opens follow ADR-0029, each `{error}` in plain words: 400 a malformed query, 401 no valid
// sign-in, 403 not a member, 404 no such PRD the caller reads, 503 no database here or the sign-in
// service down, 500 the database failed.

/** A client acting as one access token: the Auth server's check and the caller's history. */
type CallerClient = TokenCheck & { history: HistoryRepository };

export type StreamDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => CallerClient) | null;
  /** How often a ping goes out, and the history is looked at again. */
  pingMs: number;
  /** How long a stream lives before it says `reconnect` and closes: under the function's limit. */
  lifetimeMs: number;
  log: (line: string) => void;
};

const NOT_READ = 'The approval could not be read. Try again.';

const Query = z.object({
  repo: z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/),
  prd: z.string().regex(/^\d{1,9}$/).transform(Number).pipe(PrdNumberSchema),
});

const SSE_HEADERS = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-store, no-transform',
  connection: 'keep-alive',
  // A proxy in front must hand each event on at once.
  'x-accel-buffering': 'no',
};

/** One Server-Sent Event: `id:` (when it has one), `event:`, `data:` (when it has some), a blank line. */
function frame(event: string, id?: string, data?: unknown): string {
  return [id === undefined ? null : `id: ${id}`, `event: ${event}`, data === undefined ? null : `data: ${JSON.stringify(data)}`]
    .filter((line): line is string => line !== null)
    .join('\n') + '\n\n';
}

const frameOf = (e: StreamEvent) => frame(e.event, e.id, e.data);

/** GET: follows a PRD's approval as Server-Sent Events, until the function's limit is near or the
 * caller goes. */
export async function streamApproval(request: Request, deps: StreamDeps): Promise<Response> {
  const client = await callerOf(request, deps.connect);
  if (client instanceof Response) return client;
  const url = new URL(request.url);
  const query = Query.safeParse({ repo: url.searchParams.get('repo') ?? '', prd: url.searchParams.get('prd') ?? '' });
  if (!query.success) return refuse(400, 'The query must name a repository and a PRD: ?repo=<owner/name>&prd=<number>.');
  const { repo, prd } = query.data;
  const opened = await openFeed(client.history, repo.toLowerCase(), prd, request.headers.get('last-event-id'), deps.log);
  if (!opened.ok) return refusalOf(opened.refusal, NOT_READ, deps.log);
  const feed = opened.value;
  if (!feed) return refuse(404, `No PRD #${prd} of ${repo} you can read.`);

  const encoder = new TextEncoder();
  let stop: ((cancelled: boolean) => void) | null = null;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      let unwatch: () => void = () => undefined;
      const timers: Array<ReturnType<typeof setTimeout>> = [];
      const send = (text: string) => { if (open) controller.enqueue(encoder.encode(text)); };
      const look = () => { void feed.next().then((events) => { for (const e of events) send(frameOf(e)); }); };
      // A cancelled stream (the caller went) is already closed: only the timers and Realtime stop.
      const close = (cancelled: boolean) => {
        if (!open) return;
        open = false;
        for (const timer of timers) clearTimeout(timer);
        request.signal.removeEventListener('abort', onAbort);
        unwatch();
        if (!cancelled) controller.close();
      };
      const onAbort = () => { close(false); };
      timers.push(setInterval(() => { send(frame('ping')); look(); }, deps.pingMs));
      timers.push(setTimeout(() => { send(frame('reconnect')); close(false); }, deps.lifetimeMs));
      stop = close;
      request.signal.addEventListener('abort', onAbort);
      for (const e of feed.start) send(frameOf(e));
      feed.watch(look).then(
        (off) => { if (open) unwatch = off; else off(); },
        (error: unknown) => { deps.log(`approvals: the stream of ${repo} #${prd} could not follow Realtime, it looks at every ping: ${error instanceof Error ? error.message : String(error)}`); },
      );
    },
    cancel() { stop?.(true); },
  });
  return new Response(body, { status: 200, headers: SSE_HEADERS });
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { approvalEvent, sseReader } from 'vertuo-omni-plan/kit/lib/approval/stream.ts';
import type { Answer, ApprovalHistory, HistoryRepository } from './approvals.repository';
import { streamApproval, type StreamDeps } from './stream.controller';

// The approval stream's edge (PRD 1322 s3), against a fake repository and fake timers: the refusals
// before it opens, the SSE framing read back through the kit's own reader (settled item
// s4-01-approval-stream-contract), Last-Event-ID replay, a ping every 15 s that also looks again,
// Realtime's nudge, `reconnect` before the limit, and a caller who goes.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const ADA = '00000000-0000-4000-8000-0000000000a2';
const IRISA = '00000000-0000-4000-8000-0000000000a4';
const URL_OF = 'https://galaxy.test/api/dossiers/approval/stream?repo=Acme/Mobile&prd=7';
const TOKEN = 'token-ada';

const ASKED: ApprovalHistory['requests'][number] = { id: 'r1', kind: 'asked', askedAt: '2026-10-09T10:00:00Z', askedBy: ADA, asked: [IRISA], nobodyElse: false, product: 'Mobile' };
const APPROVED = { id: 'a1', approver: 'irisa-gh', approvedAt: '2026-10-09T10:01:00Z', pinned: 3 };
const VOIDED = { id: 'v1', pusher: 'ada-gh', kind: 'plan', from: 'a'.repeat(64), to: 'b'.repeat(64), voidedAt: '2026-10-09T10:02:00Z' };

const history = (over: Partial<ApprovalHistory> = {}): ApprovalHistory => ({
  dossier: DOSSIER, author: null, requests: [ASKED], approvals: [], voids: [],
  people: [{ user: ADA, login: 'ada-gh', name: null }, { user: IRISA, login: 'irisa-gh', name: 'Irisa' }],
  ...over,
});

type World = { database?: boolean; signedIn?: boolean; reads?: Array<Answer<ApprovalHistory | null>>; watchFails?: boolean };

function world({ database = true, signedIn = true, reads = [{ ok: true, value: history() }], watchFails = false }: World = {}) {
  const read: Array<{ repo: string; prd: number; as: string }> = [];
  const logs: string[] = [];
  const state: { nudge: (() => void) | null; unwatched: number; current: typeof reads } = { nudge: null, unwatched: 0, current: reads };
  let i = 0;
  const connect = (token: string) => ({
    auth: {
      getUser: (jwt: string) => Promise.resolve(signedIn && jwt === TOKEN
        ? { data: { user: { id: ADA, email: 'ada@acme.test' } }, error: null }
        : { data: { user: null }, error: { status: 401 } }),
    },
    history: {
      read(repo, prd) {
        read.push({ repo, prd, as: token });
        return Promise.resolve(state.current[Math.min(i++, state.current.length - 1)] ?? { ok: true, value: null });
      },
      watch(dossier, nudge) {
        if (watchFails) return Promise.reject(new Error('realtime down'));
        expect(dossier).toBe(DOSSIER);
        state.nudge = nudge;
        return Promise.resolve(() => { state.unwatched += 1; });
      },
    } satisfies HistoryRepository,
  });
  const deps: StreamDeps = { connect: database ? connect : null, pingMs: 15_000, lifetimeMs: 285_000, log: (line) => { logs.push(line); } };
  return { deps, read, logs, state };
}

function get(headers: Record<string, string> = {}, url = URL_OF, signal?: AbortSignal): Request {
  return new Request(url, { headers: { authorization: `Bearer ${TOKEN}`, accept: 'text/event-stream', ...headers }, ...(signal ? { signal } : {}) });
}

/** Reads the stream as the kit does: each message, and the kit's reading of it. */
function follow(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('no body');
  const sse = sseReader();
  const decoder = new TextDecoder();
  const messages: Array<{ event: string; id: string | null; data: string }> = [];
  const state = { done: false, raw: '' };
  void (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) { state.done = true; return; }
      const text = decoder.decode(value, { stream: true });
      state.raw += text;
      messages.push(...sse.push(text));
    }
  })();
  return { messages, state, cancel: () => reader.cancel() };
}

const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('GET /api/dossiers/approval/stream: refusals', () => {
  it('answers 503 with no database, 401 signed out, 400 a malformed query', async () => {
    expect((await streamApproval(get(), world({ database: false }).deps)).status).toBe(503);
    const out = await streamApproval(get(), world({ signedIn: false }).deps);
    expect(out.status).toBe(401);
    expect(await out.json()).toEqual({ error: 'This sign-in is not valid any more. Sign in again.' });
    expect((await streamApproval(get({ authorization: '' }), world().deps)).status).toBe(401);
    for (const bad of ['?repo=acme&prd=7', '?repo=acme/mobile&prd=0', '?repo=acme/mobile&prd=x', '?prd=7']) {
      const res = await streamApproval(get({}, `https://galaxy.test/api/dossiers/approval/stream${bad}`), world().deps);
      expect(res.status).toBe(400);
    }
  });

  it("answers 404 for a PRD the caller does not read, and the database's refusal in plain words", async () => {
    expect((await streamApproval(get(), world({ reads: [{ ok: true, value: null }] }).deps)).status).toBe(404);
    expect((await streamApproval(get(), world({ reads: [{ ok: false, refusal: { code: '42501', message: null } }] }).deps)).status).toBe(403);
    const w = world({ reads: [{ ok: false, refusal: { code: 'shape', message: 'approvals answered out of shape' } }] });
    const res = await streamApproval(get(), w.deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'The approval could not be read. Try again.' });
    expect(w.logs).toEqual(['approvals: approvals answered out of shape']);
  });
});

describe('GET /api/dossiers/approval/stream: the events', () => {
  it('reads as the caller, lower-cases the repository, and sends the PRD as it stands', async () => {
    const w = world();
    const res = await streamApproval(get(), w.deps);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(res.headers.get('cache-control')).toContain('no-store');
    const f = follow(res);
    await tick();
    expect(w.read).toEqual([{ repo: 'acme/mobile', prd: 7, as: TOKEN }]);
    expect(f.state.raw).toBe(`id: 1\nevent: asked\ndata: ${JSON.stringify({ asked: [{ login: 'irisa-gh', name: 'Irisa' }], nobodyElse: false, author: 'ada-gh', product: 'Mobile' })}\n\n`);
    expect(f.messages.map(approvalEvent)).toEqual([
      { type: 'asked', asking: { asked: [{ login: 'irisa-gh', name: 'Irisa' }], nobodyElse: false, author: 'ada-gh', product: 'Mobile' } },
    ]);
    await f.cancel();
  });

  it('replays the events after Last-Event-ID, each the kit reads', async () => {
    const w = world({ reads: [{ ok: true, value: history({ approvals: [APPROVED], voids: [VOIDED] }) }] });
    const f = follow(await streamApproval(get({ 'last-event-id': '1' }), w.deps));
    await tick();
    expect(f.messages.map((m) => [m.id, m.event])).toEqual([['2', 'approved'], ['3', 'voided']]);
    expect(f.messages.map(approvalEvent)).toEqual([
      { type: 'approved', approver: 'irisa-gh', approvedAt: '2026-10-09T10:01:00Z', pinned: 3 },
      { type: 'voided', pusher: 'ada-gh', kind: 'plan', from: 'a'.repeat(64), to: 'b'.repeat(64) },
    ]);
    await f.cancel();
  });

  it('pings every 15 s with no id and no data, and each ping looks again', async () => {
    const w = world({ reads: [{ ok: true, value: history() }, { ok: true, value: history() }, { ok: true, value: history({ approvals: [APPROVED] }) }] });
    const f = follow(await streamApproval(get(), w.deps));
    await tick(15_000);
    expect(f.state.raw).toContain('event: ping\n\n');
    expect(f.messages.map((m) => [m.id, m.event])).toEqual([['1', 'asked'], [null, 'ping']]);
    await tick(15_000);
    expect(f.messages.map((m) => [m.id, m.event])).toEqual([['1', 'asked'], [null, 'ping'], [null, 'ping'], ['2', 'approved']]);
    expect(approvalEvent(f.messages[1] ?? { event: '', id: null, data: '' })).toEqual({ type: 'ping' });
    await f.cancel();
  });

  it("sends a new row as soon as Realtime says one landed", async () => {
    const w = world({ reads: [{ ok: true, value: history() }, { ok: true, value: history({ approvals: [APPROVED] }) }] });
    const f = follow(await streamApproval(get(), w.deps));
    await tick();
    w.state.nudge?.();
    await tick();
    expect(f.messages.map((m) => [m.id, m.event])).toEqual([['1', 'asked'], ['2', 'approved']]);
    await f.cancel();
  });

  it("says reconnect, with no id, before the function's limit, then closes and stops following", async () => {
    const w = world();
    const f = follow(await streamApproval(get(), w.deps));
    await tick(284_999);
    expect(f.state.done).toBe(false);
    await tick(1);
    expect(f.messages.at(-1)).toEqual({ event: 'reconnect', id: null, data: '' });
    expect(approvalEvent(f.messages.at(-1) ?? { event: '', id: null, data: '' })).toEqual({ type: 'reconnect' });
    expect(f.state.done).toBe(true);
    expect(w.state.unwatched).toBe(1);
    await tick(60_000);
    expect(f.messages.filter((m) => m.event === 'reconnect')).toHaveLength(1);
  });

  it('stops pinging and following once the caller goes', async () => {
    const w = world();
    const gone = new AbortController();
    const f = follow(await streamApproval(get({}, URL_OF, gone.signal), w.deps));
    await tick();
    gone.abort();
    await tick();
    expect(f.state.done).toBe(true);
    expect(w.state.unwatched).toBe(1);
    const cancelled = world();
    const g = follow(await streamApproval(get(), cancelled.deps));
    await tick();
    await g.cancel();
    await tick(30_000);
    expect(cancelled.state.unwatched).toBe(1);
    expect(cancelled.read).toHaveLength(1);
  });

  it('keeps streaming on pings when Realtime cannot be followed, said in the log', async () => {
    const w = world({ watchFails: true, reads: [{ ok: true, value: history() }, { ok: true, value: history({ approvals: [APPROVED] }) }] });
    const f = follow(await streamApproval(get(), w.deps));
    await tick(15_000);
    expect(f.messages.map((m) => m.event)).toEqual(['asked', 'ping', 'approved']);
    expect(w.logs).toEqual(['approvals: the stream of Acme/Mobile #7 could not follow Realtime, it looks at every ping: realtime down']);
    await f.cancel();
  });
});

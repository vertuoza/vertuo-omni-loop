// `omni supervisor` (PRD omni-loop-34, s4), seen from the outside: through `main()`, a fake stdin and a fake `fetch`
// that answers the Supervisor API. The seat's tools call the API only, with the runner's sign-in and `?runner=`; a
// refusal is the app's own words as a tool error. No network, no model, no GitHub.
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../lib/ask/schema.ts';
import { main } from '../bin/omni.ts';

const PAGE = 'https://omni.test';
const RUNNER = '00000000-0000-4000-8000-000000000900';
const FINDING = '00000000-0000-4000-8000-000000000500';

type Seen = { method: string; url: string; auth: string | null; body: unknown };

const rpc = (id: number, method: string, params?: unknown): string => `${JSON.stringify({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) })}\n`;
const callOf = (id: number, name: string, args: unknown): string => rpc(id, 'tools/call', { name, arguments: args });

const OPEN_FINDING = {
  id: FINDING, fingerprint: 'stuck:silent:job-1', kind: 'stuck', severity: 'medium', title: 'A wave job is silent', checkLine: 'Silent job: no line for 52 min, 3× the 2.5 min usual',
  explanation: null, lookedAt: null, state: 'open', figures: {}, evidence: [], raisedBy: 'check', createdAt: '2026-11-25T08:00:00Z', closedAt: null, proposals: [],
};

async function omni(args: string[], input: string, route: (seen: Seen) => Response) {
  const store: Record<string, Tokens> = { 'omni.test': { access_token: 'access-1', refresh_token: 'refresh-1' } };
  const tokens = { read: (host: string) => store[host] ?? null, write: (host: string, entry: Tokens) => { store[host] = entry; } };
  const seen: Seen[] = [];
  const fetch = (url: string, init: RequestInit): Promise<Response> => {
    const entry = { method: init.method ?? 'GET', url: url.replace(PAGE, ''), auth: new Headers(init.headers).get('authorization'), body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : null };
    seen.push(entry);
    return Promise.resolve(route(entry));
  };
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['supervisor', ...args], { cwd: '/', stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) }, tokens, fetch, env: {}, stdin: input });
  const replies = out.join('').split('\n').filter((line) => line !== '').map((line) => JSON.parse(line) as { id: number; result?: { tools?: { name: string }[]; content?: { text: string }[]; isError?: boolean } })
    .sort((a, b) => a.id - b.id);
  return { code, replies, seen, err: err.join('') };
}

describe('omni supervisor mcp', () => {
  it('lists the six tools, with no request to the Omni page', async () => {
    const run = await omni(['mcp', '--runner', RUNNER, '--page', PAGE], rpc(1, 'initialize', { protocolVersion: '2025-06-18' }) + rpc(2, 'tools/list'), () => Response.json({}));
    expect(run.code).toBe(0);
    expect(run.replies[1]?.result?.tools?.map((tool) => tool.name)).toEqual(['snapshot', 'lines', 'memory', 'raise', 'reply', 'propose']);
    expect(run.seen).toEqual([]);
  });

  it('writes a note through the memory route, with the runner\'s sign-in and its runner', async () => {
    const note = { id: '00000000-0000-4000-8000-000000000700', scope: 'long', line: 'Baseline wave: 2.5 min', cites: [FINDING], createdAt: '2026-11-25T08:00:00Z', expiresAt: null };
    const run = await omni(['mcp', '--runner', RUNNER, '--page', PAGE], callOf(3, 'memory', { scope: 'long', line: note.line, cites: [FINDING] }), () => Response.json({ note }));
    expect(run.seen).toEqual([{ method: 'POST', url: `/api/supervisor/memory?runner=${RUNNER}`, auth: 'Bearer access-1', body: { scope: 'long', line: note.line, cites: [FINDING] } }]);
    expect(JSON.parse(run.replies[0]?.result?.content?.[0]?.text ?? '{}')).toMatchObject({ id: note.id, line: note.line });
  });

  it('proposes on a finding a check wrote alone: a raise of its fingerprint, with the explanation and the suggestions', async () => {
    const suggestions = [{ action: 'stop-resume-job', label: 'Stop and resume the job', target: { job: 'job-1' } }];
    const run = await omni(['mcp', '--runner', RUNNER, '--page', PAGE], callOf(4, 'propose', { finding: FINDING, explanation: 'Its test run hangs.', suggestions }), (seen) =>
      seen.method === 'GET' ? Response.json({ findings: [OPEN_FINDING] }) : Response.json({ finding: { ...OPEN_FINDING, explanation: 'Its test run hangs.', lookedAt: '2026-11-25T08:02:00Z' }, raised: false, notified: false }));
    expect(run.seen.map((seen) => `${seen.method} ${seen.url}`)).toEqual([`GET /api/supervisor/findings?runner=${RUNNER}&state=open`, `POST /api/supervisor/findings?runner=${RUNNER}`]);
    expect(run.seen[1]?.body).toEqual({ kind: 'stuck', severity: 'medium', title: OPEN_FINDING.title, fingerprint: OPEN_FINDING.fingerprint, explanation: 'Its test run hangs.', suggestions });
    expect(run.replies[0]?.result?.isError).toBeUndefined();
  });

  it('answers a refusal in the app\'s own words, and inputs out of shape, as tool errors', async () => {
    const refused = await omni(['mcp', '--runner', RUNNER, '--page', PAGE], callOf(5, 'raise', { kind: 'stuck', severity: 'high', title: 'Again', fingerprint: 'stuck:x', explanation: 'x' }),
      () => Response.json({ error: 'An owner said Not a problem to this, with the same evidence: it is not raised again.' }, { status: 409 }));
    expect(refused.replies[0]?.result).toMatchObject({ isError: true, content: [{ text: 'raise: An owner said Not a problem to this, with the same evidence: it is not raised again.' }] });
    const malformed = await omni(['mcp', '--runner', RUNNER, '--page', PAGE], callOf(6, 'raise', { kind: 'merge', title: 'x' }), () => Response.json({}));
    expect(malformed.replies[0]?.result?.isError).toBe(true);
    expect(malformed.seen).toEqual([]);
  });
});

describe('omni supervisor', () => {
  it('says the runner holds no seat, and exits 1', async () => {
    const run = await omni(['--runner', RUNNER, '--page', PAGE], '', () => Response.json({ error: 'This runner holds no Supervisor seat.' }, { status: 403 }));
    expect(run.code).toBe(1);
    expect(run.err).toContain(`runner ${RUNNER} holds no Supervisor seat`);
  });

  it('refuses with no Omni page, and with no runner', async () => {
    const run = await omni(['--runner', RUNNER], '', () => Response.json({}));
    expect(run.code).toBe(1);
    expect(run.err).toContain('no Omni page');
    expect((await omni([], '', () => Response.json({}))).code).not.toBe(0);
  });
});

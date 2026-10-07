// `omni roadmap check [<n>]` and `omni check inbox` on a roadmap, through `main()` (PRD 1162, s4);
// `omni roadmap push` and `omni roadmap answer` (s6).
import type { ExecFileSyncOptions } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { CALL_TIMEOUT_MS } from '../lib/ask/client.ts';
import type { Tokens } from '../lib/ask/schema.ts';
import { parseCommentId } from '../lib/ids.ts';
import { answerComment, readAnswers } from '../lib/roadmap/answers.ts';
import { makeRepo, realExec } from '../test/fixture.ts';
import type { FetchInit } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

async function run(argv: readonly string[], cwd: string) {
  const s = io();
  const code = await main(argv, { cwd, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

const IN = '.omni-loop/delivery/inbox';
const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };

function spec(prd: number, blockedBy: string): string {
  return ['---', `prd: ${prd}`, `title: PRD ${prd}`, `blocked-by: ${blockedBy}`, 'spec: file', '---', ''].join('\n');
}

function roadmapMd(number: number, rows: string[]): string {
  return [
    '---',
    `roadmap: ${number}`,
    'title: Crew',
    'milestone: A company grants its first mandate.',
    '---',
    '',
    '## PRDs',
    '',
    '| id | PRD | title | blocked by | why | wave |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

const SPECS = {
  [`${IN}/1201-skeleton/spec.md`]: spec(1201, 'none'),
  [`${IN}/1202-worker/spec.md`]: spec(1202, '[1201]'),
  [`${IN}/1203-think/spec.md`]: spec(1203, '[1201, 1202]'),
};
const GREEN = roadmapMd(1200, [
  '| P1 | #1201 | Skeleton | – | – | 1 |',
  '| P2 | #1202 | Worker | P1 | it runs on the skeleton | 2 |',
  '| P3 | #1203 | Think | P1, P2 | the worker calls it | 3 |',
]);
const RED = roadmapMd(1300, [
  '| P1 | #1201 | Skeleton | – | – | 2 |',
  '| P2 | #1202 | Worker | P1 | – | 3 |',
  '| P3 | #1203 | Think | P2 | the worker calls it | 4 |',
]);

describe('omni roadmap check', () => {
  it('prints a green roadmap wave by wave and exits 0', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, ...SPECS, [`${IN}/roadmaps/1200-crew/roadmap.md`]: GREEN } });
    const { code, out } = await run(['roadmap', 'check'], root);
    expect(code).toBe(0);
    expect(out).toContain(`omni roadmap check — roadmap 1200: 3 PRD(s) across 3 wave(s) (${IN}/roadmaps/1200-crew/roadmap.md).`);
    expect(out).toMatch(/^ {2}wave 1: P1 #1201\n {2}wave 2: P2 #1202\n {2}wave 3: P3 #1203$/m);
    expect(out).toContain('omni roadmap check — roadmap 1200: every row, blocker and question holds.');
  });

  it('prints every violation of a red roadmap and exits 1', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, ...SPECS, [`${IN}/roadmaps/1300-crew/roadmap.md`]: RED } });
    const { code, out } = await run(['roadmap', 'check'], root);
    expect(code).toBe(1);
    const file = `${IN}/roadmaps/1300-crew/roadmap.md`;
    expect(out).toContain('omni roadmap check — roadmap 1300: violation(s):');
    expect(out).toContain(`  ${file}: P1: in wave 2, but it has no blocker, so its wave is 1.`);
    expect(out).toContain(`  ${file}: P2: blocked by P1 with no why — every blocker says why it blocks.`);
    expect(out).toContain(`  ${file}: P3: PRD #1203's spec is blocked by #1201, #1202, but its row by #1202.`);
  });

  it('grades one roadmap when given its number', async () => {
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, ...SPECS, [`${IN}/roadmaps/1200-crew/roadmap.md`]: GREEN, [`${IN}/roadmaps/1300-crew/roadmap.md`]: RED },
    });
    const one = await run(['roadmap', 'check', '1200'], root);
    expect(one.code).toBe(0);
    expect(one.out).not.toContain('1300');
    const all = await run(['roadmap', 'check'], root);
    expect(all.code).toBe(1);
  });

  it("refuses a front matter number that disagrees with its folder's", async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, ...SPECS, [`${IN}/roadmaps/1250-crew/roadmap.md`]: GREEN } });
    const { code, out } = await run(['roadmap', 'check'], root);
    expect(code).toBe(1);
    expect(out).toContain(`${IN}/roadmaps/1250-crew/roadmap.md: roadmap 1200 does not agree with its folder's number, 1250.`);
  });

  it('refuses a table that does not parse, and a folder with no roadmap.md', async () => {
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, [`${IN}/roadmaps/1200-crew/roadmap.md`]: '---\nroadmap: 1200\ntitle: T\nmilestone: M\n---\n', [`${IN}/roadmaps/1300-empty/notes.md`]: 'x' },
    });
    const { code, out } = await run(['roadmap', 'check'], root);
    expect(code).toBe(1);
    expect(out).toContain(`${IN}/roadmaps/1200-crew/roadmap.md: sections: no "## PRDs" section.`);
    expect(out).toContain(`${IN}/roadmaps/1300-empty/roadmap.md: roadmap.md is missing.`);
  });

  it('passes an inbox with no roadmap', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out } = await run(['roadmap', 'check'], root);
    expect(code).toBe(0);
    expect(out).toContain('omni roadmap check — no roadmap in the inbox.');
  });

  it('exits 2 with one line on an unknown roadmap or a bad argument', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const unknown = await run(['roadmap', 'check', '1200'], root);
    expect(unknown.code).toBe(2);
    expect(unknown.err).toMatch(/roadmap 1200 has no folder/);
    expect((await run(['roadmap', 'check', 'x'], root)).code).toBe(2);
    expect((await run(['roadmap'], root)).code).toBe(2);
  });

  it('runs in a plan repository, printing the repositories and refusing a read-only one', async () => {
    const config = {
      '.omni-loop/config.yml': [
        'kit: 1',
        'repo:',
        '  slug: vertuoza/crew-plan',
        'plan:',
        '  targets:',
        '    - repo: vertuoza/crew',
        '      role: back-end',
        '      knowledge: own',
        '    - repo: vertuoza/backend-php',
        '      role: legacy',
        '      knowledge: none',
        '      readOnly: true',
        '',
      ].join('\n'),
    };
    const text = [
      '---',
      'roadmap: 1200',
      'title: Crew',
      'milestone: M',
      '---',
      '## PRDs',
      '| id | PRD | title | repos | blocked by | why | wave |',
      '|---|---|---|---|---|---|---|',
      '| P1 | #1201 | Skeleton | crew | – | – | 1 |',
      '| P2 | #1202 | Worker | crew, backend-php | P1 | it runs on the skeleton | 2 |',
      '',
    ].join('\n');
    const { root } = makeRepo({
      git: true,
      files: { ...config, [`${IN}/1201-skeleton/spec.md`]: spec(1201, 'none'), [`${IN}/1202-worker/spec.md`]: spec(1202, '[1201]'), [`${IN}/roadmaps/1200-crew/roadmap.md`]: text },
    });
    const { code, out } = await run(['roadmap', 'check'], root);
    expect(code).toBe(1);
    expect(out).toContain('  wave 2: P2 #1202 (crew, backend-php)');
    expect(out).toContain('P2: backend-php is a read-only target — no roadmap row may name it.');
  });
});

describe('omni check inbox on a roadmap', () => {
  it('fails on a broken roadmap, and passes on a green one', async () => {
    const red = makeRepo({ git: true, files: { ...CONFIG, ...SPECS, [`${IN}/roadmaps/1300-crew/roadmap.md`]: RED } });
    const failed = await run(['check', 'inbox'], red.root);
    expect(failed.code).toBe(1);
    expect(failed.out).toContain(`${IN}/roadmaps/1300-crew/roadmap.md: P1: in wave 2, but it has no blocker, so its wave is 1.`);
    const green = makeRepo({ git: true, files: { ...CONFIG, ...SPECS, [`${IN}/roadmaps/1200-crew/roadmap.md`]: GREEN } });
    expect((await run(['check', 'inbox'], green.root)).code).toBe(0);
  });
});

// ── PRD 1162, slice s6: `omni roadmap push` and `omni roadmap answer` ───────────────────────────────
// Through `main()` with `gh` stubbed (the PRDs' feature PRs and the roadmap issue's comments) and a
// fetch that answers as `POST /api/roadmaps` does; the sign-in is an in-memory token store.

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const ROADMAP_ID = '00000000-0000-4000-8000-000000000042';
const PUSH_CONFIG = (url: string | null = BASE) => ({ '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url ?? 'null'}\n` });

function memoryTokens(entries: Record<string, Tokens> = {}) {
  const store: Record<string, Tokens> = { ...entries };
  return { store, read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}
const signedIn = () => memoryTokens({ [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } });

type Call = { url: string; method: string | undefined; authorization: string | undefined; body: unknown; signal: AbortSignal | null | undefined };

function stubFetch(reply: (url: string, init: FetchInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch = (url: string, init: FetchInit) => {
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init.method, authorization: init.headers.authorization, body, signal: init.signal });
    return Promise.resolve().then(() => reply(url, init));
  };
  return { calls, fetch };
}
const json = (status: number, body = {}) => new Response(JSON.stringify(body), { status });
const pushed = (note: string | null = null) => () => json(201, { roadmapId: ROADMAP_ID, created: true, product: null, unknownProduct: null, note });

const WITH_QUESTIONS = [
  GREEN.trimEnd(),
  '',
  '## Open questions',
  '',
  '| id | question | recommendation | blocks | kind |',
  '|---|---|---|---|---|',
  '| Q2 | Which default? | The first | P2 | default |',
  '| Q5 | A trial week? | – | P3 | person |',
  '',
].join('\n');

type GhPr = { number: number; url: string; state: string; isDraft: boolean; createdAt: string; mergedAt: string | null; closedAt: string | null; updatedAt: string };

/** An exec that answers `gh` as GitHub would for `prs` (by head branch) and the issue's `comments`,
 * keeps every comment posted, and runs anything else for real. */
function fakeGh({ prs = {}, comments = [], down = false }: { prs?: Record<string, GhPr[]>; comments?: Array<{ id: number; body: string }>; down?: boolean } = {}) {
  const posted: Array<{ path: string; body: string }> = [];
  const gh = (args: readonly string[], options?: ExecFileSyncOptions) => {
    if (args[0] === 'pr' && args[1] === 'list') return JSON.stringify(prs[args[args.indexOf('--head') + 1] ?? ''] ?? []);
    if (args[0] === 'api' && args.includes('--input')) {
      posted.push({ path: args[1] ?? '', body: sentBody(options) });
      return JSON.stringify({ id: 99, html_url: 'https://github.com/acme/widgets/issues/1200#issuecomment-99' });
    }
    if (args[0] === 'api') return JSON.stringify(comments);
    throw new Error(`unexpected gh ${args.join(' ')}`);
  };
  const exec = (file: string, args: readonly string[], options?: ExecFileSyncOptions) => {
    if (file !== 'gh') return realExec(file, args, options);
    if (down) throw new Error('gh: could not connect');
    return gh(args, options);
  };
  return { exec, posted };
}

/** The `body` of the JSON a `gh api --input -` call sends; empty when it carries none. */
function sentBody(options?: ExecFileSyncOptions): string {
  const sent: unknown = JSON.parse(typeof options?.input === 'string' ? options.input : '{}');
  return typeof sent === 'object' && sent !== null && 'body' in sent && typeof sent.body === 'string' ? sent.body : '';
}

async function omni(argv: string[], { root, exec, fetch, tokens = signedIn() }: { root: string; exec: ReturnType<typeof fakeGh>['exec']; fetch?: unknown; tokens?: ReturnType<typeof memoryTokens> }) {
  const s = io();
  const code = await main(argv, { cwd: root, exec, env: {}, tokens, fetch, stdout: s.stdout, stderr: s.stderr });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

function pushRepo(url: string | null = BASE, text = WITH_QUESTIONS) {
  return makeRepo({ git: true, files: { ...PUSH_CONFIG(url), ...SPECS, [`${IN}/roadmaps/1200-crew/roadmap.md`]: text } });
}

const PR21: GhPr = { number: 21, url: 'https://github.com/acme/widgets/pull/21', state: 'MERGED', isDraft: false, createdAt: '2026-10-01T09:00:00Z', mergedAt: '2026-10-03T09:00:00Z', closedAt: '2026-10-03T09:00:00Z', updatedAt: '2026-10-03T09:00:00Z' };
const PR22: GhPr = { number: 22, url: 'https://github.com/acme/widgets/pull/22', state: 'OPEN', isDraft: false, createdAt: '2026-10-04T09:00:00Z', mergedAt: null, closedAt: null, updatedAt: '2026-10-05T09:00:00Z' };

describe('omni roadmap push', () => {
  it("sends the roadmap, its answers and each PRD's standing, exactly the contract's fields", async () => {
    const { root } = pushRepo();
    const { exec } = fakeGh({
      prs: { 'feat/skeleton': [PR21], 'feat/worker': [PR22] },
      comments: [{ id: 1, body: '<!-- omni-roadmap-answer: Q5 -->\n**Q5**, answered:\n\nyes' }, { id: 2, body: 'unmarked' }],
    });
    const { calls, fetch } = stubFetch(pushed());
    const { code, out, err } = await omni(['roadmap', 'push', '1200'], { root, exec, fetch });
    expect({ code, err }).toEqual({ code: 0, err: '' });
    expect(out).toBe(`roadmap 1200: created, 3 PRD(s) — ${BASE}/roadmaps/${ROADMAP_ID}\n`);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: `${BASE}/api/roadmaps`, method: 'POST', authorization: 'Bearer access-1' });
    expect(calls[0]?.body).toEqual({
      repo: 'acme/widgets', roadmap: 1200, title: 'Crew', milestone: 'A company grants its first mandate.', product: null, target: null, source: null,
      document: WITH_QUESTIONS,
      questions: [
        { id: 'Q2', question: 'Which default?', recommendation: 'The first', blocks: ['P2'], kind: 'default', answer: null },
        { id: 'Q5', question: 'A trial week?', recommendation: null, blocks: ['P3'], kind: 'person', answer: 'yes' },
      ],
      prds: [
        { id: 'P1', prd: 1201, title: 'Skeleton', repos: [], blockers: [], wave: 1, state: 'merged', waitsOn: null, waitsOnUrl: null, startedAt: PR21.createdAt, endedAt: PR21.mergedAt },
        { id: 'P2', prd: 1202, title: 'Worker', repos: [], blockers: ['P1'], wave: 2, state: 'ready', waitsOn: null, waitsOnUrl: null, startedAt: PR22.createdAt, endedAt: null },
        {
          id: 'P3', prd: 1203, title: 'Think', repos: [], blockers: ['P1', 'P2'], wave: 3, state: 'waiting',
          waitsOn: 'waits on widgets#22 (P2 Worker): ready, waiting for your merge', waitsOnUrl: PR22.url, startedAt: null, endedAt: null,
        },
      ],
    });
  });

  it('prints the note the app gives on an unknown product', async () => {
    const { root } = pushRepo();
    const { fetch } = stubFetch(pushed('No product named "X" in this workspace: the roadmap is filed under none.'));
    const { code, out } = await omni(['roadmap', 'push', '1200'], { root, exec: fakeGh().exec, fetch });
    expect(code).toBe(0);
    expect(out).toContain('\nNo product named "X" in this workspace: the roadmap is filed under none.\n');
  });

  it("has the contract's 5-second limit on its call", async () => {
    const { root } = pushRepo();
    const { calls, fetch } = stubFetch(pushed());
    await omni(['roadmap', 'push', '1200'], { root, exec: fakeGh().exec, fetch });
    expect(CALL_TIMEOUT_MS).toBe(5000);
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('refreshes the sign-in once on a 401, then sends again', async () => {
    const { root } = pushRepo();
    let roadmapCalls = 0;
    const { calls, fetch } = stubFetch((url) => {
      if (url.endsWith('/api/ask/token')) return json(200, { access_token: 'access-2', refresh_token: 'refresh-2', expires_at: null });
      roadmapCalls += 1;
      return roadmapCalls === 1 ? json(401, { error: 'expired' }) : pushed()();
    });
    const { code } = await omni(['roadmap', 'push', '1200'], { root, exec: fakeGh().exec, fetch });
    expect(code).toBe(0);
    expect(calls.map((c) => [c.url.replace(BASE, ''), c.authorization])).toEqual([
      ['/api/roadmaps', 'Bearer access-1'], ['/api/ask/token', undefined], ['/api/roadmaps', 'Bearer access-2'],
    ]);
  });

  it('stops with one line, exit 1, never throwing: off, no sign-in, unreachable, refused, github unreachable', async () => {
    const quiet = stubFetch(pushed());
    const off = await omni(['roadmap', 'push', '1200'], { root: pushRepo(null).root, exec: fakeGh().exec, fetch: quiet.fetch });
    expect(off).toEqual({ code: 1, out: '', err: 'off\n' });
    const { root } = pushRepo();
    expect(await omni(['roadmap', 'push', '1200'], { root, exec: fakeGh().exec, fetch: quiet.fetch, tokens: memoryTokens() })).toEqual({ code: 1, out: '', err: 'no sign-in (omni signin)\n' });
    expect(quiet.calls).toHaveLength(0);
    const down = stubFetch(() => { throw new TypeError('fetch failed'); });
    expect(await omni(['roadmap', 'push', '1200'], { root, exec: fakeGh().exec, fetch: down.fetch })).toEqual({ code: 1, out: '', err: 'unreachable\n' });
    const refused = stubFetch(() => json(403, { error: 'No workspace of yours owns acme/widgets.' }));
    expect(await omni(['roadmap', 'push', '1200'], { root, exec: fakeGh().exec, fetch: refused.fetch })).toEqual({ code: 1, out: '', err: 'refused (403): No workspace of yours owns acme/widgets.\n' });
    const bare = stubFetch(() => new Response('oops', { status: 500 }));
    expect(await omni(['roadmap', 'push', '1200'], { root, exec: fakeGh().exec, fetch: bare.fetch })).toEqual({ code: 1, out: '', err: 'refused (500)\n' });
    expect(await omni(['roadmap', 'push', '1200'], { root, exec: fakeGh({ down: true }).exec, fetch: quiet.fetch })).toEqual({ code: 1, out: '', err: 'github unreachable\n' });
  });

  it('stops with one line on a roadmap.md that does not parse', async () => {
    const { root } = pushRepo(BASE, '---\nroadmap: 1200\ntitle: T\nmilestone: M\n---\n');
    const { code, err } = await omni(['roadmap', 'push', '1200'], { root, exec: fakeGh().exec, fetch: stubFetch(pushed()).fetch });
    expect(code).toBe(1);
    expect(err).toBe(`${IN}/roadmaps/1200-crew/roadmap.md does not parse (omni roadmap check 1200)\n`);
  });

  it('exits 2 with one line on an unknown roadmap or a bad argument', async () => {
    const { root } = pushRepo();
    const unknown = await omni(['roadmap', 'push', '1300'], { root, exec: fakeGh().exec });
    expect(unknown.code).toBe(2);
    expect(unknown.err).toBe("omni roadmap push: roadmap 1300 has no folder under the inbox's roadmaps.\n");
    expect((await omni(['roadmap', 'push'], { root, exec: fakeGh().exec })).code).toBe(2);
    expect((await omni(['roadmap', 'push', 'x'], { root, exec: fakeGh().exec })).code).toBe(2);
  });
});

describe('omni roadmap answer', () => {
  it('posts one comment on the roadmap issue carrying the marker, which reads back as the answer', async () => {
    const { root } = pushRepo();
    const { exec, posted } = fakeGh();
    const { code, out } = await omni(['roadmap', 'answer', '1200', 'Q5', 'yes'], { root, exec });
    expect(code).toBe(0);
    expect(out).toBe('roadmap 1200: Q5 answered — https://github.com/acme/widgets/issues/1200#issuecomment-99\n');
    expect(posted).toEqual([{ path: 'repos/acme/widgets/issues/1200/comments', body: answerComment('Q5', 'yes') }]);
    expect(readAnswers([{ id: parseCommentId(99), body: posted[0]?.body }]).get('Q5')).toBe('yes');
  });

  it('exits 2 with one line on an unknown question, an empty or too long answer, or a missing argument', async () => {
    const { root } = pushRepo();
    const { exec, posted } = fakeGh();
    const unknown = await omni(['roadmap', 'answer', '1200', 'Q9', 'yes'], { root, exec });
    expect(unknown).toEqual({ code: 2, out: '', err: 'omni roadmap answer: roadmap 1200 has no question Q9 (its questions: Q2, Q5).\n' });
    expect((await omni(['roadmap', 'answer', '1200', 'Q5', '  '], { root, exec })).code).toBe(2);
    expect((await omni(['roadmap', 'answer', '1200', 'Q5', 'x'.repeat(1001)], { root, exec })).code).toBe(2);
    expect((await omni(['roadmap', 'answer', '1200', 'Q5'], { root, exec })).code).toBe(2);
    expect((await omni(['roadmap', 'answer', '1300', 'Q5', 'yes'], { root, exec })).code).toBe(2);
    expect(posted).toEqual([]);
  });

  it('stops with one line when GitHub cannot take the comment', async () => {
    const { root } = pushRepo();
    expect(await omni(['roadmap', 'answer', '1200', 'Q5', 'yes'], { root, exec: fakeGh({ down: true }).exec })).toEqual({ code: 1, out: '', err: 'github unreachable\n' });
  });
});

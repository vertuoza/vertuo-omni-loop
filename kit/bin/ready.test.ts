// `omni ready <prd> [--json]` (PRD 2898, s3), through `main()` with a `gh` that answers from a table: the
// head commit's check runs and acceptance report, the diff, the plan, the spec and the ledger. No real
// GitHub is called. AC-3 (a running test job), AC-4 (an excused out-of-territory file) and AC-5 (a
// report proving only AC-1) are each one test below.
import { describe, expect, it } from 'vitest';
import { renderSettledEntry } from '../lib/outbox/settle.ts';
import { makeRepo, realExec } from '../test/fixture.ts';
import type { FakeExec } from '../test/fixture.ts';
import { main } from './omni.ts';

const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const DIR = '.omni-loop/delivery/inbox/2898-demo';
const OUTBOX = '.omni-loop/delivery/outbox/2898-demo';
const FENCE = '```';

const CONFIG = '.omni-loop/config.yml';
const CONFIG_TEXT = 'kit: 1\nrepo:\n  slug: acme/widgets\nready:\n  checks: mission\n  full: [test, lint]\n';

const PLAN = ['# Plan', '', '| id | slice | territory | blocked by | wave | tier |', '| --- | --- | --- | --- | --- | --- |', '| s1 | The rule | `kit/lib/` | — | 1 | build |', ''].join('\n');

const scenario = (title: string) => [`${FENCE}gherkin`, `Scenario: ${title}`, '  Given a thing', '  When it runs', '  Then it works', FENCE].join('\n');
const SPEC = ['## Acceptance criteria', '', '### AC-1 · test', '', scenario('one'), '', '### AC-2 · test', '', scenario('two'), ''].join('\n');

const run = (name: string, conclusion: string | null = 'success', status = 'completed', text?: string) => ({ name, status, conclusion, html_url: null, ...(text === undefined ? {} : { output: { text } }) });

const proof = (ac: number) => ({ ac, kind: 'test', state: 'passed', title: `AC-${String(ac)}: it works`, proof: 'kit/x.test.ts' });
const reportOf = (...acs: number[]) => JSON.stringify({ format: 'omni-acceptance/1', commit: HEAD, results: acs.map(proof) });

type World = {
  prs?: unknown[] | Error;
  runs?: unknown[] | Error;
  files?: { filename: string; status: string }[];
  /** Files by `<ref>:<path>`, `head:` and `base:`. */
  texts?: Record<string, string>;
  outbox?: Record<string, string>;
};

/** The world of a green pull request, with `over` applied. */
function world(over: World = {}): Required<World> {
  return {
    prs: [{ number: 77, headRefOid: HEAD, isDraft: true }],
    runs: [run('test'), run('lint'), run('acceptance', 'success', 'completed', reportOf(1, 2))],
    files: [{ filename: 'kit/lib/a.ts', status: 'modified' }],
    texts: { [`${HEAD}:${DIR}/plan.md`]: PLAN, [`${HEAD}:${DIR}/spec.md`]: SPEC, [`${BASE}:${DIR}/spec.md`]: SPEC, [`${HEAD}:kit/lib/a.ts`]: 'export const a = 2;\n', [`${BASE}:kit/lib/a.ts`]: 'export const a = 1;\n' },
    outbox: {},
    ...over,
  };
}

const notFound = () => Object.assign(new Error('gh failed'), { stderr: 'gh: Not Found (HTTP 404)\n' });

function answer(value: unknown): string {
  if (value instanceof Error) throw value;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** A file of the table, or GitHub's 404. */
function found(text: string | undefined): string {
  if (text === undefined) throw notFound();
  return text;
}

/** `contents/<path>?ref=<ref>`: the outbox's listing and files, else a file at a ref. */
function contentsOf(w: Required<World>, where: string, ref: string): string {
  if (where === OUTBOX) {
    const names = Object.keys(w.outbox);
    return names.length === 0 ? found(undefined) : answer(names.map((name) => ({ name, type: 'file' })));
  }
  if (where.startsWith(`${OUTBOX}/`)) return found(w.outbox[where.slice(OUTBOX.length + 1)]);
  return found(w.texts[`${ref}:${where}`]);
}

/** The answer to a `repos/acme/widgets/<path>` call. */
function apiOf(w: Required<World>, path: string): string {
  const routes: Record<string, () => string> = {
    commits: () => answer(Array.isArray(w.runs) ? { check_runs: w.runs } : w.runs),
    compare: () => answer({ merge_base_commit: { sha: BASE }, files: w.files }),
  };
  const route = routes[path.split('/')[0] ?? ''];
  if (route) return route();
  const [, where = '', ref = ''] = /^contents\/(.+?)(?:\?ref=(.+))?$/.exec(path) ?? [];
  return contentsOf(w, where, ref);
}

/** A `gh` answering the world's table. */
function gh(w: Required<World>): FakeExec {
  return (file, args, options) => {
    if (file !== 'gh') return realExec(file, args, options);
    if (args[0] === 'pr') return answer(w.prs);
    return apiOf(w, /^repos\/acme\/widgets\/(.+)$/.exec(args.at(-1) ?? '')?.[1] ?? '');
  };
}

async function omni(args: string[], w: Required<World> = world(), extra: Record<string, string> = {}) {
  const { root, ctx } = makeRepo({ git: true, files: { [CONFIG]: CONFIG_TEXT, [`${DIR}/plan.md`]: PLAN, ...extra } });
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['ready', ...args], { cwd: root, env: {}, exec: gh(w), stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join(''), ctx };
}

const lines = (text: string) => text.trimEnd().split('\n');

/** An open item of the demo PRD, excusing `paths`. */
function itemText(id: string, paths: readonly string[]): string {
  return ['---', `id: ${id}`, 'prd: 2898', 'slice: s1', 'rank: high', 'bears-on: none', 'raised: 2026-11-15', 'wave: 1', `excuses: [${paths.join(', ')}]`, '---', '', '## What I had to decide', '', 'x', ''].join('\n');
}

describe('omni ready', () => {
  it('reads 5 of 5 on a green commit and exits 0', async () => {
    const { code, out } = await omni(['2898']);
    expect(code).toBe(0);
    const read = lines(out);
    expect(read).toHaveLength(7);
    expect(read[0]).toContain('pull request #77');
    expect(read.slice(1, 6).map((line) => line.slice(0, 6))).toEqual(['1 pass', '2 pass', '3 pass', '4 pass', '5 pass']);
    expect(read[6]).toBe('Ready for review · 5 of 5');
  });

  it('AC-3: reads check 2 as not finished while the test job runs, and the verdict as not ready', async () => {
    const { code, out } = await omni(['2898'], world({ runs: [run('test', null, 'in_progress'), run('lint'), run('acceptance', 'success', 'completed', reportOf(1, 2))] }));
    expect(code).toBe(1);
    const read = lines(out);
    expect(read.find((line) => line.startsWith('2 '))).toContain('not finished');
    expect(read.find((line) => line.startsWith('2 '))).toContain('still running: test');
    expect(read.at(-1)).toContain('Not finished');
  });

  it('AC-4: passes check 5 for an out-of-territory file an item names and a person answered A', async () => {
    const path = 'docs/extra.md';
    const files = [{ filename: 'kit/lib/a.ts', status: 'modified' }, { filename: path, status: 'added' }];
    const texts = { ...world().texts, [`${HEAD}:${path}`]: 'extra\n' };
    const bare = await omni(['2898'], world({ files, texts }));
    expect(bare.code).toBe(1);
    expect(lines(bare.out).find((line) => line.startsWith('5 '))).toContain(`outside every territory: ${path}`);

    const { ctx } = makeRepo({ files: { [CONFIG]: CONFIG_TEXT } });
    const text = itemText('s1-01-extra', [path]);
    const settled = renderSettledEntry({
      item: { id: 's1-01-extra', rank: 'high', bearsOn: 'none', raised: '2026-11-15', slice: undefined, wave: 1 },
      itemText: text,
      answer: { text: 'A', approvedBy: 'pierre', approvedAt: '2026-11-15T10:00:00Z', channel: null },
      judgement: { verdict: 'agreed', basis: 'answer', reason: 'the person picked A' },
      markers: ctx.markers,
    });
    const answered = await omni(['2898'], world({ files, texts, outbox: { 'settled.md': settled } }));
    expect(answered.code).toBe(0);
    expect(lines(answered.out).find((line) => line.startsWith('5 '))).toContain(`${path} excused by s1-01-extra`);
  });

  it('AC-5: fails check 3 naming AC-2 when the report proves only AC-1', async () => {
    const { code, out } = await omni(['2898'], world({ runs: [run('test'), run('lint'), run('acceptance', 'success', 'completed', reportOf(1))] }));
    expect(code).toBe(1);
    const check = lines(out).find((line) => line.startsWith('3 '));
    expect(check).toContain('fail');
    expect(check).toContain('AC-2 has no proof on this commit');
  });

  it('leaves a check not judged when gh cannot read its evidence', async () => {
    const { code, out } = await omni(['2898'], world({ runs: new Error('gh failed') }));
    expect(code).toBe(1);
    expect(lines(out).find((line) => line.startsWith('1 '))).toContain('not judged');
  });

  it('is not judged, exit 1, when no pull request is open', async () => {
    const { code, out } = await omni(['2898'], world({ prs: [] }));
    expect(code).toBe(1);
    expect(out).toContain('not judged: no open pull request from feat/demo');
  });

  it('prints the verdict, the pull request and whether the PRD is in a mission as JSON', async () => {
    const { code, out } = await omni(['2898', '--json']);
    expect(code).toBe(0);
    const json: unknown = JSON.parse(out);
    expect(json).toMatchObject({ prd: 2898, pr: { number: 77, head: HEAD, draft: true }, gated: { scope: 'mission', inMission: false }, ready: true, state: 'ready', passed: 5, headline: 'Ready for review · 5 of 5' });
  });

  it('says the PRD is in a mission when a mission record names it', async () => {
    const record = ['---', 'mission: 5', 'title: A mission', 'fleet: demo-fleet', 'goal: Ship the demo', 'scope:', '  prds: [2898]', '  roadmaps: []', '---', ''].join('\n');
    const { out } = await omni(['2898'], world(), { '.omni-loop/delivery/missions/0005-demo/mission.md': record });
    expect(lines(out)[0]).toContain('ready.checks is mission, PRD in mission #5');
  });

  it('refuses a missing PRD number', async () => {
    const { code } = await omni([]);
    expect(code).toBe(2);
  });

  it('is listed in the help', async () => {
    const { root } = makeRepo({ git: true, files: { [CONFIG]: CONFIG_TEXT } });
    const out: string[] = [];
    const code = await main(['help', 'ready'], { cwd: root, env: {}, exec: realExec, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => 0 } });
    expect(code).toBe(0);
    expect(out.join('')).toContain('omni ready <prd> [--json]');
  });
});

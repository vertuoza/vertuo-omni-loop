import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMarkers } from '../lib/markers.ts';
import { parseSettledEntries } from '../lib/outbox/settle.ts';
import { makeRepo, realExec } from '../test/fixture.ts';
import { dig } from './dig.ts';
import { main } from './omni.ts';
import type { ExecFileSyncOptions } from 'node:child_process';
import type { FetchInit, Files, Repo } from '../test/fixture.ts';

const markers = makeMarkers('omni-outbox');
const K = '.omni-loop/knowledge';
const SHIPPED = '.omni-loop/delivery/shipped/0042-widgets';
const LEDGER = `${SHIPPED}/outbox/settled.md`;
const KEY = 'test-key-not-a-secret';
const ASK_URL = 'https://omni.test';
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\nlaws:\n  source: knowledge\n';

const NAMED = 'A widget is named before it is saved.';
const BLUE = 'A widget is blue.';

const FILES: Files = {
  '.omni-loop/config.yml': CONFIG,
  [`${K}/README.md`]: '# Knowledge\n',
  [`${K}/product/principles.md`]: ['# Product principles', '', '## P-PRODUCT-1', '', 'Widgets are simple.', '', 'Why: people use them.', 'Decided: @ada, 2026-09-01', 'Source: PRD #3', ''].join('\n'),
  [`${K}/product/rules.md`]: [
    '# Product rules',
    '',
    '## BR-PRODUCT-1',
    '',
    NAMED,
    '',
    'Serves: P-PRODUCT-1',
    `Source: ${LEDGER}, entry s1-01-named, PRD #42`,
    'Enforced by: unenforced',
    '',
    '## BR-PRODUCT-2',
    '',
    BLUE,
    '',
    'Serves: P-PRODUCT-1',
    `Source: ${LEDGER}, entry s1-02-blue, PRD #42`,
    'Enforced by: unenforced',
    '',
  ].join('\n'),
  [`${K}/product/invariants.md`]: ['# Product invariants', '', '## N-PRODUCT-1', '', 'A widget is blue, as BR-PRODUCT-2 says.', '', 'Enforced by: kit/lib/widgets.test.ts', ''].join('\n'),
  'kit/lib/widgets.test.ts': 'test\n',
  [`${SHIPPED}/spec.md`]: '---\nprd: 42\ntitle: Widgets\n---\n\n# Widgets\n',
  [LEDGER]: [
    '# Settled',
    '',
    markers.settledOpen('s1-02-blue'),
    '- Rank: medium',
    '- Became: BR-PRODUCT-2',
    '',
    'The item.',
    markers.settledClose('s1-02-blue'),
    '',
  ].join('\n'),
};

const repos: Repo[] = [];
function repo(files: Files = FILES) {
  const r = makeRepo({ files, git: true });
  repos.push(r);
  return r;
}
const status = (root: string) => execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });

/** OpenRouter faked: `worthALaw` by the statement the prompt carries; Jev's reply on the Omni page. */
function stubs({ worth, jev = { answer: null, confidence: null, decidedBy: 'old' }, failing = [] }: { worth: Record<string, boolean>; jev?: unknown; failing?: string[] }) {
  const decides: unknown[] = [];
  const asked: string[] = [];
  const stub = vi.fn((url: string, init: FetchInit) => {
    const json = (body: unknown, code = 200) => Promise.resolve(new Response(JSON.stringify(body), { status: code, headers: { 'content-type': 'application/json' } }));
    if (url.startsWith(ASK_URL)) {
      decides.push(JSON.parse(String(init.body)));
      return json(jev);
    }
    const messages = dig(JSON.parse(String(init.body)), 'messages') as { role: string; content: string }[];
    const user = messages.find((m) => m.role === 'user')?.content ?? '';
    const statement = /^Statement: (.+)$/m.exec(user)?.[1] ?? '';
    asked.push(statement);
    if (failing.includes(statement)) return json({ error: 'nope' }, 400);
    return json({ choices: [{ message: { content: JSON.stringify({ worthALaw: worth[statement] ?? false, reason: 'because' }) } }] });
  });
  vi.stubGlobal('fetch', stub);
  return { decides, asked };
}

/** `gh` faked: each law issue opened gets the next number from 91. */
async function judge(r: Repo, { env = { OPENROUTER_API_KEY: KEY } }: { env?: Record<string, string> } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const opened: { args: readonly string[]; input: unknown }[] = [];
  const exec = (cmd: string, args: readonly string[], options?: ExecFileSyncOptions) => {
    if (cmd !== 'gh') return realExec(cmd, args, options);
    opened.push({ args, input: typeof options?.input === 'string' ? JSON.parse(options.input) : null });
    return JSON.stringify({ number: 90 + opened.length });
  };
  const code = await main(['knowledge', 'judge'], { cwd: r.root, exec, env, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join(''), opened };
}

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'omni-home-'));
  vi.stubEnv('HOME', home);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
  for (const made of repos.splice(0)) rmSync(made.root, { recursive: true, force: true });
});

describe('omni knowledge judge — the sweep (PRD 1342)', () => {
  it('pends each "yes" on its opened law issue, moves each "no" to its ledger, sets requireProof and reports who cited it', async () => {
    const r = repo();
    const { asked } = stubs({ worth: { [NAMED]: true, [BLUE]: false } });
    const { code, out, opened } = await judge(r);
    expect(code).toBe(0);
    expect(asked).toEqual([NAMED, BLUE]);
    expect(opened).toEqual([
      {
        args: ['api', 'repos/acme/widgets/issues', '--method', 'POST', '--input', '-'],
        input: { title: `Law: ${NAMED}`, body: expect.stringContaining('`BR-PRODUCT-1`') as unknown, labels: ['omni:law'] },
      },
    ]);
    const rules = r.read(`${K}/product/rules.md`);
    expect(rules).toContain('## BR-PRODUCT-1');
    expect(rules).toContain('Enforced by: pending #91');
    expect(rules).not.toContain('BR-PRODUCT-2');
    const ledger = Object.fromEntries(parseSettledEntries(r.read(LEDGER), markers).map((e) => [e.id, e]));
    expect(ledger['s1-02-blue']?.fields['Stays here']).toBe('not worth a law (classifier), was BR-PRODUCT-2');
    expect(r.read('.omni-loop/config.yml')).toBe('kit: 1\nrepo:\n  slug: acme/widgets\nlaws:\n  requireProof: true\n  source: knowledge\n');
    expect(out).toContain('omni knowledge judge — 2 unenforced law(s):');
    expect(out).toContain('BR-PRODUCT-1 → pending #91, worth a law (classifier)');
    expect(out).toContain(`opened law issue #91: Law: ${NAMED}`);
    expect(out).toContain(`BR-PRODUCT-2 → not worth a law (classifier), recorded in ${LEDGER}`);
    expect(out).toContain(`BR-PRODUCT-2 is still cited by N-PRODUCT-1 (${K}/product/invariants.md)`);
    expect(out).toContain('laws.requireProof: true, set in .omni-loop/config.yml');
    expect(out).toContain('Review the diff');
  });

  it('run twice, the second run asks nothing, opens no issue and changes nothing', async () => {
    const r = repo();
    stubs({ worth: { [NAMED]: true, [BLUE]: false } });
    await judge(r);
    execFileSync('git', ['add', '-A'], { cwd: r.root });
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'swept'], { cwd: r.root });
    const { asked } = stubs({ worth: {} });
    const { code, out, opened } = await judge(r);
    expect(code).toBe(0);
    expect(asked).toEqual([]);
    expect(opened).toEqual([]);
    expect(status(r.root)).toBe('');
    expect(out).toContain('omni knowledge judge — 0 unenforced law(s):');
    expect(out).toContain('laws.requireProof: true already');
    expect(out).toContain('Nothing changed.');
  });

  it("asks omni decide law-worth with the five fields, and Jev's answer counts over the classifier's", async () => {
    const r = repo({ ...FILES, '.omni-loop/config.yml': `${CONFIG}ask:\n  url: ${ASK_URL}\n` });
    mkdirSync(join(home, '.config', 'omni'), { recursive: true });
    writeFileSync(join(home, '.config', 'omni', 'credentials.json'), JSON.stringify({ 'omni.test': { access_token: 'a-1', refresh_token: 'r-1' } }));
    const { decides } = stubs({ worth: { [NAMED]: true, [BLUE]: true }, jev: { answer: 'false', confidence: 0.77, decidedBy: 'jev' } });
    const { code, out, opened } = await judge(r);
    expect(code).toBe(0);
    expect(decides[0]).toEqual({
      repo: 'acme/widgets',
      state: { statement: NAMED, why: null, principle: 'P-PRODUCT-1: Widgets are simple.', domain: 'product', prdTitle: 'Widgets' },
      old: 'true',
      ref: 'sweep BR-PRODUCT-1',
    });
    expect(opened).toEqual([]);
    expect(out).toContain('BR-PRODUCT-1 → not worth a law (Jev 0.77), recorded in no ledger: its source names no entry there');
  });

  it('leaves a law the model could not judge as it is, and requireProof unset', async () => {
    const r = repo();
    stubs({ worth: { [NAMED]: true }, failing: [BLUE] });
    const { code, out } = await judge(r);
    expect(code).toBe(0);
    const rules = r.read(`${K}/product/rules.md`);
    expect(rules).toContain(`${BLUE}\n\nServes: P-PRODUCT-1\nSource: ${LEDGER}, entry s1-02-blue, PRD #42\nEnforced by: unenforced`);
    expect(r.read('.omni-loop/config.yml')).toBe(CONFIG);
    expect(out).toContain('BR-PRODUCT-2 → not judged:');
    expect(out).toContain('laws.requireProof stays false: 1 law(s) not judged — run omni knowledge judge again');
  });

  it('exits 1 and writes nothing when laws.source is not knowledge', async () => {
    const r = repo({ ...FILES, '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' });
    const { asked } = stubs({ worth: {} });
    const { code, err, opened } = await judge(r);
    expect(code).toBe(1);
    expect(err).toContain('laws.source is none');
    expect(asked).toEqual([]);
    expect(opened).toEqual([]);
    expect(status(r.root)).toBe('');
  });

  it('exits 2 without OPENROUTER_API_KEY, asking nothing and writing nothing', async () => {
    const r = repo();
    const { asked } = stubs({ worth: {} });
    const { code, err } = await judge(r, { env: {} });
    expect(code).toBe(2);
    expect(err).toContain('OPENROUTER_API_KEY is not set');
    expect(asked).toEqual([]);
    expect(status(r.root)).toBe('');
  });
});

describe('omni knowledge <id>', () => {
  it('still prints one entry, and exits 2 on a usage error', async () => {
    const r = repo();
    const out: string[] = [];
    const io = { cwd: r.root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => true } };
    expect(await main(['knowledge', 'P-PRODUCT-1'], io)).toBe(0);
    expect(out.join('')).toContain('Widgets are simple.');
    expect(await main(['knowledge'], io)).toBe(2);
    expect(await main(['knowledge', 'judge', 'more'], io)).toBe(2);
  });
});

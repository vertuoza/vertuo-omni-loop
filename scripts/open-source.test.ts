// The open-source guard (PRD 2305, s1): no tracked file carries the maintainer's internal delivery (a
// repository other than this one, an address on its domain) or a secret. The rules are proven red and
// green on fixtures first, each offending string assembled at runtime so this file holds none, then
// the allowlist and the command itself, and last the guard on every file git tracks, with this
// repository's allowlist.
import { rmSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRepo } from '../kit/test/fixture.ts';
import { type AllowEntry, type SourceFile, formatFinding, judge, main, readAllowFile, trackedFiles } from './open-source.ts';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// The maintainer's names, assembled so that no line of this file is one.
const ORG = 'vert' + 'uoza';
const PREFIX = 'vert' + 'uo';
const DOMAIN = ORG + '.com';

/** The findings for one file holding `text`, as the guard prints them. */
function linesFor(text: string, path = 'kit/lib/a.ts', allow: readonly AllowEntry[] = []): string[] {
  return judge([{ path, text }], allow).findings.map(formatFinding);
}

const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt = (claims: Record<string, unknown>): string => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.${'s'.repeat(43)}`;

describe('the internal repository rule', () => {
  it("flags the maintainer's organisation followed by another repository, naming the file, the line and the fix", () => {
    expect(linesFor(`const ok = 1;\nconst repo = '${ORG}/back-office';\n`)).toEqual(['kit/lib/a.ts:2: internal repository — use demo-org/<name>']);
    expect(linesFor(`see https://github.com/${ORG}/back-office/pull/7\n`)).toHaveLength(1);
    expect(linesFor(`"name": "@${ORG}/ui"\n`)).toHaveLength(1);
    expect(linesFor(`${ORG.toUpperCase()}/Back-Office\n`)).toHaveLength(1);
  });

  it('flags a name with the shared prefix, other than this repository’s own', () => {
    expect(linesFor(`cd ../${PREFIX}-brain\n`)).toEqual(['kit/lib/a.ts:1: internal repository — use nimbus-<rest of the name>']);
    expect(linesFor(`import { x } from '${PREFIX}-omni-plan/kit/lib/x.ts';\n`)).toHaveLength(1);
    expect(linesFor(`${PREFIX}-omni-loop-staging\n`)).toHaveLength(1);
  });

  it('passes the fictional names the cleanup writes', () => {
    expect(linesFor("const repo = 'demo-org/nimbus-brain';\ncd ../nimbus-plan\n")).toEqual([]);
  });

  it("passes this repository's own names and its Vercel host", () => {
    const own = [
      'vertuoza/vertuo-omni-loop',
      'https://github.com/vertuoza/vertuo-omni-loop.git',
      'https://github.com/vertuoza/vertuo-omni-loop/pull/2305.',
      'cd vertuo-omni-loop && pnpm test',
      'https://vertuo-omni-loop-galaxy.vercel.app/docs',
      'feat/vertuo-omni-loop--s1',
    ];
    expect(linesFor(own.join('\n'))).toEqual([]);
  });

  it('reads no name inside a longer word', () => {
    expect(linesFor(`x${PREFIX}-brain and a${ORG}/back-office\n`)).toEqual([]);
  });
});

describe('the real email rule', () => {
  it("flags an address on the maintainer's domain, a subdomain's too", () => {
    expect(linesFor(`author: jane.doe@${DOMAIN}\n`)).toEqual(['kit/lib/a.ts:1: real email — use <name>@example.com']);
    expect(linesFor(`<jane@mail.${DOMAIN}>\n`)).toHaveLength(1);
  });

  it('passes example.com, and the domain written without an address', () => {
    expect(linesFor(`author: jane.doe@example.com\nhttps://www.${DOMAIN}/about\n`)).toEqual([]);
  });
});

describe('the secret rule', () => {
  // Each one red, then the fake written as the guard asks (or not at all) green.
  const RED: ReadonlyArray<[string, string]> = [
    ['GitHub token', 'gh' + 'p_' + 'a'.repeat(36)],
    ['GitHub token', 'gh' + 's_' + 'b'.repeat(36)],
    ['GitHub token', 'github' + '_pat_' + '11ABCDEFG0123456789_' + 'x'.repeat(30)],
    ['API key', 'sk-' + 'ant-api03-' + 'c'.repeat(32)],
    ['API key', 'sk-' + 'proj-' + 'd'.repeat(32)],
    ['private key', ['-----BEGIN', 'RSA', 'PRIVATE', 'KEY-----'].join(' ') + '\nMIIEabc\n'],
    ['private key', ['-----BEGIN', 'PRIVATE', 'KEY-----'].join(' ') + '\\nabc\\n'],
    ['Supabase secret key', 'sb_' + 'secret_' + 'e'.repeat(32)],
    ['AWS access key', 'AK' + 'IA' + 'Q'.repeat(16)],
    ['JWT', jwt({ sub: 'user-42', role: 'service_role' })],
    ['Postgres URL', 'postgres' + 'ql://app:' + 'Tr0ub4dor' + '@db.example.com:5432/app'],
  ];

  it.each(RED)('flags a %s', (kind, value) => {
    expect(linesFor(`const ok = 1;\nconst value = \`${value}\`;\n`)).toEqual([
      `kit/lib/a.ts:2: secret (${kind}) — build the fake at runtime, or list it in scripts/open-source.allow.json with its reason; a real one is rotated`,
    ]);
  });

  it('never prints the value it found', () => {
    const printed = RED.flatMap(([, value]) => linesFor(`x = \`${value}\`\n`)).join('\n');
    for (const [, value] of RED) expect(printed).not.toContain(value.split('\n')[0]);
  });

  it('passes the jwt.io sample, whatever its claims beside the subject', () => {
    expect(linesFor(jwt({ sub: '1234567890', name: 'John Doe', iat: 1516239022 }))).toEqual([]);
    expect(linesFor(jwt({ sub: '1234567890' }))).toEqual([]);
  });

  it("passes the local stack's Postgres URL and a placeholder password", () => {
    expect(linesFor('postgresql://postgres:postgres@127.0.0.1:54322/postgres\n')).toEqual([]);
    expect(linesFor('postgres://user:<password>@db.example.com/app\npostgres://user:${PGPASSWORD}@host/app\n')).toEqual([]);
  });

  it('passes a bare prefix, a regular expression and a shape assembled at runtime', () => {
    expect(linesFor('A GitHub token starts with `ghp_`, an Anthropic key with `sk-ant-`.\n')).toEqual([]);
    expect(linesFor('/\\bgh[pousr]_[A-Za-z0-9]{16,}/g\n/\\bAKIA[0-9A-Z]{16}\\b/g\n')).toEqual([]);
    expect(linesFor("const token = 'ghp_' + 'a'.repeat(36);\n")).toEqual([]);
  });

  it('reads no key inside a longer word: an outbox slug ending in -ask-…', () => {
    expect(linesFor('s1-01-ask-mode-crew-is-any-workspace-of-the-team\n')).toEqual([]);
  });
});

describe('the allowlist', () => {
  const fake = 'sk-' + 'fake-' + '0123456789abcdefghij';
  const entry: AllowEntry = { file: 'kit/lib/a.test.ts', pattern: '^sk-fake-', reason: 'a visible fake, named fake' };

  it("lets an entry's value through in its own file only", () => {
    expect(linesFor(`k = '${fake}'\n`, 'kit/lib/a.test.ts', [entry])).toEqual([]);
    expect(linesFor(`k = '${fake}'\n`, 'kit/lib/b.test.ts', [entry])).toHaveLength(1);
    expect(linesFor(`k = '${'sk-' + 'live-' + 'z'.repeat(24)}'\n`, 'kit/lib/a.test.ts', [entry])).toHaveLength(1);
  });

  it('requires each entry’s reason, and a pattern that is a regular expression', () => {
    const files: SourceFile[] = [{ path: 'kit/lib/a.test.ts', text: `k = '${fake}'\n` }];
    const noReason = judge(files, [{ ...entry, reason: '  ' }]);
    expect(noReason.problems).toEqual(['scripts/open-source.allow.json: entry 1 (kit/lib/a.test.ts) needs its reason']);
    expect(noReason.findings).toHaveLength(1);
    expect(judge(files, [{ ...entry, pattern: '(' }]).problems).toEqual([
      'scripts/open-source.allow.json: entry 1 (kit/lib/a.test.ts) has a pattern that is no regular expression',
    ]);
    expect(judge(files, [{ ...entry, file: '' }]).problems).toEqual(['scripts/open-source.allow.json: entry 1 needs a file and a pattern']);
  });

  it('never lets an internal name through: it holds secrets only', () => {
    const allow: AllowEntry = { file: 'kit/lib/a.ts', pattern: '.*', reason: 'everything' };
    expect(linesFor(`${ORG}/back-office\n`, 'kit/lib/a.ts', [allow])).toHaveLength(1);
  });
});

describe('the command', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function run(files: Record<string, string>) {
    const { root } = makeRepo({ files, git: true });
    dirs.push(root);
    const out: string[] = [];
    const err: string[] = [];
    const code = main(realpathSync(root), (line) => out.push(line), (line) => err.push(line));
    return { code, out, err };
  }

  it('exits 1 on a finding, printing the file, the line and the rule, then a summary', () => {
    const { code, out, err } = run({ 'kit/lib/a.ts': `export const a = '${ORG}/back-office';\n`, 'README.md': '# r\n' });
    expect(code).toBe(1);
    expect(out).toEqual([]);
    expect(err).toEqual(['kit/lib/a.ts:1: internal repository — use demo-org/<name>', 'open-source: red: 1 finding(s), 0 baseline or allowlist problem(s)']);
  });

  it('exits 0 on a clean repository, printing one line', () => {
    const { code, out, err } = run({ 'kit/lib/a.ts': 'export const a = 1;\n' });
    expect(code).toBe(0);
    expect(err).toEqual([]);
    expect(out).toEqual(['open-source: green: 1 files read, 0 still in the baseline']);
  });

  it('reads the allowlist from the repository it judges', () => {
    const files = {
      'kit/lib/a.ts': 'export const a = 1;\n',
      'kit/lib/b.test.ts': `const k = '${'sk-' + 'fake-' + '0123456789abcdefghij'}';\n`,
      'scripts/open-source.allow.json': JSON.stringify({ allow: [{ file: 'kit/lib/b.test.ts', pattern: '^sk-fake-', reason: 'a fake' }] }),
    };
    expect(run(files).code).toBe(0);
  });

  it('skips the built bundles and the lockfile', () => {
    const text = `const repo = '${ORG}/back-office';\n`;
    expect(run({ 'kit/dist/omni.mjs': text, 'apps/omni-app/api/outbox.mjs': text, 'pnpm-lock.yaml': text }).code).toBe(0);
  });
});

describe('this repository', () => {
  it('the guard and its test pass their own rules', () => {
    const files = ['scripts/open-source.ts', 'scripts/open-source.test.ts'].map((path) => trackedFiles(repoRoot).find((file) => file.path === path) ?? { path, text: '' });
    expect(files.every((file) => file.text.length > 0)).toBe(true);
    expect(judge(files, [])).toEqual({ findings: [], problems: [] });
  });

  it('every tracked file passes, with its allowlist', () => {
    const { findings, problems } = judge(trackedFiles(repoRoot), readAllowFile(repoRoot));
    expect([...findings.map(formatFinding), ...problems], 'run node scripts/open-source.ts, and fix what it names').toEqual([]);
  });
});

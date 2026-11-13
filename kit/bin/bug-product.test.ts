// `omni bug check --product <key> <file>` and `omni bug push --product <key> (--new | --bug <n>) <file>`
// (PRD 2011, s6), through `main()` with a fetch that answers as `POST /api/fixes` does: a check answers the
// product's repositories, a push the bug's id.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../lib/ask/schema.ts';
import { makeRepo } from '../test/fixture.ts';
import type { FetchInit } from '../test/fixture.ts';
import { main } from './omni.ts';

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const CONFIG = { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${BASE}\n` };

const tokens = () => {
  const store: Record<string, Tokens> = { [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } };
  return { store, read: (host: string) => store[host] ?? null, write: (host: string, next: Tokens) => { store[host] = next; } };
};

type Call = { url: string; body: Record<string, unknown> };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function app() {
  const calls: Call[] = [];
  const fetch = (url: string, init: FetchInit) => {
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    calls.push({ url, body });
    return Promise.resolve(body.check === true
      ? json(200, { checked: true, product: { key: 'mobile', name: 'Mobile' }, repositories: [{ repository: 'acme/app', readOnly: false }, { repository: 'acme/api', readOnly: false }] })
      : json(201, {
        dossierId: 'd1', bug: 'mobile-B74', created: true, product: { id: 'p', name: 'Mobile' },
        rows: [{ position: 1, repository: 'acme/api', pull: 41, state: 'open' }], added: [{ kind: 'bug-record', version: 1 }], unchanged: [],
      }));
  };
  return { calls, fetch };
}

const record = (repository: string) => [
  '# Sign-in loops', '', '## Fixes', '', '| order | repository | pull request | what changes |', '| --- | --- | --- | --- |',
  `| 1 | ${repository} | #41 | the token is read once |`, '', '## Reproduction', '', `- **${repository}:** api.test.ts — red`, '', '## Guard', '', `- **${repository}:** api.test.ts`, '',
].join('\n');

async function omni(argv: string[], root: string, fetch: unknown, exec?: unknown) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, env: {}, tokens: tokens(), fetch, ...(exec === undefined ? {} : { exec }), stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

function repoWith(text: string) {
  const { root } = makeRepo({ git: true, files: CONFIG });
  writeFileSync(join(root, 'bug.md'), text);
  return root;
}

describe('omni bug check --product', () => {
  it('grades the rows against the product\'s repositories', async () => {
    const { calls, fetch } = app();
    const { code, out } = await omni(['bug', 'check', '--product', 'mobile', 'bug.md'], repoWith(record('acme/api')), fetch);
    expect(code).toBe(0);
    expect(out).toContain('1 Fixes row(s), each in a repository of product mobile.');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: `${BASE}/api/fixes`, body: { productKey: 'mobile', check: true, repo: 'acme/widgets' } });
  });

  it('names a row outside the product', async () => {
    const { code, out } = await omni(['bug', 'check', '--product', 'mobile', 'bug.md'], repoWith(record('acme/shop')), app().fetch);
    expect(code).toBe(1);
    expect(out).toContain('bug.md: Fixes row 1: acme/shop is not a repository of product mobile (acme/app, acme/api).');
  });
});

describe('omni bug check --product, ## Still open (PRD 2739)', () => {
  const POINT = 'The export job retries a 4xx forever.';
  const withPoint = () => `${record('acme/api')}\n## Still open\n\n- ${POINT}\n`;
  const FILE = '.omni-loop/delivery/follow-ups/2026-11-12-the-export-job-retries-a-4xx.md';
  const file = (source: string) => `---\nsource: ${source}\ndate: 2026-11-12\n---\n\n${POINT}\n`;

  it('refuses a point with no follow-up file of source <key>-B<n>, naming it', async () => {
    const { code, out } = await omni(['bug', 'check', '--product', 'mobile', '--bug', '74', 'bug.md'], repoWith(withPoint()), app().fetch);
    expect(code).toBe(1);
    expect(out).toContain(`bug.md: "${POINT}" is still open but has no follow-up: omni follow-up add --source 'mobile-B74' --text '${POINT}'`);
  });

  it('passes once the file exists', async () => {
    const root = repoWith(withPoint());
    mkdirSync(join(root, '.omni-loop/delivery/follow-ups'), { recursive: true });
    writeFileSync(join(root, FILE), file('mobile-B74'));
    const { code } = await omni(['bug', 'check', '--product', 'mobile', '--bug', 'mobile-B74', 'bug.md'], root, app().fetch);
    expect(code).toBe(0);
  });

  it('skips the check with --new and says so in one line', async () => {
    const { code, out } = await omni(['bug', 'check', '--product', 'mobile', '--new', 'bug.md'], repoWith(withPoint()), app().fetch);
    expect(code).toBe(0);
    expect(out).toContain('--new, the Still open points are not checked');
  });

  it('does not judge points when no bug is named', async () => {
    const { code, out } = await omni(['bug', 'check', '--product', 'mobile', 'bug.md'], repoWith(withPoint()), app().fetch);
    expect(code).toBe(1);
    expect(out).toContain('need --bug <n>');
  });

  it('passes a record with no Still open section', async () => {
    const { code } = await omni(['bug', 'check', '--product', 'mobile', '--bug', '74', 'bug.md'], repoWith(record('acme/api')), app().fetch);
    expect(code).toBe(0);
  });
});

describe('omni bug check --product --body-file (PRD 2578)', () => {
  const GIF = 'https://omni.example/api/proofs/9f0c1d2e-0000-4000-8000-000000000001/preview.gif';
  const withProof = (lines: string[]) => ['Fixes mobile-B74', '', '## Proof', '', `![Before and after the fix](${GIF})`, '', ...lines, ''].join('\n');
  const PASSING = [
    '- **Before the fix** (red): `boom`',
    '- **After the fix** (green, `a1b2c3d`): `ok`',
    '- **Proved on:** CI · reproduction test only, the screen was not filmed',
  ];

  function repoWithBody(body: string) {
    const root = repoWith(record('acme/api'));
    writeFileSync(join(root, 'body.md'), body);
    return root;
  }

  const HEAD = 'a1b2c3d'.padEnd(40, '0');
  const PR = ['--pr', 'acme/api#41'];
  const BODY = ['bug', 'check', '--product', 'mobile', 'bug.md', '--body-file', 'body.md'];
  /** A `gh pr view <n> --repo <slug>` that answers the head `HEAD`, or fails as told; `calls` are the argument lists it was given. */
  function gh(answer: Error | string = JSON.stringify({ headRefOid: HEAD, commits: [{ oid: HEAD }] })) {
    const calls: string[][] = [];
    const exec = (file: string, args: readonly string[], options?: unknown) => {
      if (file !== 'gh') return execFileSync(file, args, options as never);
      calls.push([file, ...args]);
      if (answer instanceof Error) throw answer;
      return answer;
    };
    return { calls, exec };
  }

  it('grades the proof of the fix pull request beside the rows, and passes a body that cites its head (PRD 2741)', async () => {
    const fake = gh();
    const { code, out } = await omni([...BODY, ...PR], repoWithBody(withProof(PASSING)), app().fetch, fake.exec);
    expect(code).toBe(0);
    expect(out).toContain('1 Fixes row(s)');
    expect(fake.calls).toEqual([['gh', 'pr', 'view', '41', '--repo', 'acme/api', '--json', 'headRefOid,commits']]);
  });

  it('refuses a proof citing a commit that is not the head of the pull request --pr names', async () => {
    const other = 'e'.repeat(40);
    const fake = gh(JSON.stringify({ headRefOid: other, commits: [{ oid: HEAD }, { oid: other }] }));
    const { code, out } = await omni([...BODY, ...PR], repoWithBody(withProof(PASSING)), app().fetch, fake.exec);
    expect(code).toBe(1);
    expect(out).toContain("the proof cites green at a1b2c3d, but acme/api#41's head is eeeeeee (1 commits later): run the reproduction again at the head and add a Re-proved line");
  });

  it('is one fault, not a pass, when gh cannot read the head', async () => {
    const { code, out } = await omni([...BODY, ...PR], repoWithBody(withProof(PASSING)), app().fetch, gh(new Error('no sign-in')).exec);
    expect(code).toBe(1);
    expect(out).toContain('not judged: could not read the head of acme/api#41: no sign-in');
  });

  it('is a usage error, exit 2, for --body-file without --pr', async () => {
    const fake = gh();
    const { code, err, out } = await omni(BODY, repoWithBody(withProof(PASSING)), app().fetch, fake.exec);
    expect(code).toBe(2);
    expect(err).toContain('omni bug check: --body-file needs --pr <owner/repo>#<n>, the fix pull request it belongs to');
    expect(out).toBe('');
    expect(fake.calls).toEqual([]);
  });

  it('is a usage error for a --pr that is no pull request, or one given with no body', async () => {
    const root = repoWithBody(withProof(PASSING));
    const bad = await omni([...BODY, '--pr', 'api#41'], root, app().fetch);
    expect(bad.code).toBe(2);
    expect(bad.err).toContain('--pr "api#41" is not a pull request');
    const alone = await omni(['bug', 'check', '--product', 'mobile', 'bug.md', ...PR], root, app().fetch);
    expect(alone.code).toBe(2);
    expect(alone.err).toContain('--pr is for a --body-file');
  });

  it('refuses a body without its proof', async () => {
    const { code, out } = await omni([...BODY, ...PR], repoWithBody('Fixes mobile-B74\n'), app().fetch, gh().exec);
    expect(code).toBe(1);
    expect(out).toContain('bug.md: no ## Proof section');
  });

  it('refuses a GIF without its Proved on line', async () => {
    const { code, out } = await omni([...BODY, ...PR], repoWithBody(withProof(PASSING.slice(0, 2))), app().fetch, gh().exec);
    expect(code).toBe(1);
    expect(out).toContain('## Proof has no "Proved on" line');
  });

  it('is a usage error for a body file that cannot be read, and runs as before without the flag', async () => {
    const root = repoWith(record('acme/api'));
    const missing = await omni(['bug', 'check', '--product', 'mobile', 'bug.md', '--body-file', 'nope.md', ...PR], root, app().fetch, gh().exec);
    expect(missing.code).toBe(2);
    expect((await omni(['bug', 'check', '--product', 'mobile', 'bug.md'], root, app().fetch)).code).toBe(0);
  });

  it('is for check: push refuses it', async () => {
    const { code, err } = await omni(['bug', 'push', '--product', 'mobile', '--new', 'bug.md', '--body-file', 'body.md'], repoWithBody(''), app().fetch);
    expect(code).toBe(2);
    expect(err).toContain('--body-file is for check');
  });
});

describe('omni bug push --product', () => {
  it('creates the next bug and prints its id first', async () => {
    const { calls, fetch } = app();
    const { code, out } = await omni(['bug', 'push', '--product', 'mobile', '--new', 'bug.md'], repoWith(record('acme/api')), fetch);
    expect(code).toBe(0);
    expect(out.split('\n')[0]).toBe('mobile-B74');
    expect(out).toContain(`created · 1 row(s) · added bug-record v1 — ${BASE}/bugs/d1`);
    expect(calls.map((c) => c.body.check === true)).toEqual([true, false]);
    expect(calls[1]?.body).toMatchObject({ productKey: 'mobile', new: true, title: 'Sign-in loops', rows: [{ repo: 'acme/api', pull: 41 }] });
  });

  it('writes nothing, and says so, when a row is outside the product', async () => {
    const { calls, fetch } = app();
    const { code, err } = await omni(['bug', 'push', '--product', 'mobile', '--new', 'bug.md'], repoWith(record('acme/shop')), fetch);
    expect(code).toBe(1);
    expect(err).toContain('nothing was sent');
    expect(err).toContain('acme/shop is not a repository of product mobile');
    expect(calls.every((c) => c.body.check === true)).toBe(true);
  });

  it('pushes to a bug of the product by --bug mobile-B74, and refuses another product\'s', async () => {
    const root = repoWith(record('acme/api'));
    const { calls, fetch } = app();
    expect((await omni(['bug', 'push', '--product', 'mobile', '--bug', 'mobile-B74', 'bug.md'], root, fetch)).code).toBe(0);
    expect(calls[1]?.body).toMatchObject({ bug: 74 });
    expect((await omni(['bug', 'push', '--product', 'mobile', '--bug', 'web-B74', 'bug.md'], root, fetch)).code).toBe(2);
  });

  it('wants --new or --bug', async () => {
    expect((await omni(['bug', 'push', '--product', 'mobile', 'bug.md'], repoWith(record('acme/api')), app().fetch)).code).toBe(2);
  });
});

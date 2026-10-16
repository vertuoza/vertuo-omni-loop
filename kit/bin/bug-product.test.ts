// `omni bug check --product <key> <file>` and `omni bug push --product <key> (--new | --bug <n>) <file>`
// (PRD 2011, s6), through `main()` with a fetch that answers as `POST /api/fixes` does: a check answers the
// product's repositories, a push the bug's id.
import { writeFileSync } from 'node:fs';
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

async function omni(argv: string[], root: string, fetch: unknown) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, env: {}, tokens: tokens(), fetch, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
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

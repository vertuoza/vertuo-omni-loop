// Every outbox verb on a product PRD (PRD 1548 s7), through `main()` on a fixture repository, against a
// fake of the Omni page's outbox routes (`kit/test/fake-outbox-routes.ts`): `omni item new`, `item relay`,
// `adopt`, `settle`, `status <prd>` and `answers` on `mobile-12` write and read its rows on the Omni page,
// never a file; a malformed item is refused with the words `omni check outbox` gives it, and nothing is
// sent; and with the server down each holds, exit 1. The sign-in is an in-memory token store.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from '../../bin/omni.ts';
import { fakeOutboxRoutes } from '../../test/fake-outbox-routes.ts';
import { makeRepo } from '../../test/fixture.ts';
import { parseOutboxItemId, parseProductPrdId, parseWorkSliceId } from '../ids.ts';
import { lawsFor } from '../laws.ts';
import { renderOutboxItem } from '../policy/outbox-policy.ts';
import { checkItemText } from './check-outbox.ts';

const BASE = 'https://omni.example';
const CONFIG = `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${BASE}\ndossier:\n  enabled: true\n`;
const HELD = /^omni [a-z ]+: held · server unreachable since \d{4}-\d{2}-\d{2}T[\d:.]+Z · held, not failed\n$/;

const FIELDS = {
  slug: 'default-timeout',
  wave: 4,
  raised: '2026-10-11',
  questionPlain: 'How long should we wait before giving up on a slow call?',
  decisionPlain: 'We wait five seconds, which is generous without being unbounded.',
  decide: 'How long a slow call gets before it is treated as stuck.',
  meanwhile: 'Five seconds, a constant with no migration to undo it.',
  cost: 'One constant.',
  gaps: ['whether five seconds is measured against a real incident'],
  options: ['Wait five seconds, the option built.', 'Wait one second, so a stuck call is caught sooner.'],
};

const memoryTokens = (signedIn: boolean) => {
  const store: Record<string, unknown> = signedIn ? { 'omni.example': { access_token: 'access-1', refresh_token: 'refresh-1' } } : {};
  return { read: (host: string) => (store[host] ?? null) as never, write: (host: string, tokens: unknown) => { store[host] = tokens; } };
};

/** A kitted repository signed in to a fake Omni page holding product PRD mobile-12. */
function world({ config = CONFIG, signedIn = true }: { config?: string; signedIn?: boolean } = {}) {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
  const routes = fakeOutboxRoutes();
  const tokens = memoryTokens(signedIn);
  const run = async (args: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(args, {
      cwd: repo.root, env: {}, tokens, fetch: routes.fetch, now: () => Date.parse('2026-10-11T12:00:00Z'),
      stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) },
    });
    return { code, out: out.join(''), err: err.join('') };
  };
  const json = (fields: Record<string, unknown>) => {
    const path = join(mkdtempSync(join(tmpdir(), 'server-verbs-')), 'item.json');
    writeFileSync(path, JSON.stringify(fields));
    return path;
  };
  const raise = (fields: Record<string, unknown> = FIELDS) => run(['item', 'new', '--prd', 'mobile-12', '--slice', 's7', '--file', json(fields), '--json']);
  return { repo, routes, run, raise, json };
}

const HIGH = { ...FIELDS, hardToRevert: true };

describe('omni item new --prd mobile-12', () => {
  it('refuses a malformed item with the words "omni check outbox" gives it, and sends nothing', async () => {
    const { repo, routes, run, json } = world();
    const fields = { ...FIELDS, options: ['Wait five seconds, using `defaultTimeoutMs`, the option built.', FIELDS.options[1]] };
    const result = await run(['item', 'new', '--prd', 'mobile-12', '--slice', 's7', '--file', json(fields)]);
    const laws = lawsFor(repo.ctx);
    const text = renderOutboxItem({
      ...fields, id: parseOutboxItemId('s7-01-default-timeout'), prd: parseProductPrdId('mobile-12'), slice: parseWorkSliceId('s7'),
      bearsOn: 'none', rank: 'medium', introFun: null, punchlineFun: null, personSteps: null, laws,
    });
    const violations = checkItemText('mobile-12/s7-01-default-timeout', text, { laws });
    expect(violations).not.toEqual([]);
    expect(result.code).toBe(2);
    expect(result.err).toBe(['omni item new: the rendered item fails "check outbox" — nothing was written:', ...violations.map((line) => `  - ${line}`), ''].join('\n'));
    expect(routes.calls.filter((call) => call.method === 'POST')).toEqual([]);
    expect(routes.rows('mobile-12')).toEqual([]);
  });

  it('makes a good item a row, writes no file, and omni status mobile-12 counts it open', async () => {
    const { repo, routes, run, raise } = world();
    const raised = await raise(HIGH);
    expect(raised.code).toBe(0);
    expect(JSON.parse(raised.out)).toEqual({ outcome: 'record', rank: 'high', id: 's7-01-default-timeout', file: 'mobile-12/s7-01-default-timeout', adopted: false, reason: null });
    expect(routes.rows('mobile-12').map((row) => [row.item, row.rank, row.settlement])).toEqual([['s7-01-default-timeout', 'high', null]]);
    expect(routes.calls.find((call) => call.method === 'POST')?.body).toMatchObject({ product: 'mobile', prd: 12, repo: 'acme/widgets' });
    expect(existsSync(join(repo.root, '.omni-loop/delivery'))).toBe(false);
    const status = await run(['status', 'mobile-12']);
    expect(status.code).toBe(1);
    expect(status.out).toContain('outbox-status — PRD mobile-12: 1 open item(s):');
    expect(status.out).toContain('mobile-12/s7-01-default-timeout');
  });

  it('counts the next item of the slice after the rows the PRD already spent', async () => {
    const { raise } = world();
    await raise(HIGH);
    expect((JSON.parse((await raise(HIGH)).out) as { id: string }).id).toBe('s7-02-default-timeout');
  });

  it('adopts a medium item at once with --adopt: a settled row, and the gate stays green', async () => {
    const { routes, run, json } = world();
    const result = await run(['item', 'new', '--prd', 'mobile-12', '--slice', 's7', '--file', json(FIELDS), '--adopt']);
    expect(result).toMatchObject({ code: 0, err: '' });
    expect(result.out).toBe('omni item new — s7-01-default-timeout adopted straight to PRD mobile-12\'s ledger on the Omni page; no open item file was written.\n');
    expect(routes.rows('mobile-12')[0]?.settlement?.verdict).toBe('adopted');
    expect(await run(['status', 'mobile-12'])).toMatchObject({ code: 0, out: 'outbox-status — PRD mobile-12: no open item.\n' });
  });

  it('refuses a PRD the Omni page does not hold, exit 1, in its words', async () => {
    const { run, json } = world();
    const result = await run(['item', 'new', '--prd', 'mobile-13', '--slice', 's7', '--file', json(FIELDS)]);
    expect(result).toMatchObject({ code: 1, err: 'omni item new: No PRD mobile-13 in your workspaces.\n' });
  });
});

describe('omni adopt, settle, item relay and answers on mobile-12', () => {
  it('adopts an open medium item by its id', async () => {
    const { routes, run, raise } = world();
    await raise();
    const result = await run(['adopt', 's7-01-default-timeout', '--prd', 'mobile-12']);
    expect(result).toMatchObject({ code: 0, out: 'omni adopt — s7-01-default-timeout adopted on PRD mobile-12\'s ledger on the Omni page.\n', err: '' });
    expect(routes.rows('mobile-12')[0]?.settlement).toMatchObject({ verdict: 'adopted' });
  });

  it('refuses to adopt an item it cannot read, naming it', async () => {
    const { run } = world();
    expect(await run(['adopt', 's7-09-missing', '--prd', 'mobile-12'])).toMatchObject({ code: 2, err: 'omni adopt: cannot read mobile-12/s7-09-missing (ENOENT).\n' });
  });

  it('settles an open item with an answer given in the terminal', async () => {
    const { routes, run, raise } = world();
    await raise(HIGH);
    const result = await run(['settle', 's7-01-default-timeout', '--prd', 'mobile-12', '--answer', 'Yes, five seconds is right.']);
    expect(result).toMatchObject({ code: 0, err: '' });
    expect(result.out).toBe('omni settle — mobile-12/s7-01-default-timeout settled as "agreed" (affirmation); recorded on PRD mobile-12\'s ledger on the Omni page.\n');
    expect(routes.rows('mobile-12')[0]?.settlement).toMatchObject({ verdict: 'agreed', basis: 'affirmation', answer: 'Yes, five seconds is right.' });
    const again = await run(['settle', 's7-01-default-timeout', '--prd', 'mobile-12', '--answer', 'Yes.']);
    expect(again).toMatchObject({ code: 1, err: 'omni settle — nothing was written:\n  - mobile-12/s7-01-default-timeout: no such open item.\n' });
  });

  it('relays a folder of items into rows, leaving each moved file gone', async () => {
    const { repo, routes, run, json } = world();
    const out = join(repo.root, 'scratch');
    mkdirSync(out);
    expect((await run(['item', 'new', '--prd', 'mobile-12', '--slice', 's7', '--file', json(HIGH), '--out', out])).code).toBe(0);
    expect(routes.rows('mobile-12')).toEqual([]);
    const result = await run(['item', 'relay', out, '--prd', 'mobile-12']);
    expect(result).toMatchObject({ code: 0, out: `moved ${join(out, 's7-01-default-timeout.md')} → mobile-12/s7-01-default-timeout\n`, err: '' });
    expect(readdirSync(out)).toEqual([]);
    expect(routes.rows('mobile-12').map((row) => row.item)).toEqual(['s7-01-default-timeout']);
  });

  it('refuses a relayed account, which the Omni page keeps nowhere yet, and leaves it in place', async () => {
    const { repo, run } = world();
    const out = join(repo.root, 'scratch');
    mkdirSync(join(out, 'accounts'), { recursive: true });
    writeFileSync(join(out, 'accounts', 's7.md'), '---\nprd: mobile-12\n---\n');
    const result = await run(['item', 'relay', out, '--prd', 'mobile-12']);
    expect(result.code).toBe(2);
    expect(result.err).toBe(`refused ${join(out, 'accounts', 's7.md')} — PRD mobile-12's outbox is on the Omni page, which keeps no account yet: it stays here\n`);
    expect(existsSync(join(out, 'accounts', 's7.md'))).toBe(true);
  });

  it('asks the open questions worst first, and settles the picks posted', async () => {
    const { routes, run, raise, json } = world();
    await raise(HIGH);
    const ask = await run(['answers', 'ask', 'mobile-12']);
    expect(ask.code).toBe(0);
    expect(ask.out).toContain('Q1 · high (s7-01-default-timeout)');
    const picks = json([{ number: 1, pick: 'B', reason: 'a stuck call should be caught sooner' }] as unknown as Record<string, unknown>);
    const post = await run(['answers', 'post', '--prd', 'mobile-12', '--answers', picks]);
    expect(post).toMatchObject({ code: 0, out: '1: s7-01-default-timeout settled as "drifted"\n', err: '' });
    expect(routes.rows('mobile-12')[0]?.settlement).toMatchObject({ verdict: 'drifted', answer: 'B. Wait one second, so a stuck call is caught sooner. — because a stuck call should be caught sooner' });
    expect(await run(['answers', 'ask', 'mobile-12'])).toMatchObject({ code: 1, err: 'omni answers: nothing to ask on PRD mobile-12 — no open human-action or high question.\n' });
  });

  it('settles option A as agreed even when its reason reads like a change', async () => {
    const { routes, run, raise, json } = world();
    await raise(HIGH);
    const picks = json([{ number: 1, pick: 'A', reason: 'no, changing it is not worth it' }] as unknown as Record<string, unknown>);
    expect(await run(['answers', 'post', '--prd', 'mobile-12', '--answers', picks])).toMatchObject({ code: 0, out: '1: s7-01-default-timeout settled as "agreed"\n' });
    expect(routes.rows('mobile-12')[0]?.settlement).toMatchObject({ verdict: 'agreed', basis: 'stated' });
  });

  it('refuses picks that name no open question, settling nothing', async () => {
    const { routes, run, raise, json } = world();
    await raise(HIGH);
    const picks = json([{ number: 2, pick: 'A' }] as unknown as Record<string, unknown>);
    const post = await run(['answers', 'post', '--prd', 'mobile-12', '--answers', picks]);
    expect(post).toMatchObject({ code: 1, err: 'omni answers: refused — question 2 is not open on this pull request\n' });
    expect(routes.rows('mobile-12')[0]?.settlement).toBeNull();
  });
});

describe('with the server down, every verb on mobile-12 holds', () => {
  it.each([
    ['item new', (json: (f: Record<string, unknown>) => string) => ['item', 'new', '--prd', 'mobile-12', '--slice', 's7', '--file', json(FIELDS)]],
    ['item relay', () => ['item', 'relay', '.', '--prd', 'mobile-12']],
    ['adopt', () => ['adopt', 's7-01-default-timeout', '--prd', 'mobile-12']],
    ['settle', () => ['settle', 's7-01-default-timeout', '--prd', 'mobile-12', '--answer', 'Yes.']],
    ['status', () => ['status', 'mobile-12']],
    ['answers ask', () => ['answers', 'ask', 'mobile-12']],
  ])('%s exits 1 with the held line', async (_verb, args) => {
    const { routes, run, json } = world();
    routes.setDown(true);
    const result = await run(args(json));
    expect(result.code).toBe(1);
    expect(result.err).toMatch(HELD);
    expect(result.err).toContain('since 2026-10-11T12:00:00.000Z');
  });
});

describe('a product PRD\'s outbox needs the Omni page', () => {
  it('says to sign in first when nobody is signed in', async () => {
    const { run } = world({ signedIn: false });
    expect(await run(['status', 'mobile-12'])).toMatchObject({ code: 1, err: 'omni status: a product PRD\'s outbox lives on the Omni page: sign in first (omni signin)\n' });
  });

  it('says dossiers are off when they are', async () => {
    const { run } = world({ config: 'kit: 1\nrepo:\n  slug: acme/widgets\n' });
    expect(await run(['status', 'mobile-12'])).toMatchObject({ code: 1, err: 'omni status: a product PRD\'s outbox lives on the Omni page, and dossiers are off here (dossier.enabled is false)\n' });
  });
});

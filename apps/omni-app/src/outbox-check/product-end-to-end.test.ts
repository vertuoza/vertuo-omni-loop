// The outbox check of a product PRD's target feature PR (PRD 1548 s8, acceptance 7), from a signed
// webhook to a completed check against a stubbed GitHub, the PRD's outbox rows read through a stubbed
// reader: one gate on the product, never a plan PR. No test calls GitHub or Supabase.
import { createHmac } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { parsePr } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { type AppEvent, inngest } from '../inngest-client.ts';
import { receiveWebhook } from '../webhook/webhook.ts';
import type { ProductPrdRef } from '../approved-check/state.ts';
import { checkRunAt, fakeGitHub, outputOf } from './fake-github.ts';
import { createFailureHandler, createOutboxCheck } from './outbox-check.ts';
import type { ProductOutbox, ProductOutboxReader } from './product-outbox.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name: string) => join(FIXTURES, name);
const SECRET = 'e2e-secret';
const GALAXY = 'https://galaxy.example';
const REPOSITORY = { name: 'widgets', full_name: 'acme/widgets', owner: { login: 'acme' } };

const targetPull = (body = 'Offline upload, the widgets half.\n\nPart of mobile-12 · https://galaxy.example/prd/d-1') => ({
  number: parsePr(12),
  base: { ref: 'main', sha: 'base1' },
  head: { ref: 'feat/offline-upload', sha: 'head1' },
  labels: [],
  body,
});

const OUTBOX: ProductOutbox = { dossierId: 'd-1', productId: 'p-1', productName: 'Mobile', open: [] };

type Pull = ReturnType<typeof targetPull>;

/** A signed `pull_request` delivery through `/api/github`'s unit: the events it sent. */
async function deliver(pull: Pull): Promise<AppEvent[]> {
  const body = JSON.stringify({ action: 'opened', installation: { id: 7 }, repository: REPOSITORY, number: pull.number, pull_request: pull });
  const sent: AppEvent[] = [];
  const response = await receiveWebhook({
    body,
    headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}` },
    secret: SECRET,
    forward: () => Promise.resolve(),
    send: (events) => Promise.resolve(sent.push(...events)),
  });
  expect(response.status).toBe(200);
  return sent;
}

function setUp({ pull = targetPull(), read }: { pull?: Pull; read?: ProductOutboxReader | null } = {}) {
  const github = fakeGitHub({
    commits: { base1: fixture('base-active'), head1: fixture('head-open') },
    pull,
    others: { 'acme/plan': [{ number: 37, body: 'Closes #8' }] },
  });
  const reads: Array<[string, ProductPrdRef]> = [];
  const logged: string[] = [];
  const reader: ProductOutboxReader = (repository, prd) => {
    reads.push([repository, prd]);
    return Promise.resolve(OUTBOX);
  };
  const fn = createOutboxCheck({
    client: inngest,
    octokitFor: () => github.octokit,
    readProductOutbox: read === undefined ? reader : read,
    galaxyUrl: GALAXY,
    now: () => new Date('2026-10-11T10:05:00.000Z'),
    log: (line) => logged.push(line),
  });
  const run = async (events: AppEvent[]) => {
    for (const event of events) {
      const { error } = await new InngestTestEngine({ function: fn, events: [event as never] }).execute();
      expect(error).toBeUndefined();
    }
  };
  return { github, reads, logged, fn, run };
}

const routes = (github: ReturnType<typeof fakeGitHub>) => github.state.requests.map((r) => r.route);

describe('the outbox check of a product PRD\'s target PR — one gate on the product (acceptance 7)', () => {
  it('reads success · 0 open · one gate on Mobile with no open item, its Details on Mobile › Questions', async () => {
    const t = setUp();
    await t.run(await deliver(targetPull()));
    const run = checkRunAt(t.github.state, -1);
    expect(run).toMatchObject({ name: 'outbox', head_sha: 'head1', status: 'completed', conclusion: 'success', details_url: 'https://galaxy.example/app/products/p-1/questions' });
    expect(outputOf(run).title).toBe('0 open · one gate on Mobile');
    expect(t.reads).toEqual([['acme/widgets', { key: 'mobile', seq: 12, id: 'mobile-12' }]]);
    expect(t.github.state.comments).toEqual([]);
  });

  it('reads failure · <k> open · answer on Mobile › Questions while an item is open, posting no comment', async () => {
    const open = [{ item: 's1-01-a', rank: 'high' }, { item: 's2-01-b', rank: 'medium' }, { item: 's2-02-c', rank: 'human-action' }];
    const t = setUp({ read: () => Promise.resolve({ ...OUTBOX, open }) });
    await t.run(await deliver(targetPull()));
    const run = checkRunAt(t.github.state, -1);
    expect(run).toMatchObject({ conclusion: 'failure', details_url: 'https://galaxy.example/app/products/p-1/questions' });
    expect(outputOf(run).title).toBe('3 open · answer on Mobile › Questions');
    expect(t.github.state.comments).toEqual([]);
  });

  it('never points at a plan PR: no pull request list is read, no plan PR named, no outbox folder snapshot', async () => {
    const t = setUp();
    await t.run(await deliver(targetPull()));
    expect(routes(t.github)).not.toContain('GET /repos/{owner}/{repo}/pulls');
    expect(routes(t.github)).not.toContain('GET /repos/{owner}/{repo}/compare/{basehead}');
    const { title, summary } = outputOf(checkRunAt(t.github.state, -1));
    expect(`${title}\n${summary}`).not.toMatch(/plan PR|acme\/plan/);
  });

  it('is held, never failed, when the server cannot be read, or the App cannot read it here, said in the log', async () => {
    for (const read of [() => Promise.reject(new Error('connection refused')), null]) {
      const t = setUp({ read });
      await t.run(await deliver(targetPull()));
      expect(checkRunAt(t.github.state, -1)).toMatchObject({ conclusion: 'neutral', output: { title: 'held · server unreachable since 2026-10-11 10:05 UTC · held, not failed' } });
      expect(t.logged).toEqual([expect.stringMatching(/^outbox check of acme\/widgets for mobile-12 is held: (connection refused|the App cannot read the server here)$/)]);
    }
  });

  it('fails a body naming a PRD no product holding this repository has', async () => {
    const t = setUp({ read: () => Promise.resolve(null) });
    await t.run(await deliver(targetPull()));
    expect(checkRunAt(t.github.state, -1)).toMatchObject({ conclusion: 'failure', output: { title: 'unknown · no product PRD mobile-12 holds this repository' } });
  });

  it('a target PR of a plan-repository PRD still passes, pointing at its plan PR, reading no outbox row', async () => {
    const t = setUp({ pull: targetPull('Part of acme/plan#8') });
    await t.run(await deliver(targetPull('Part of acme/plan#8')));
    expect(checkRunAt(t.github.state, -1)).toMatchObject({ conclusion: 'success' });
    expect(outputOf(checkRunAt(t.github.state, -1)).summary).toContain('https://github.com/acme/plan/pull/37');
    expect(t.reads).toEqual([]);
  });

  it('a sub-PR naming the product PRD, into the feature branch, is not graded on the product', async () => {
    const pull = { ...targetPull(), base: { ref: 'feat/offline-upload', sha: 'base1' }, head: { ref: 'feat/offline-upload--s1', sha: 'head1' } };
    const t = setUp({ pull });
    await t.run(await deliver(pull));
    expect(checkRunAt(t.github.state, -1)).toMatchObject({ conclusion: 'skipped' });
    expect(t.reads).toEqual([]);
  });

  it('fails closed when the run failed after its retries: a product PRD\'s outbox is a gate', async () => {
    const t = setUp();
    const [event] = await deliver(targetPull());
    const failed = await createFailureHandler({ octokitFor: () => t.github.octokit })({ event: { data: { event, error: { message: 'GitHub answered 502' } } } });
    expect(failed).toMatchObject({ name: 'outbox', reason: 'GitHub answered 502' });
    expect(checkRunAt(t.github.state, -1)).toMatchObject({ conclusion: 'failure', output: { title: 'omni-loop could not evaluate: GitHub answered 502' } });
  });
});

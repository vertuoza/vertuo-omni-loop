// The server event end to end against a stubbed GitHub (PRD 1548 s4, acceptance 8): a signed POST in,
// the recheck run on the event it sent, and the approved check run on every event the recheck sent. No
// test calls GitHub or Supabase.
import { createHmac } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InngestTestEngine } from '@inngest/test';
import { GithubDeferred } from '@omni/github';
import { RetryAfterError } from 'inngest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApprovedCheck } from '../approved-check/approved-check.ts';
import type { ApprovalRecord, PinnedFile } from '../approved-check/state.ts';
import { OUTBOX_CHECK_EVENT, type CheckRequest, inngest } from '../inngest-client.ts';
import { checkRunAt, fakeGitHub, outputOf } from '../outbox-check/fake-github.ts';
import { createOutboxCheck } from '../outbox-check/outbox-check.ts';
import { createServerEventRecheck, SERVER_EVENT_FUNCTION_ID, SERVER_EVENT_TRIGGER } from './recheck.ts';
import { receiveServerEvent, SERVER_SIGNATURE_HEADER, type ServerEventRequest } from './server-event.ts';
import type { PrdTargets } from './targets.ts';

const SECRET = 'shared-secret';
const DOSSIER = '0b9f8a1e-3c4d-4e5f-8a9b-0c1d2e3f4a5b';

const folders: string[] = [];
afterAll(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

/** A commit holding only the loop's config. */
function configCommit(): string {
  const folder = mkdtempSync(join(tmpdir(), 'omni-server-event-'));
  folders.push(folder);
  mkdirSync(join(folder, '.omni-loop'));
  writeFileSync(join(folder, '.omni-loop', 'config.yml'), 'kit: 1\nrepo:\n  slug: acme/api\n');
  return folder;
}

const hash = (c: string) => c.repeat(64);
const pin = (kind: string, sha: string): PinnedFile => ({ kind, path: `${kind}.md`, sha256: hash(sha), versionId: `v-${kind}`, content: `${kind} text` });
const PINS = [pin('spec', 'a'), pin('plan', 'b')];
const RECORD: ApprovalRecord = {
  dossierId: DOSSIER,
  approval: { approver: { login: 'pm', member: true }, approvedAt: '2026-10-11T08:00:00.000Z', files: PINS, voids: [] },
  latest: PINS.map(({ kind, sha256, versionId, content }) => ({ kind, sha256, versionId, commitSha: null, content })),
};

const TARGETS: PrdTargets = { prdId: 'mobile-12', installationId: 77, pulls: [{ repository: 'acme/api', number: 446 }] };

/** The recheck's send, answered as Inngest would. */
const sentSteps = () => [{ id: 'recheck', handler: () => ({ ids: ['e-1'] }) }];

/** A signed server event in, through the route's unit: the Inngest events it sent. */
async function post(event: 'approved' | 'voided' | 'item-opened' | 'item-settled'): Promise<ServerEventRequest[]> {
  const body = JSON.stringify({ event, dossier: DOSSIER, at: '2026-10-11T09:00:00.000Z' });
  const sent: ServerEventRequest[] = [];
  const reply = await receiveServerEvent(
    { body, headers: new Headers({ [SERVER_SIGNATURE_HEADER]: `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}` }) },
    { secret: SECRET, send: (events) => Promise.resolve(sent.push(...events)) },
  );
  expect(reply.status).toBe(202);
  return sent;
}

function setUp({ body = 'Offline upload.\n\nPart of mobile-12 · https://galaxy.example/prd/x', targets = TARGETS, refuse = false }: { body?: string; targets?: PrdTargets | null; refuse?: boolean } = {}) {
  const github = fakeGitHub({ commits: { base1: configCommit() }, pull: { number: 446, base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/offline-upload', sha: 'head9' }, labels: [], body } as never });
  const reads: string[] = [];
  const logged: string[] = [];
  const octokitFor = (installationId: number) => {
    reads.push(`installation ${installationId}`);
    if (refuse) throw new GithubDeferred(Date.parse('2026-10-11T10:05:00.000Z'));
    return github.octokit;
  };
  const recheck = createServerEventRecheck({
    client: inngest,
    octokitFor,
    readTargets: (dossier) => {
      reads.push(`targets ${dossier}`);
      return Promise.resolve(targets);
    },
    log: (line) => logged.push(line),
  });
  return { github, reads, logged, recheck };
}

describe('server-event — an approval, a void, an item opened or settled re-posts both checks on the PRD\'s open target PRs (acceptance 8)', () => {
  it('reads the targets from the database, one GET per pull request and no list call, and sends one outbox check event, which both checks run, for each that names the PRD', async () => {
    for (const event of ['approved', 'voided', 'item-opened', 'item-settled'] as const) {
      const run = setUp();
      const [sent] = await post(event);
      const { result, ctx } = await new InngestTestEngine({ function: run.recheck, events: [sent as never], steps: sentSteps() }).execute();
      expect(result).toEqual({ prd: 'mobile-12', rechecked: ['acme/api#446'] });
      expect(run.reads).toEqual([`targets ${DOSSIER}`, 'installation 77']);
      expect(run.github.state.requests.map((r) => r.route)).toEqual(['GET /repos/{owner}/{repo}/pulls/{pull_number}']);
      expect(run.github.state.requests.some((r) => r.route === 'GET /repos/{owner}/{repo}/pulls')).toBe(false);
      const sentOn = ctx.step.sendEvent.mock.calls.map(([id, events]) => [id, events]);
      const data = { installationId: 77, owner: 'acme', repo: 'api', repository: 'acme/api', prNumber: 446, headSha: 'head9', trigger: SERVER_EVENT_TRIGGER };
      expect(sentOn).toEqual([['recheck', [{ name: OUTBOX_CHECK_EVENT, data }]]]);
    }
  });

  it('hands the approved check what it posts on the head the pull request is at, with the check\'s own verdict', async () => {
    const run = setUp();
    const [sent] = await post('approved');
    const { ctx } = await new InngestTestEngine({ function: run.recheck, events: [sent as never], steps: sentSteps() }).execute();
    const [[, events]] = ctx.step.sendEvent.mock.calls as unknown as [[string, CheckRequest[]]];
    const approved = createApprovedCheck({ client: inngest, octokitFor: () => run.github.octokit, readRecord: () => Promise.resolve(RECORD), galaxyUrl: 'https://galaxy.example' });
    const checked = await new InngestTestEngine({ function: approved, events: events as never }).execute();
    expect(checked.result).toMatchObject({ name: 'omni/approved', prd: 'mobile-12', state: 'building', conclusion: 'success' });
    expect(run.github.state.checkRuns).toEqual([expect.objectContaining({ head_sha: 'head9', conclusion: 'success' })]);
  });

  it('hands the outbox check what it grades: an item settled turns the target PR\'s outbox check green (s8)', async () => {
    const run = setUp();
    const [sent] = await post('item-settled');
    const { ctx } = await new InngestTestEngine({ function: run.recheck, events: [sent as never], steps: sentSteps() }).execute();
    const [[, events]] = ctx.step.sendEvent.mock.calls as unknown as [[string, CheckRequest[]]];
    const outbox = createOutboxCheck({
      client: inngest,
      octokitFor: () => run.github.octokit,
      readProductOutbox: () => Promise.resolve({ dossierId: DOSSIER, productId: 'p-1', productName: 'Mobile', open: [] }),
      galaxyUrl: 'https://galaxy.example',
    });
    const checked = await new InngestTestEngine({ function: outbox, events: events as never }).execute();
    expect(checked.result).toMatchObject({ name: 'outbox', conclusion: 'success' });
    expect(checkRunAt(run.github.state, -1)).toMatchObject({ head_sha: 'head9', conclusion: 'success' });
    expect(outputOf(checkRunAt(run.github.state, -1)).title).toBe('0 open · one gate on Mobile');
  });

  it('sends nothing for an open pull request whose body names another PRD, or none', async () => {
    for (const body of ['Part of mobile-13', 'Part of field-12', 'Closes #12', '']) {
      const run = setUp({ body });
      const [sent] = await post('approved');
      const { result, ctx } = await new InngestTestEngine({ function: run.recheck, events: [sent as never], steps: sentSteps() }).execute();
      expect(result).toEqual({ prd: 'mobile-12', rechecked: [] });
      expect(ctx.step.sendEvent).not.toHaveBeenCalled();
    }
  });

  it('reads no GitHub at all for a dossier that is no product PRD, or a PRD with no open pull request', async () => {
    for (const targets of [null, { ...TARGETS, pulls: [] }]) {
      const run = setUp({ targets });
      const [sent] = await post('voided');
      const { ctx } = await new InngestTestEngine({ function: run.recheck, events: [sent as never], steps: sentSteps() }).execute();
      expect(run.github.state.requests).toEqual([]);
      expect(ctx.step.sendEvent).not.toHaveBeenCalled();
    }
  });

  it('re-checks nothing, and says why, when the App cannot read the server here', async () => {
    const logged: string[] = [];
    const recheck = createServerEventRecheck({ client: inngest, octokitFor: () => { throw new Error('no GitHub'); }, readTargets: null, log: (line) => logged.push(line) });
    const [sent] = await post('approved');
    const { result } = await new InngestTestEngine({ function: recheck, events: [sent as never] }).execute();
    expect(result).toEqual({ rechecked: [] });
    expect(logged).toEqual([`server event: the approved of dossier ${DOSSIER} re-checks nothing: the App cannot read the server here`]);
  });

  it('waits for the GitHub budget: a deferred read is retried after its window, said in the log', async () => {
    const run = setUp({ refuse: true });
    const [sent] = await post('approved');
    const { error } = await new InngestTestEngine({ function: run.recheck, events: [sent as never], steps: sentSteps() }).execute();
    expect(error).toMatchObject({ name: RetryAfterError.name });
    expect(run.logged).toEqual(['server event: acme/api#446 waits for the GitHub budget: GitHub budget below its background floor until 2026-10-11T10:05:00.000Z']);
  });

  it('is debounced per PRD, by its dossier', () => {
    const run = setUp();
    expect(run.recheck.id()).toBe(SERVER_EVENT_FUNCTION_ID);
    expect((run.recheck as unknown as { opts: { debounce: { key: string } } }).opts.debounce.key).toBe('event.data.dossier');
  });
});

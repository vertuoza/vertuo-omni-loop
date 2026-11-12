// The fix stamp end to end against a stubbed GitHub (PRD omni-loop-3 s3; PRD 2011 s7, acceptance 5): a signed
// delivery of a pull request closed or reopened in, the webhook's `fix-row-stamp` job out, and that job claimed and
// run against a database that keeps a record's Fixes rows as `fix_row_stamp()` does. The job is handed no GitHub
// at all: the delivery carries every fact it needs, so it reads nothing there and
// merges nothing. No test calls GitHub or Supabase.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parsePr, parseProductBugId } from 'omni-loop/kit/lib/ids.ts';
import type { ClaimedJob, NewJob } from '../jobs/ledger.ts';
import { liveWorkers } from '../jobs/pr-checks.ts';
import type { JobResult } from '../jobs/worker.ts';
import { receiveWebhook } from '../webhook/webhook.ts';
import { FIX_ROW_STAMP_KIND, fixRowStampHandler, fixRowStampJob } from './job.ts';
import type { FixStampData } from './fix-stamp.ts';
import type { FixStamp, FixStamper, StampAnswer } from './stamp.ts';

const SECRET = 'shh-test-secret';
const INSTALLATION = { id: 4242 };
const MERGED_AT = '2026-10-16T09:00:00Z';

/** One Fixes row, as the database keeps it. */
type Row = { bug: string; repository: string; pull: number; mergedAt: string | null; closedAt: string | null };

const stateOf = (row: Row) => (row.mergedAt ? 'merged' : row.closedAt ? 'closed' : 'open');

/** The rows `call` reaches: every row of its pull request, a merged one only for a merge. */
const reached = (rows: Row[], call: FixStamp) =>
  rows.filter((row) => row.repository === call.repository.toLowerCase() && row.pull === call.prNumber && (call.kind === 'merged' || !row.mergedAt));

/** Applies `call` to `hit`: a merge stamps once, a close marks, a reopen clears the close. */
function apply(hit: Row[], call: FixStamp): void {
  for (const row of hit) {
    if (call.kind === 'merged') row.mergedAt ??= call.at;
    row.closedAt = call.kind === 'closed' ? call.at : null;
  }
}

/** The records `newly` merged rows completed. */
const shippedBy = (rows: Row[], newly: Row[]) =>
  [...new Set(newly.map((row) => row.bug))].filter((bug) => rows.filter((row) => row.bug === bug).every((row) => row.mergedAt));

/**
 * A database holding Mobile's record `mobile-B74` with two fixes, `acme/api#446` then `acme/mobile#31`,
 * stamped the way `fix_row_stamp()` stamps them (supabase/checks/fix_rows.sql proves the real one).
 */
function recordDb() {
  const rows: Row[] = [
    { bug: 'mobile-B74', repository: 'acme/api', pull: 446, mergedAt: null, closedAt: null },
    { bug: 'mobile-B74', repository: 'acme/mobile', pull: 31, mergedAt: null, closedAt: null },
  ];
  const unmatched: string[] = [];
  const product = ['acme/api', 'acme/mobile'];
  const calls: FixStamp[] = [];
  const keep = (call: FixStamp): string => {
    const line = `unmatched merge ${call.repository.toLowerCase()}#${String(call.prNumber)}`;
    if (!unmatched.includes(line)) unmatched.push(line);
    return line;
  };
  const stamp: FixStamper = (call) => {
    calls.push(call);
    const hit = reached(rows, call);
    const newly = call.kind === 'merged' ? hit.filter((row) => !row.mergedAt) : [];
    apply(hit, call);
    const kept = call.kind === 'merged' && hit.length === 0 && call.bug !== null && product.includes(call.repository.toLowerCase()) && keep(call) ? call.bug : null;
    const answer: StampAnswer = {
      rows: hit.map((row) => ({ bug: parseProductBugId(row.bug), dossierId: 'd-74', position: rows.indexOf(row) + 1, state: stateOf(row) })),
      shipped: shippedBy(rows, newly).map(parseProductBugId),
      unmatched: kept,
    };
    return Promise.resolve(answer);
  };
  const record = () => ({
    rows: rows.map((row) => `${row.repository}#${String(row.pull)} ${stateOf(row) === 'closed' ? 'closed, not merged' : stateOf(row)}`),
    shipped: rows.every((row) => row.mergedAt),
    unmatched: [...unmatched],
  });
  return { stamp, calls, record };
}

type Pull = { repo?: string; number?: number; action?: 'closed' | 'reopened'; merged?: boolean; base?: string; body?: string | null };

/** A signed delivery of `pull`, as GitHub sends it: the jobs the webhook added. */
async function deliver({ repo = 'api', number = 446, action = 'closed', merged = true, base = 'main', body = 'Fixes mobile-B74 · https://omni.example/bugs/mobile-B74' }: Pull = {}) {
  const payload = {
    action,
    number,
    installation: INSTALLATION,
    repository: { name: repo, full_name: `acme/${repo}`, owner: { login: 'acme' }, default_branch: 'main' },
    pull_request: {
      number,
      body,
      merged: action === 'closed' && merged,
      merged_at: action === 'closed' && merged ? MERGED_AT : null,
      merge_commit_sha: action === 'closed' && merged ? 'm'.repeat(40) : null,
      closed_at: action === 'closed' ? MERGED_AT : null,
      updated_at: MERGED_AT,
      head: { sha: 'abc123', ref: 'fix/offline-upload' },
      base: { ref: base },
    },
  };
  const text = JSON.stringify(payload);
  const queued: NewJob[] = [];
  const response = await receiveWebhook({
    body: text,
    headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': `sha256=${createHmac('sha256', SECRET).update(text).digest('hex')}` },
    secret: SECRET,
    send: () => Promise.resolve(),
    queueJobs: (jobs) => Promise.resolve(queued.push(...jobs)),
    forward: () => Promise.resolve(),
  });
  expect(response.status).toBe(200);
  return queued.filter((job) => job.kind === FIX_ROW_STAMP_KIND);
}

/** `job` as the ledger hands it to the worker: claimed, on its first try. */
const claimed = (job: NewJob): ClaimedJob => ({ id: 'job-1', claim: 'claim-1', claimedUntil: MERGED_AT, tries: 1, progress: {}, lane: null, maxTries: job.maxTries ?? 5, kind: job.kind, key: job.key, subject: job.subject, payload: job.payload });

/** Runs every job, claimed, in order; how each ended. */
async function run(stamp: FixStamper | null, jobs: NewJob[], log: string[] = []) {
  const handler = fixRowStampHandler({ stamp, log: (line) => log.push(line) });
  const results: JobResult[] = [];
  for (const job of jobs) results.push(await handler(claimed(job)));
  return results;
}

describe('fix-row-stamp — a merged fix stamps its row, the last ships the record (PRD 2011 s7, acceptance 5)', () => {
  it('a merged pull request matching a row stamps it merged, and the record stays open while a row is not', async () => {
    const db = recordDb();
    const [result] = await run(db.stamp, await deliver());
    expect(result).toEqual({ outcome: 'done' });
    expect(db.record()).toEqual({ rows: ['acme/api#446 merged', 'acme/mobile#31 open'], shipped: false, unmatched: [] });
    expect(db.calls).toEqual([{ repository: 'acme/api', prNumber: 446, kind: 'merged', at: MERGED_AT, bug: 'mobile-B74' }]);
  });

  it('the last merge ships the record, and says so', async () => {
    const db = recordDb();
    const log: string[] = [];
    await run(db.stamp, await deliver(), log);
    const [last] = await run(db.stamp, await deliver({ repo: 'mobile', number: 31 }), log);
    expect(last).toEqual({ outcome: 'done' });
    expect(db.record()).toEqual({ rows: ['acme/api#446 merged', 'acme/mobile#31 merged'], shipped: true, unmatched: [] });
    expect(log).toEqual(['fix stamp: acme/mobile#31 merged, the last fix of mobile-B74: it ships']);
  });

  it('a redelivered merge is the same job, and run again ships nothing twice', async () => {
    const db = recordDb();
    const log: string[] = [];
    await run(db.stamp, await deliver());
    const first = await deliver({ repo: 'mobile', number: 31 });
    await run(db.stamp, first, log);
    const again = await deliver({ repo: 'mobile', number: 31 });
    expect(again.map((job) => job.key)).toEqual(first.map((job) => job.key));
    expect(await run(db.stamp, again, log)).toEqual([{ outcome: 'done' }]);
    expect(log).toEqual(['fix stamp: acme/mobile#31 merged, the last fix of mobile-B74: it ships']);
  });

  it('a merge matching no row stamps nothing and is kept as an unmatched merge of the record its body names', async () => {
    const db = recordDb();
    const log: string[] = [];
    const [result] = await run(db.stamp, await deliver({ number: 450 }), log);
    expect(result).toEqual({ outcome: 'done' });
    expect(db.record()).toEqual({ rows: ['acme/api#446 open', 'acme/mobile#31 open'], shipped: false, unmatched: ['unmatched merge acme/api#450'] });
    expect(log).toEqual(['fix stamp: acme/api#450 merged, matching no row of mobile-B74: kept as unmatched merge acme/api#450']);
  });

  it('a pull request closed unmerged leaves its row closed, not merged, and the record open; reopened, it is open again', async () => {
    const db = recordDb();
    const [closed] = await run(db.stamp, await deliver({ merged: false }));
    expect(closed).toEqual({ outcome: 'done' });
    expect(db.calls).toEqual([{ repository: 'acme/api', prNumber: 446, kind: 'closed', at: MERGED_AT, bug: 'mobile-B74' }]);
    expect(db.record()).toEqual({ rows: ['acme/api#446 closed, not merged', 'acme/mobile#31 open'], shipped: false, unmatched: [] });
    await run(db.stamp, await deliver({ action: 'reopened' }));
    expect(db.record().rows).toEqual(['acme/api#446 open', 'acme/mobile#31 open']);
  });
});

describe('fix-row-stamp — the job', () => {
  const data: FixStampData = { installationId: 1, repository: 'Acme/API', prNumber: parsePr(446), kind: 'merged', at: MERGED_AT, bug: null };
  const job = fixRowStampJob(data);

  it('is one job per pull request, change and time, keyed `<owner/name>#<pr>@<what>@<when>`, in no lane, with 4 tries', () => {
    expect(job).toEqual({ kind: 'fix-row-stamp', key: `acme/api#446@merged@${MERGED_AT}`, subject: 'acme/api', payload: { ...data }, maxTries: 4 });
    expect(new Set([job.key, fixRowStampJob({ ...data, kind: 'closed' }).key, fixRowStampJob({ ...data, at: '2026-10-16T09:00:01Z' }).key]).size).toBe(3);
  });

  it('has a handler in the worker every runner of the ledger runs', () => {
    const { handlers } = liveWorkers({ supabase: { url: 'https://db.example', key: 'service-key' } }, () => Promise.reject(new Error('unused')));
    expect(typeof handlers[FIX_ROW_STAMP_KIND]).toBe('function');
  });

  it('stamps nothing, saying why, when the App cannot reach the server here', async () => {
    const log: string[] = [];
    const [result] = await run(null, [job], log);
    expect(result).toEqual({ outcome: 'skipped', reason: 'the App cannot reach the server here' });
    expect(log).toEqual(['fix stamp: Acme/API#446 merged stamps nothing: the App cannot reach the server here']);
  });

  it('throws, for the worker to retry, when the database refuses', async () => {
    await expect(run(() => Promise.reject(new Error('the database refused: down')), [job])).rejects.toThrow('the database refused: down');
  });

  it('refuses a payload out of shape by its field, stamping nothing', async () => {
    const calls: FixStamp[] = [];
    const stamp: FixStamper = (call) => {
      calls.push(call);
      return Promise.resolve({ rows: [], shipped: [], unmatched: null });
    };
    await expect(run(stamp, [{ ...job, payload: { ...job.payload, kind: 'opened' } }])).rejects.toThrow('kind');
    expect(calls).toEqual([]);
  });
});

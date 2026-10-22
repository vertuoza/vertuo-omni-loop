// The fix stamp end to end against a stubbed GitHub (PRD 2011 s7, acceptance 5): a signed delivery of a
// pull request closed or reopened in, the webhook's fix stamp event out, and the `fix-row-stamp` function
// run on it against a database that keeps a record's Fixes rows as `fix_row_stamp()` does. The function
// is handed no GitHub at all: the delivery carries every fact it needs, so it reads nothing there and
// merges nothing. No test calls GitHub or Supabase.
import { createHmac } from 'node:crypto';
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { parsePr, parseProductBugId } from 'omni-loop/kit/lib/ids.ts';
import { inngest } from '../inngest-client.ts';
import { receiveWebhook } from '../webhook/webhook.ts';
import { createFixRowStamp, FIX_ROW_STAMP_FUNCTION_ID } from './fix-row-stamp.ts';
import { FIX_STAMP_EVENT, type FixStampRequest } from './fix-stamp.ts';
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

/** A signed delivery of `pull`, as GitHub sends it: the fix stamp events the webhook sent. */
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
  const stamps: FixStampRequest[] = [];
  const response = await receiveWebhook({
    body: text,
    headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': `sha256=${createHmac('sha256', SECRET).update(text).digest('hex')}` },
    secret: SECRET,
    send: () => Promise.resolve(),
    sendStamps: (events) => Promise.resolve(stamps.push(...events)),
    forward: () => Promise.resolve(),
  });
  expect(response.status).toBe(200);
  return stamps;
}

/** Runs the function on every stamp event, in order; their results. */
async function run(stamp: FixStamper | null, events: FixStampRequest[], log: string[] = []) {
  const fn = createFixRowStamp({ client: inngest, stamp, log: (line) => log.push(line) });
  const results: unknown[] = [];
  for (const event of events) {
    const { result, error } = await new InngestTestEngine({ function: fn, events: [event as never] }).execute();
    expect(error).toBeUndefined();
    results.push(result);
  }
  return results;
}

describe('fix-row-stamp — a merged fix stamps its row, the last ships the record (PRD 2011 s7, acceptance 5)', () => {
  it('a merged pull request matching a row stamps it merged, and the record stays open while a row is not', async () => {
    const db = recordDb();
    const [result] = await run(db.stamp, await deliver());
    expect(result).toEqual({ pull: 'acme/api#446', kind: 'merged', rows: ['mobile-B74 row 1 merged'], shipped: [], unmatched: null });
    expect(db.record()).toEqual({ rows: ['acme/api#446 merged', 'acme/mobile#31 open'], shipped: false, unmatched: [] });
    expect(db.calls).toEqual([{ repository: 'acme/api', prNumber: 446, kind: 'merged', at: MERGED_AT, bug: 'mobile-B74' }]);
  });

  it('the last merge ships the record, and says so', async () => {
    const db = recordDb();
    const log: string[] = [];
    await run(db.stamp, await deliver(), log);
    const [last] = await run(db.stamp, await deliver({ repo: 'mobile', number: 31 }), log);
    expect(last).toEqual({ pull: 'acme/mobile#31', kind: 'merged', rows: ['mobile-B74 row 2 merged'], shipped: ['mobile-B74'], unmatched: null });
    expect(db.record()).toEqual({ rows: ['acme/api#446 merged', 'acme/mobile#31 merged'], shipped: true, unmatched: [] });
    expect(log).toEqual(['fix stamp: acme/mobile#31 merged, the last fix of mobile-B74: it ships']);
  });

  it('a redelivered merge ships nothing twice', async () => {
    const db = recordDb();
    await run(db.stamp, await deliver());
    await run(db.stamp, await deliver({ repo: 'mobile', number: 31 }));
    const [again] = await run(db.stamp, await deliver({ repo: 'mobile', number: 31 }));
    expect(again).toMatchObject({ shipped: [] });
  });

  it('a merge matching no row stamps nothing and is kept as an unmatched merge of the record its body names', async () => {
    const db = recordDb();
    const log: string[] = [];
    const [result] = await run(db.stamp, await deliver({ number: 450 }), log);
    expect(result).toEqual({ pull: 'acme/api#450', kind: 'merged', rows: [], shipped: [], unmatched: 'mobile-B74' });
    expect(db.record()).toEqual({ rows: ['acme/api#446 open', 'acme/mobile#31 open'], shipped: false, unmatched: ['unmatched merge acme/api#450'] });
    expect(log).toEqual(['fix stamp: acme/api#450 merged, matching no row of mobile-B74: kept as unmatched merge acme/api#450']);
  });

  it('a pull request closed unmerged leaves its row closed, not merged, and the record open; reopened, it is open again', async () => {
    const db = recordDb();
    const [closed] = await run(db.stamp, await deliver({ merged: false }));
    expect(closed).toEqual({ pull: 'acme/api#446', kind: 'closed', rows: ['mobile-B74 row 1 closed'], shipped: [], unmatched: null });
    expect(db.record()).toEqual({ rows: ['acme/api#446 closed, not merged', 'acme/mobile#31 open'], shipped: false, unmatched: [] });
    await run(db.stamp, await deliver({ action: 'reopened' }));
    expect(db.record().rows).toEqual(['acme/api#446 open', 'acme/mobile#31 open']);
  });
});

describe('fix-row-stamp — the function', () => {
  const event = { name: FIX_STAMP_EVENT, id: 'e', data: { installationId: 1, repository: 'acme/api', prNumber: parsePr(446), kind: 'merged', at: MERGED_AT, bug: null } };

  it('is the `fix-row-stamp` function, on the fix stamp event, retried', () => {
    const fn = createFixRowStamp({ client: inngest, stamp: null });
    expect(fn.opts).toMatchObject({ id: FIX_ROW_STAMP_FUNCTION_ID, triggers: [{ event: FIX_STAMP_EVENT }], retries: 3 });
    expect(FIX_ROW_STAMP_FUNCTION_ID).toBe('fix-row-stamp');
  });

  it('stamps nothing, saying why, when the App cannot reach the server here', async () => {
    const log: string[] = [];
    const [result] = await run(null, [event as FixStampRequest], log);
    expect(result).toEqual({ pull: 'acme/api#446', kind: 'merged', stamped: false });
    expect(log).toEqual(['fix stamp: acme/api#446 merged stamps nothing: the App cannot reach the server here']);
  });

  it('fails the run, for Inngest to retry, when the database refuses', async () => {
    const fn = createFixRowStamp({ client: inngest, stamp: () => Promise.reject(new Error('the database refused: down')) });
    const { error } = await new InngestTestEngine({ function: fn, events: [event as never] }).execute();
    expect(String((error as Error | undefined)?.message)).toContain('the database refused: down');
  });

  it('refuses an event out of shape by its field, stamping nothing', async () => {
    const calls: FixStamp[] = [];
    const stamp: FixStamper = (call) => {
      calls.push(call);
      return Promise.resolve({ rows: [], shipped: [], unmatched: null });
    };
    const fn = createFixRowStamp({ client: inngest, stamp });
    const { error } = await new InngestTestEngine({ function: fn, events: [{ ...event, data: { ...event.data, kind: 'opened' } } as never] }).execute();
    expect(String((error as Error | undefined)?.message)).toContain('kind');
    expect(calls).toEqual([]);
  });
});

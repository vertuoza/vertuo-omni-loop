import { describe, expect, it } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { Answer, ApprovalHistory, HistoryRepository } from './approvals.repository';
import { eventsOf, openFeed, startOf } from './stream.service';

// The approval stream's rules (PRD 1322 s3), against a fake history: each row's event and data in the
// kit's shapes, ids as places in time order (microseconds apart counted), where a connection starts with
// or without Last-Event-ID, and each later look sending only what is new.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const ADA = '00000000-0000-4000-8000-0000000000a2';
const IRISA = '00000000-0000-4000-8000-0000000000a4';
const PAUL = '00000000-0000-4000-8000-0000000000a5';
const PRD = parsePrd(7);
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

const request = (id: string, askedAt: string, kind: 'asked' | 're-asked' = 'asked') => ({
  id, kind, askedAt, askedBy: ADA, asked: [IRISA, PAUL], nobodyElse: false, product: 'Mobile', approvalKind: 'product' as const,
});
const approval = (id: string, approvedAt: string) => ({ id, approver: 'irisa-gh', approvedAt, pinned: 3, kind: 'product' as const });
const voided = (id: string, voidedAt: string, ofApproval = 'a1') => ({ id, approval: ofApproval, pusher: 'ada-gh', kind: 'spec', from: A, to: B, voidedAt });
const techRequest = (id: string, askedAt: string) => ({ ...request(id, askedAt), asked: [IRISA], product: null, approvalKind: 'tech' as const });
const techApproval = (id: string, approvedAt: string) => ({ ...approval(id, approvedAt), kind: 'tech' as const });

function history(over: Partial<ApprovalHistory> = {}): ApprovalHistory {
  return {
    dossier: DOSSIER,
    author: null,
    requests: [],
    approvals: [],
    voids: [],
    people: [
      { user: ADA, login: 'Ada-GH', name: 'Ada' },
      { user: IRISA, login: 'irisa-gh', name: ' Irisa ' },
      { user: PAUL, login: null, name: '' },
    ],
    ...over,
  };
}

const names = (events: Array<{ id: string; event: string }>) => events.map((e) => `${e.id}:${e.event}`);

describe('eventsOf', () => {
  it("shapes each row into the kit's event, ids in time order", () => {
    const events = eventsOf(history({
      requests: [request('r1', '2026-10-09T10:00:00+00:00'), request('r2', '2026-10-09T10:05:00.5+00:00', 're-asked')],
      approvals: [approval('a1', '2026-10-09T10:01:00.123456+00:00')],
      voids: [voided('v1', '2026-10-09T10:04:00Z')],
    }));
    expect(events).toEqual([
      { id: '1', event: 'asked', data: { asked: [{ login: 'irisa-gh', name: 'Irisa' }, { login: PAUL, name: null }], nobodyElse: false, author: 'ada-gh', product: 'Mobile' } },
      { id: '2', event: 'approved', data: { approver: 'irisa-gh', approvedAt: '2026-10-09T10:01:00.123456+00:00', pinned: 3 } },
      { id: '3', event: 'voided', data: { pusher: 'ada-gh', kind: 'spec', from: A, to: B } },
      { id: '4', event: 're-asked', data: { asked: [{ login: 'irisa-gh', name: 'Irisa' }, { login: PAUL, name: null }], nobodyElse: false, author: 'ada-gh', product: 'Mobile' } },
    ]);
  });

  it('orders rows microseconds apart, then a request before an approval before a void at the same time', () => {
    const events = eventsOf(history({
      requests: [request('r1', '2026-10-09T10:00:00.000002+00:00')],
      approvals: [approval('a1', '2026-10-09T10:00:00.000001+00:00'), approval('a2', '2026-10-09T10:00:00.000002+00:00')],
      voids: [voided('v1', '2026-10-09T10:00:00.000002+00:00')],
    }));
    expect(names(events)).toEqual(['1:approved', '2:asked', '3:approved', '4:voided']);
  });

  it("names the dossier's opener as the author, else whoever asked", () => {
    const opened = eventsOf(history({ author: IRISA, requests: [request('r1', '2026-10-09T10:00:00Z')] }));
    expect(opened[0]?.data).toMatchObject({ author: 'irisa-gh' });
  });
});

describe('startOf', () => {
  const events = eventsOf(history({
    requests: [request('r1', '2026-10-09T10:00:00Z'), request('r2', '2026-10-09T10:05:00Z', 're-asked')],
    approvals: [approval('a1', '2026-10-09T10:01:00Z'), approval('a2', '2026-10-09T10:06:00Z')],
    voids: [voided('v1', '2026-10-09T10:04:00Z')],
  }));

  it('resumes after a known Last-Event-ID', () => {
    expect(names(startOf(events, '2'))).toEqual(['3:voided', '4:re-asked', '5:approved']);
    expect(names(startOf(events, ' 5 '))).toEqual([]);
  });

  it('starts with no id, or one it does not know, at the latest request', () => {
    expect(names(startOf(events, null))).toEqual(['4:re-asked', '5:approved']);
    expect(names(startOf(events, '99'))).toEqual(['4:re-asked', '5:approved']);
    expect(names(startOf(events, 'abc'))).toEqual(['4:re-asked', '5:approved']);
  });

  it('never replays an approval a later void ended', () => {
    const cut = eventsOf(history({
      requests: [request('r1', '2026-10-09T10:00:00Z')],
      approvals: [approval('a1', '2026-10-09T10:01:00Z')],
      voids: [voided('v1', '2026-10-09T10:04:00Z')],
    }));
    expect(names(startOf(cut, null))).toEqual(['1:asked']);
  });

  it('starts with every approval when nothing was asked or voided', () => {
    const only = eventsOf(history({ approvals: [approval('a1', '2026-10-09T10:01:00Z')] }));
    expect(names(startOf(only, null))).toEqual(['1:approved']);
    expect(startOf([], null)).toEqual([]);
  });
});

describe('a Tech Approval in the stream (PRD 2608)', () => {
  const tech = eventsOf(history({
    requests: [techRequest('t1', '2026-10-09T10:00:00Z'), request('r1', '2026-10-09T10:02:00Z')],
    approvals: [techApproval('ta', '2026-10-09T10:01:00Z'), approval('pa', '2026-10-09T10:03:00Z')],
    voids: [voided('v1', '2026-10-09T10:04:00Z', 'pa'), voided('v2', '2026-10-09T10:04:00.000001Z', 'ta')],
  }));

  it('sends each tech row as an event of its own, which an older kit ignores, naming the person', () => {
    expect(tech.map(({ id, event, data }) => ({ id, event, data }))).toEqual([
      { id: '1', event: 'tech-asked', data: { login: 'irisa-gh' } },
      { id: '2', event: 'tech-approved', data: { login: 'irisa-gh', approvedAt: '2026-10-09T10:01:00Z' } },
      { id: '3', event: 'asked', data: { asked: [{ login: 'irisa-gh', name: 'Irisa' }, { login: PAUL, name: null }], nobodyElse: false, author: 'ada-gh', product: 'Mobile' } },
      { id: '4', event: 'approved', data: { approver: 'irisa-gh', approvedAt: '2026-10-09T10:03:00Z', pinned: 3 } },
      { id: '5', event: 'voided', data: { pusher: 'ada-gh', kind: 'spec', from: A, to: B } },
      { id: '6', event: 'tech-voided', data: { login: 'irisa-gh', pusher: 'ada-gh', kind: 'spec', from: A, to: B } },
    ]);
  });

  it('never sends a tech row under a name an older kit acts on: a tech approval never ends its wait', () => {
    const alone = eventsOf(history({
      requests: [techRequest('t1', '2026-10-09T10:00:00Z')],
      approvals: [techApproval('ta', '2026-10-09T10:01:00Z')],
      voids: [voided('v1', '2026-10-09T10:02:00Z', 'ta')],
    }));
    expect(names(alone)).toEqual(['1:tech-asked', '2:tech-approved', '3:tech-voided']);
  });

  it('starts as ever from the latest product request, and with every tech event when none was asked', () => {
    expect(names(startOf(tech, null))).toEqual(['3:asked', '6:tech-voided']);
    const alone = eventsOf(history({ requests: [techRequest('t1', '2026-10-09T10:00:00Z')] }));
    expect(names(startOf(alone, null))).toEqual(['1:tech-asked']);
  });

  it('names the latest person named, an owner\'s rename included', () => {
    const renamed = eventsOf(history({
      requests: [techRequest('t1', '2026-10-09T10:00:00Z'), { ...techRequest('t2', '2026-10-09T10:01:00Z'), asked: [ADA], kind: 're-asked' as const }],
      approvals: [],
      voids: [],
    }));
    expect(renamed.map((e) => e.data)).toEqual([{ login: 'irisa-gh' }, { login: 'ada-gh' }]);
  });
});

/** A fake history that answers each read in turn, the last one again, and records the watches. */
function fake(reads: Array<Answer<ApprovalHistory | null>>) {
  const watched: string[] = [];
  let nudge: (() => void) | null = null;
  let i = 0;
  const repo: HistoryRepository = {
    read: () => Promise.resolve(reads[Math.min(i++, reads.length - 1)] ?? { ok: true, value: null }),
    watch(dossier, onNudge) {
      watched.push(dossier);
      nudge = onNudge;
      return Promise.resolve(() => undefined);
    },
  };
  return { repo, watched, nudge: () => nudge?.() };
}

describe('openFeed', () => {
  const first = history({ requests: [request('r1', '2026-10-09T10:00:00Z')] });
  const second = history({ requests: first.requests, approvals: [approval('a1', '2026-10-09T10:01:00Z')] });

  it('starts with the PRD as it stands, then sends only what each look finds new', async () => {
    const logs: string[] = [];
    const f = fake([{ ok: true, value: first }, { ok: true, value: first }, { ok: true, value: second }, { ok: false, refusal: { code: 'XX000', message: 'down' } }, { ok: true, value: second }]);
    const opened = await openFeed(f.repo, 'acme/mobile', PRD, null, (line) => { logs.push(line); });
    if (!opened.ok || !opened.value) throw new Error('the feed should open');
    const feed = opened.value;
    expect(names(feed.start)).toEqual(['1:asked']);
    expect(await feed.next()).toEqual([]);
    expect(names(await feed.next())).toEqual(['2:approved']);
    expect(await feed.next()).toEqual([]);
    expect(logs).toEqual(['approvals: the stream of acme/mobile #7 could not read its history: down']);
    expect(await feed.next()).toEqual([]);
    await feed.watch(() => undefined);
    expect(f.watched).toEqual([DOSSIER]);
  });

  it('never sends an event twice when two looks overlap', async () => {
    const f = fake([{ ok: true, value: first }, { ok: true, value: second }]);
    const opened = await openFeed(f.repo, 'acme/mobile', PRD, null, () => undefined);
    if (!opened.ok || !opened.value) throw new Error('the feed should open');
    const [a, b] = await Promise.all([opened.value.next(), opened.value.next()]);
    expect([...a, ...b].map((e) => e.id)).toEqual(['2']);
  });

  it('answers null for a PRD the caller does not read, and passes a refusal on', async () => {
    expect(await openFeed(fake([{ ok: true, value: null }]).repo, 'acme/mobile', PRD, null, () => undefined)).toEqual({ ok: true, value: null });
    const refusal = { code: '42501', message: 'no' };
    expect(await openFeed(fake([{ ok: false, refusal }]).repo, 'acme/mobile', PRD, null, () => undefined)).toEqual({ ok: false, refusal });
  });

  it('logs a PRD gone between looks', async () => {
    const logs: string[] = [];
    const opened = await openFeed(fake([{ ok: true, value: first }, { ok: true, value: null }]).repo, 'acme/mobile', PRD, null, (line) => { logs.push(line); });
    if (!opened.ok || !opened.value) throw new Error('the feed should open');
    expect(await opened.value.next()).toEqual([]);
    expect(logs).toEqual(['approvals: the stream of acme/mobile #7 could not read its history: the PRD is gone']);
  });
});

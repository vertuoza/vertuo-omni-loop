import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../ask/page/source';
import type { NotificationApi } from './alerts';
import {
  ANNOUNCED_KEPT, DOCS_ANNOUNCED_KEY, DOCS_DAYS, DOCS_LIMIT, DOCS_SEEN_KEY, documentsReader, groupDocuments, markSeen,
  noticeDocuments, readSeen, settled, SETTLE_MS, toAnnounce, type Announced, type DocumentGroup, type DocumentRow, type Seen,
} from './documents';
import { sure } from '../arcade/sure';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

// The waiting list's New documents part (PRD 579, s1): the spec, plan and before/after versions pushed
// in the last 7 days to the numbered dossiers the person opened, one group per PRD, newest first, less
// what this browser has seen.

const NOW = Date.parse('2026-09-29T10:00:00Z');
const MIN = 60_000;
const at = (ms: number) => new Date(ms).toISOString();

const row = (id: string, kind: DocumentRow['kind'], ago: number, prd = 572, dossier = `d-${prd}`): DocumentRow => ({
  id, kind, created_at: at(NOW - ago), dossier: { id: dossier, prd: parsePrd(prd), title: `PRD title ${prd}` },
});

const NEVER: Seen = { since: 0, dossiers: {} };

describe('grouping new documents per PRD', () => {
  it('turns rows of two PRDs into two groups, newest first, kinds ordered spec, plan, before/after, each once', () => {
    const rows = [
      row('v6', 'plan', 1 * MIN, 572),
      row('v5', 'before-after', 2 * MIN, 572),
      row('v4', 'spec', 3 * MIN, 579),
      row('v3', 'spec', 4 * MIN, 572),
      row('v2', 'before-after', 5 * MIN, 579),
      row('v1', 'spec', 6 * MIN, 572),
    ];
    expect(groupDocuments(rows, NEVER)).toEqual([
      { dossierId: 'd-572', prd: parsePrd(572), title: 'PRD title 572', kinds: ['spec', 'plan', 'before-after'], newestId: 'v6', newestAt: NOW - 1 * MIN,
        kindsAt: { spec: NOW - 4 * MIN, plan: NOW - 1 * MIN, 'before-after': NOW - 2 * MIN } },
      { dossierId: 'd-579', prd: parsePrd(579), title: 'PRD title 579', kinds: ['spec', 'before-after'], newestId: 'v4', newestAt: NOW - 3 * MIN,
        kindsAt: { spec: NOW - 3 * MIN, 'before-after': NOW - 5 * MIN } },
    ]);
  });

  it('takes the newest by time, whatever order the rows come in', () => {
    const rows = [row('old', 'spec', 5 * MIN), row('new', 'plan', 1 * MIN)];
    expect(groupDocuments(rows, NEVER)[0]).toMatchObject({ newestId: 'new', newestAt: NOW - MIN });
  });

  it('drops rows at or before the PRD\'s seen time, and keeps its later ones', () => {
    const rows = [row('v3', 'plan', 1 * MIN), row('v2', 'before-after', 5 * MIN), row('v1', 'spec', 10 * MIN)];
    const seen: Seen = { since: 0, dossiers: { 'd-572': NOW - 5 * MIN } };
    expect(groupDocuments(rows, seen)).toEqual([
      { dossierId: 'd-572', prd: parsePrd(572), title: 'PRD title 572', kinds: ['plan'], newestId: 'v3', newestAt: NOW - MIN, kindsAt: { plan: NOW - MIN } },
    ]);
  });

  it('drops rows before `since`, whatever the PRD', () => {
    const rows = [row('v2', 'plan', 1 * MIN, 572), row('v1', 'spec', 10 * MIN, 579)];
    expect(groupDocuments(rows, { since: NOW - 5 * MIN, dossiers: {} }).map((g) => g.prd)).toEqual([572]);
  });

  it('drops a PRD whose rows are all seen', () => {
    const rows = [row('v2', 'plan', 1 * MIN, 572), row('v1', 'spec', 2 * MIN, 579)];
    const seen: Seen = { since: 0, dossiers: { 'd-579': NOW } };
    expect(groupDocuments(rows, seen).map((g) => g.prd)).toEqual([572]);
  });

  it('drops a row with no number or an unknown kind', () => {
    const draft = { ...row('v1', 'spec', MIN), dossier: { id: 'd-x', prd: null, title: 'Draft' } } as unknown as DocumentRow;
    const odd = { ...row('v2', 'spec', MIN), kind: 'retro' } as unknown as DocumentRow;
    expect(groupDocuments([draft, odd], NEVER)).toEqual([]);
  });
});

/** A fake Db that records the query built on it and answers `result`. */
function recording(result: { data: unknown; error: { message: string } | null }) {
  const calls: [string, ...unknown[]][] = [];
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'not', 'gt', 'gte', 'order', 'limit']) {
    chain[name] = (...args: unknown[]) => {
      calls.push([name, ...args]);
      return chain;
    };
  }
  chain.then = (ok: (r: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(result).then(ok, ko);
  const db = { from: (table: string) => { calls.push(['from', table]); return chain; } } as unknown as Db;
  return { db, calls };
}

describe('reading new documents', () => {
  it('reads the versions of the numbered dossiers I opened, from the last 7 days, the 50 newest', async () => {
    const rows = [row('v1', 'spec', MIN)];
    const { db, calls } = recording({ data: rows, error: null });
    expect(await documentsReader(db, 'me-1')(NOW)).toEqual(rows);
    expect(DOCS_DAYS).toBe(7);
    expect(DOCS_LIMIT).toBe(50);
    expect(calls).toContainEqual(['from', 'dossier_versions']);
    const select = calls.find((c) => c[0] === 'select')?.[1] as string;
    expect(select.replace(/\s+/g, '')).toBe('id,kind,created_at,dossier:dossiers!inner(id,prd,title,opened_by)');
    expect(calls).toContainEqual(['eq', 'dossier.opened_by', 'me-1']);
    expect(calls).toContainEqual(['not', 'dossier.prd', 'is', null]);
    expect(calls).toContainEqual(['gt', 'created_at', at(NOW - 7 * 24 * 60 * MIN)]);
    expect(calls).toContainEqual(['order', 'created_at', { ascending: false }]);
    expect(calls).toContainEqual(['limit', 50]);
  });

  it('keeps only the kinds it knows, and reads none as empty', async () => {
    const { db } = recording({ data: null, error: null });
    expect(await documentsReader(db, 'me-1')(NOW)).toEqual([]);
  });

  it('throws when the read fails', async () => {
    const { db } = recording({ data: null, error: { message: 'denied' } });
    await expect(documentsReader(db, 'me-1')(NOW)).rejects.toThrow(/denied/);
  });
});

/** A storage held in a map. */
function memory(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return { map, store: () => ({ getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }) };
}
const throwing = () => ({
  getItem: (): string | null => { throw new Error('denied'); },
  setItem: () => { throw new Error('denied'); },
});

describe('what this browser has seen', () => {
  it('sets `since` to now the first time, and keeps it after', () => {
    const m = memory();
    expect(readSeen(m.store, NOW)).toEqual({ since: NOW, dossiers: {} });
    expect(JSON.parse(m.map.get(DOCS_SEEN_KEY) ?? 'null')).toEqual({ since: NOW, dossiers: {} });
    expect(readSeen(m.store, NOW + 10 * MIN)).toEqual({ since: NOW, dossiers: {} });
  });

  it('markSeen writes the dossier\'s time', () => {
    const m = memory();
    readSeen(m.store, NOW);
    markSeen(m.store, 'd-572', NOW + MIN);
    expect(readSeen(m.store, NOW + 2 * MIN)).toEqual({ since: NOW, dossiers: { 'd-572': NOW + MIN } });
  });

  it('markSeen on a browser that never ran it starts `since` then too', () => {
    const m = memory();
    markSeen(m.store, 'd-572', NOW);
    expect(readSeen(m.store, NOW + MIN)).toEqual({ since: NOW, dossiers: { 'd-572': NOW } });
  });

  it('forgets seen times older than the 7 days read', () => {
    const m = memory({ [DOCS_SEEN_KEY]: JSON.stringify({ since: 0, dossiers: { old: NOW - 8 * 24 * 60 * MIN, recent: NOW - MIN } }) });
    markSeen(m.store, 'd-572', NOW);
    expect(readSeen(m.store, NOW).dossiers).toEqual({ recent: NOW - MIN, 'd-572': NOW });
  });

  it('reads a broken value as a first run', () => {
    const m = memory({ [DOCS_SEEN_KEY]: '{nope' });
    expect(readSeen(m.store, NOW)).toEqual({ since: NOW, dossiers: {} });
  });

  it('with a storage that throws: `since` is the load time, and nothing throws', () => {
    expect(readSeen(throwing, NOW)).toEqual({ since: NOW, dossiers: {} });
    expect(() => { markSeen(throwing, 'd-572', NOW); }).not.toThrow();
    expect(() => { markSeen(() => { throw new Error('no storage'); }, 'd-572', NOW); }).not.toThrow();
  });
});

// PRD 579, s2: a PRD's new documents are announced once they settle, once per newest version.

const SEC = 1000;
const g = (prd: number, newestId: string, ago: number, kindsAt: DocumentGroup['kindsAt'] = { spec: NOW - ago }): DocumentGroup => ({
  dossierId: `d-${prd}`, prd: parsePrd(prd), title: `PRD title ${prd}`,
  kinds: (['spec', 'plan', 'before-after'] as const).filter((k) => kindsAt[k] !== undefined),
  newestId, newestAt: NOW - ago, kindsAt,
});

describe('settling', () => {
  it('holds a group whose newest version is 30 s old, and not one 29 s old', () => {
    expect(SETTLE_MS).toBe(30 * SEC);
    const quiet = g(572, 'v1', 30 * SEC);
    const busy = g(579, 'v2', 29 * SEC);
    expect(settled([quiet, busy], NOW)).toEqual([quiet]);
  });
});

describe('what to announce', () => {
  it('announces a group never announced, with all its kinds, and remembers its newest', () => {
    const group = g(572, 'v2', MIN, { spec: NOW - 2 * MIN, 'before-after': NOW - MIN });
    const { alerts, announced } = toAnnounce([group], []);
    expect(alerts).toEqual([{ group, kinds: ['spec', 'before-after'] }]);
    expect(announced).toEqual([{ id: 'v2', dossierId: 'd-572', at: NOW - MIN }]);
  });

  it('skips a newest id already announced', () => {
    const group = g(572, 'v2', MIN);
    const once = toAnnounce([group], []);
    const twice = toAnnounce([group], once.announced);
    expect(twice.alerts).toEqual([]);
    expect(twice.announced).toEqual(once.announced);
  });

  it('announces a later version of the same PRD, naming only the kinds newer than its last alert', () => {
    const first = g(572, 'v2', 3 * MIN, { spec: NOW - 4 * MIN, 'before-after': NOW - 3 * MIN });
    const { announced } = toAnnounce([first], []);
    const later = g(572, 'v3', MIN, { spec: NOW - 4 * MIN, plan: NOW - MIN, 'before-after': NOW - 3 * MIN });
    const next = toAnnounce([later], announced);
    expect(next.alerts).toEqual([{ group: later, kinds: ['plan'] }]);
    expect(next.announced.map((a) => a.id)).toEqual(['v2', 'v3']);
  });

  it('names every kind of a group that carries no time per kind', () => {
    const bare: DocumentGroup = { dossierId: 'd-1', prd: parsePrd(1), title: 't', kinds: ['spec', 'plan'], newestId: 'v1', newestAt: NOW };
    expect(sure(toAnnounce([bare], [{ id: 'v0', dossierId: 'd-1', at: NOW - MIN }]).alerts[0], 'toAnnounce([bare], [{ id: \'v0\', dossierId: \'d-1\', at:...').kinds).toEqual(['spec', 'plan']);
  });

  it('keeps the announced list at most 200 long', () => {
    expect(ANNOUNCED_KEPT).toBe(200);
    let announced: Announced = [];
    for (let i = 0; i < 250; i++) announced = toAnnounce([g(i + 1, `v${i}`, MIN)], announced).announced;
    expect(announced).toHaveLength(200);
    expect(announced.at(-1)?.id).toBe('v249');
  });
});

/** A fake of the browser's Notification that records what it raised. */
function notifier() {
  const raised: { title: string; options: NotificationOptions; onclick: (() => void) | null }[] = [];
  class Fake {
    static permission = 'granted';
    static requestPermission = () => Promise.resolve('granted');
    onclick: (() => void) | null = null;
    constructor(title: string, options: NotificationOptions) {
      Object.assign(this, { title, options });
      raised.push(this as never);
    }
  }
  return { api: Fake as unknown as NotificationApi, raised };
}

describe('announcing settled documents', () => {
  const two = [g(572, 'v2', MIN), g(579, 'v4', 2 * MIN, { plan: NOW - 2 * MIN })];
  const setup = (store = memory().store) => {
    const { api, raised } = notifier();
    const play = vi.fn();
    const opened: string[] = [];
    const input = {
      groups: two, now: NOW, store, kept: [] as Announced, desktop: 'on' as const, chime: true,
      notifications: api, play, open: (href: string) => void opened.push(href),
    };
    return { raised, play, opened, input };
  };

  it('with the switches off, raises and plays nothing', () => {
    const { raised, play, input } = setup();
    noticeDocuments({ ...input, desktop: 'off', chime: false });
    expect(raised).toEqual([]);
    expect(play).not.toHaveBeenCalled();
  });

  it('with Desktop alerts on, two settled PRDs in one read raise two notifications, each opening its page', () => {
    const { raised, opened, play, input } = setup();
    noticeDocuments({ ...input, chime: false });
    expect(raised.map((n) => [n.title, n.options.tag])).toEqual([
      ['PRD 572: new spec', 'docs-d-572-v2'],
      ['PRD 579: new plan', 'docs-d-579-v4'],
    ]);
    sure(raised[1], 'raised[1]').onclick?.();
    expect(opened).toEqual(['/prd/d-579']);
    expect(play).not.toHaveBeenCalled();
  });

  it('with Chime on, one chime plays for the read, claimed once across tabs', () => {
    const m = memory();
    const { play, input } = setup(m.store);
    noticeDocuments({ ...input, desktop: 'off' });
    expect(play).toHaveBeenCalledTimes(1);
    // A second tab on the same browser reads the same groups: nothing plays again.
    const other = vi.fn();
    noticeDocuments({ ...input, desktop: 'off', play: other });
    expect(other).not.toHaveBeenCalled();
  });

  it('holds a group still inside its 30 s', () => {
    const { raised, play, input } = setup();
    noticeDocuments({ ...input, groups: [g(572, 'v2', 10 * SEC)] });
    expect(raised).toEqual([]);
    expect(play).not.toHaveBeenCalled();
  });

  it('the first read after load announces settled groups never announced, and a reload announces nothing again', () => {
    const m = memory();
    const { raised, input } = setup(m.store);
    const kept = noticeDocuments({ ...input, chime: false });
    expect(raised).toHaveLength(2);
    expect(kept.map((a) => a.id)).toEqual(['v2', 'v4']);
    // A reload: nothing held in memory, only what the browser stored.
    noticeDocuments({ ...input, chime: false, kept: [] });
    expect(raised).toHaveLength(2);
    expect(JSON.parse(sure(m.map.get(DOCS_ANNOUNCED_KEY), 'm.map.get(DOCS_ANNOUNCED_KEY)'))).toEqual(kept);
  });

  it('with a storage that throws: remembers for the visit through what it returns, plays nothing, never throws', () => {
    const { raised, play, input } = setup(throwing);
    const kept = noticeDocuments(input);
    expect(raised).toHaveLength(2);
    expect(play).not.toHaveBeenCalled();
    noticeDocuments({ ...input, kept });
    expect(raised).toHaveLength(2);
  });
});

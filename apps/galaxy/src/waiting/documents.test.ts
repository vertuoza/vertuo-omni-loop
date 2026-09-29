import { describe, expect, it } from 'vitest';
import type { Db } from '../ask/page/source';
import {
  DOCS_DAYS, DOCS_LIMIT, DOCS_SEEN_KEY, documentsReader, groupDocuments, markSeen, readSeen,
  type DocumentRow, type Seen,
} from './documents';

// The waiting list's New documents part (PRD 579, s1): the spec, plan and before/after versions pushed
// in the last 7 days to the numbered dossiers the person opened, one group per PRD, newest first, less
// what this browser has seen.

const NOW = Date.parse('2026-09-29T10:00:00Z');
const MIN = 60_000;
const at = (ms: number) => new Date(ms).toISOString();

const row = (id: string, kind: DocumentRow['kind'], ago: number, prd = 572, dossier = `d-${prd}`): DocumentRow => ({
  id, kind, created_at: at(NOW - ago), dossier: { id: dossier, prd, title: `PRD title ${prd}` },
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
      { dossierId: 'd-572', prd: 572, title: 'PRD title 572', kinds: ['spec', 'plan', 'before-after'], newestId: 'v6', newestAt: NOW - 1 * MIN },
      { dossierId: 'd-579', prd: 579, title: 'PRD title 579', kinds: ['spec', 'before-after'], newestId: 'v4', newestAt: NOW - 3 * MIN },
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
      { dossierId: 'd-572', prd: 572, title: 'PRD title 572', kinds: ['plan'], newestId: 'v3', newestAt: NOW - MIN },
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
    expect(() => markSeen(throwing, 'd-572', NOW)).not.toThrow();
    expect(() => markSeen(() => { throw new Error('no storage'); }, 'd-572', NOW)).not.toThrow();
  });
});

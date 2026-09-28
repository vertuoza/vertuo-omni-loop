// The store and the migration agree: the store calls each function with exactly the parameters the
// migration declares, and the kinds and the cap it checks are the table's own. The rules themselves
// are proved by api.test.ts on the fake (which writes them as the migration does) and by
// supabase/checks/dossiers.sql on the database. The page's reads ask only for the columns the
// migration grants.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  ARTIFACT_MAX_BYTES, DOSSIER_COLUMNS, DOSSIER_KINDS, dossierList, dossierPulse, dossierReader, dossierRounds, dossierStore, DossierStoreError, LIST_FIELDS,
  ROUND_FIELDS, TITLE_MAX, VERSION_COLUMNS,
} from './store';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20260928090000_dossiers.sql', import.meta.url)), 'utf8');

/** The parameter names `create function public.<name>(…)` declares, in order. */
function parameters(name: string): string[] {
  const match = new RegExp(`create function public\\.${name}\\(([^)]*)\\)`).exec(MIGRATION);
  if (!match) throw new Error(`the migration declares no ${name}()`);
  return match[1].split(',').map((part) => part.trim().split(/\s+/)[0]);
}

/** A client that records each rpc call and answers `answer`. */
function recording(answer: { data: unknown; error: { code?: string; message: string } | null }) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const rpc = (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    return Promise.resolve(answer);
  };
  return { calls, db: { rpc } as never };
}

describe('the dossier store', () => {
  it('opens a draft through dossier_open(), with the migration\'s parameters', async () => {
    const { calls, db } = recording({ data: '00000000-0000-4000-8000-000000000001', error: null });
    expect(await dossierStore(db).open({ title: 'An idea', repo: 'acme/widgets', claudeSessionId: null })).toEqual({ id: '00000000-0000-4000-8000-000000000001' });
    expect(calls).toEqual([{ name: 'dossier_open', args: { p_title: 'An idea', p_repo: 'acme/widgets', p_claude_session_id: null } }]);
    expect(Object.keys(calls[0].args)).toEqual(parameters('dossier_open'));
  });

  it('pushes through dossier_push(), with the migration\'s parameters, and hands back what it did', async () => {
    const pushed = { id: '00000000-0000-4000-8000-000000000002', added: [{ kind: 'spec', version: 2 }], unchanged: ['plan'] };
    const { calls, db } = recording({ data: pushed, error: null });
    const push = { repo: 'acme/widgets', prd: 7, title: 'Team inbox', draftId: null, artifacts: [{ kind: 'spec' as const, content: 'x' }] };
    expect(await dossierStore(db).push(push)).toEqual(pushed);
    expect(Object.keys(calls[0].args)).toEqual(parameters('dossier_push'));
    expect(calls[0]).toEqual({
      name: 'dossier_push',
      args: { p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null, p_artifacts: [{ kind: 'spec', content: 'x' }] },
    });
  });

  it('turns a refusal into a DossierStoreError carrying Postgres\'s code and reason', async () => {
    const { db } = recording({ data: null, error: { code: 'P0002', message: 'No such draft dossier.' } });
    const error = await dossierStore(db).push({ repo: 'a/b', prd: 1, title: 't', draftId: null, artifacts: [] }).catch((e) => e);
    expect(error).toBeInstanceOf(DossierStoreError);
    expect(error).toMatchObject({ code: 'P0002', reason: 'No such draft dossier.' });
  });

  it('checks the kinds, the cap and the title the table checks', () => {
    expect(MIGRATION).toContain(`kind in (${DOSSIER_KINDS.map((k) => `'${k}'`).join(', ')})`);
    expect(MIGRATION).toContain(`bytes between 0 and ${ARTIFACT_MAX_BYTES}`);
    expect(MIGRATION).toContain(`char_length(title) between 1 and ${TITLE_MAX}`);
  });
});

/** The columns `grant select (…) on public.<table> to authenticated` names. */
function granted(table: string): string[] {
  const match = new RegExp(`grant select \\(([^)]*)\\)\\s+on public\\.${table} to authenticated`).exec(MIGRATION);
  if (!match) throw new Error(`the migration grants no columns of ${table}`);
  return match[1].split(',').map((column) => column.trim());
}

/** A client that records each query built on it and answers `answer`. */
function querying(answer: { data: unknown; error: { code?: string; message: string } | null }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const step of ['select', 'eq', 'order', 'limit', 'delete']) {
    builder[step] = (...args: unknown[]) => { calls.push([step, ...args]); return builder; };
  }
  builder.maybeSingle = () => { calls.push(['maybeSingle']); return Promise.resolve(answer); };
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(answer).then(resolve);
  const from = (table: string) => { calls.push(['from', table]); return builder; };
  return { calls, db: { from } as never };
}

describe('reading a dossier as its members do (the page to share)', () => {
  it('reads only the columns the migration grants the signed-in', () => {
    const dossiers = granted('dossiers');
    for (const column of DOSSIER_COLUMNS.split(', ')) expect(dossiers).toContain(column);
    const versions = granted('dossier_versions');
    for (const column of VERSION_COLUMNS.split(', ')) expect(versions).toContain(column);
    expect(versions).toContain('content');
  });

  it('reads a dossier by its id, or null when row-level security hides it', async () => {
    const { calls, db } = querying({ data: null, error: null });
    expect(await dossierReader(db).dossier('d1')).toBeNull();
    expect(calls).toEqual([['from', 'dossiers'], ['select', DOSSIER_COLUMNS], ['eq', 'id', 'd1'], ['maybeSingle']]);
  });

  it('reads the versions without their content, oldest first, as the version rule numbers them', async () => {
    const { calls, db } = querying({ data: [], error: null });
    expect(await dossierReader(db).versions('d1')).toEqual([]);
    expect(calls).toEqual([
      ['from', 'dossier_versions'], ['select', VERSION_COLUMNS], ['eq', 'dossier_id', 'd1'],
      ['order', 'created_at', { ascending: true }], ['order', 'id', { ascending: true }],
    ]);
    expect(VERSION_COLUMNS).not.toContain('content');
  });

  it('reads one version\'s content on its own', async () => {
    const { calls, db } = querying({ data: { content: '# Spec' }, error: null });
    expect(await dossierReader(db).content('v1')).toBe('# Spec');
    expect(calls).toEqual([['from', 'dossier_versions'], ['select', 'content'], ['eq', 'id', 'v1'], ['maybeSingle']]);
  });

  it('deletes a draft, and says whether anything went: row-level security decides who may', async () => {
    expect(await dossierReader(querying({ data: [{ id: 'd1' }], error: null }).db).deleteDraft('d1')).toBe(true);
    const refused = querying({ data: [], error: null });
    expect(await dossierReader(refused.db).deleteDraft('d1')).toBe(false);
    expect(refused.calls).toEqual([['from', 'dossiers'], ['delete'], ['eq', 'id', 'd1'], ['select', 'id']]);
  });

  it('finds a PRD\'s dossier by its repository, lower-cased, and its number: the most recently numbered first', async () => {
    const { calls, db } = querying({ data: [{ id: 'd2' }], error: null });
    expect(await dossierReader(db).numbered('Acme/Widgets', 7)).toBe('d2');
    expect(calls).toEqual([
      ['from', 'dossiers'], ['select', 'id'], ['eq', 'home_repo', 'acme/widgets'], ['eq', 'prd', 7],
      ['order', 'numbered_at', { ascending: false, nullsFirst: false }], ['order', 'id', { ascending: true }], ['limit', 1],
    ]);
  });

  it('finds no dossier when row-level security hides every row, or there is none', async () => {
    expect(await dossierReader(querying({ data: [], error: null }).db).numbered('acme/widgets', 7)).toBeNull();
    expect(await dossierReader(querying({ data: null, error: null }).db).numbered('acme/widgets', 7)).toBeNull();
  });

  it('turns a failed read into a DossierStoreError', async () => {
    const error = await dossierReader(querying({ data: null, error: { code: '42501', message: 'permission denied' } }).db).dossier('d1').catch((e) => e);
    expect(error).toBeInstanceOf(DossierStoreError);
    expect(error).toMatchObject({ code: '42501' });
  });
});

// ── The questions that shaped it (PRD 216, step 3) ──────────────────────────────

const ROUNDS_MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20260928100000_dossier_rounds.sql', import.meta.url)), 'utf8');

describe('reading a dossier\'s rounds', () => {
  it('calls dossier_rounds() with the migration\'s parameter, and hands back its rows', async () => {
    const row = { rule: 'brainstorm', round_id: 'r1' };
    const { calls, db } = recording({ data: [row], error: null });
    expect(await dossierRounds(db, 'd1')).toEqual([row]);
    expect(calls).toEqual([{ name: 'dossier_rounds', args: { p_dossier: 'd1' } }]);
    const declared = /create function public\.dossier_rounds\(([^)]*)\)/.exec(ROUNDS_MIGRATION)?.[1].split(',').map((p) => p.trim().split(/\s+/)[0]);
    expect(Object.keys(calls[0].args)).toEqual(declared);
  });

  it('expects exactly the columns the function returns', () => {
    const table = /returns table \(([\s\S]*?)\)\s*language/.exec(ROUNDS_MIGRATION)?.[1] ?? '';
    const returned = table.split(',').map((line) => line.trim().split(/\s+/)[0]).filter(Boolean);
    expect([...ROUND_FIELDS]).toEqual(returned);
    expect(ROUNDS_MIGRATION).toContain('security invoker');
  });

  it('reads no rows as none, and turns a failure into a DossierStoreError', async () => {
    expect(await dossierRounds(recording({ data: null, error: null }).db, 'd1')).toEqual([]);
    const error = await dossierRounds(recording({ data: null, error: { code: '42883', message: 'no such function' } }).db, 'd1').catch((e) => e);
    expect(error).toBeInstanceOf(DossierStoreError);
    expect(error).toMatchObject({ code: '42883' });
  });
});

// ── The history (PRD 216, step 4) ───────────────────────────────────────────────

const LIST_MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20260928110000_dossier_list.sql', import.meta.url)), 'utf8');

describe('reading the history', () => {
  it('calls dossier_list() with the migration\'s parameter: every dossier, or one', async () => {
    const row = { id: 'd1', repos: ['acme/widgets'] };
    const { calls, db } = recording({ data: [row], error: null });
    expect(await dossierList(db)).toEqual([row]);
    expect(await dossierList(db, 'd1')).toEqual([row]);
    expect(calls).toEqual([
      { name: 'dossier_list', args: { p_dossier: null } },
      { name: 'dossier_list', args: { p_dossier: 'd1' } },
    ]);
    const declared = /create function public\.dossier_list\(([^)]*)\)/.exec(LIST_MIGRATION)?.[1].split(',').map((p) => p.trim().split(/\s+/)[0]);
    expect(Object.keys(calls[0].args)).toEqual(declared);
  });

  it('expects exactly the columns the function returns, and it runs as its caller on dossier_rounds()', () => {
    const table = /returns table \(([\s\S]*?)\)\s*language/.exec(LIST_MIGRATION)?.[1] ?? '';
    const returned = table.split(',').map((line) => line.trim().split(/\s+/)[0]).filter(Boolean);
    expect([...LIST_FIELDS]).toEqual(returned);
    expect(LIST_MIGRATION).toContain('security invoker');
    expect(LIST_MIGRATION).toContain('public.dossier_rounds(d.id)');
  });

  it('reads no rows as none, and turns a failure into a DossierStoreError', async () => {
    expect(await dossierList(recording({ data: null, error: null }).db)).toEqual([]);
    const error = await dossierList(recording({ data: null, error: { code: '42501', message: 'permission denied' } }).db).catch((e) => e);
    expect(error).toBeInstanceOf(DossierStoreError);
    expect(error).toMatchObject({ code: '42501' });
  });
});

// ── The change check (PRD 384, part 5) ──────────────────────────────────────────

describe('reading the change check', () => {
  it('reads one dossier\'s counts and latest version numbers in one dossier_list() call', async () => {
    const row = {
      id: 'd1', repos: ['acme/widgets'], asked: 3, answered: 2,
      latest: { spec: { id: 'v1', version: 2, source: 'kit', created_at: 'x' }, 'before-after': { id: 'v2', version: 1, source: 'kit', created_at: 'x' } },
    };
    const { calls, db } = recording({ data: [row], error: null });
    expect(await dossierPulse(db, 'd1')).toEqual({ asked: 3, answered: 2, latest: { spec: 2, 'before-after': 1 } });
    expect(calls).toEqual([{ name: 'dossier_list', args: { p_dossier: 'd1' } }]);
  });

  it('reads a dossier the caller may not read as null, and turns a failure into a DossierStoreError', async () => {
    expect(await dossierPulse(recording({ data: [], error: null }).db, 'd1')).toBeNull();
    const error = await dossierPulse(recording({ data: null, error: { message: 'down' } }).db, 'd1').catch((e) => e);
    expect(error).toBeInstanceOf(DossierStoreError);
  });
});

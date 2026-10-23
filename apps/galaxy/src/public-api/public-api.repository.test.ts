import { describe, expect, it } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { decodeCursor, encodeCursor } from './cursor';
import { dossierId, momentOf, NORTHWIND, SOUTHWIND } from './fixtures/public-api.fake';
import { publicApiRepository, type PublicApiDb } from './public-api.repository';

// The public API's storage (PRD 2022 s2) on a client that records each call and answers it from rows in
// memory, reading the filters as PostgREST reads them, the keyset's `or` included: the repository's
// own query pages 120 rows by 50, with rows added between pages, and returns each exactly once.

type Row = Record<string, unknown>;
type Answer = { data: unknown; error: { message: string } | null };
type Test = (row: Row) => boolean;

/** The keyset filter, as PostgREST reads `created_at.lt."t",and(created_at.eq."t",id.lt."i")`; times compare
 * as the fixture writes them. */
function keyset(filter: string): Test {
  const read = /^created_at\.lt\."([^"]+)",and\(created_at\.eq\."([^"]+)",id\.lt\."([^"]+)"\)$/.exec(filter);
  if (!read || read[1] !== read[2]) throw new Error(`the fake reads no ${filter}`);
  const [, at = '', , id = ''] = read;
  return (row) => String(row.created_at) < at || (row.created_at === at && String(row.id) < id);
}

/** How the database orders two values of a column: numbers as numbers, anything else as text. */
function compare(p: unknown, q: unknown): number {
  if (typeof p === 'number' && typeof q === 'number') return p - q;
  const [x, y] = [String(p), String(q)];
  return x === y ? 0 : x < y ? -1 : 1;
}

function evaluating(tables: Record<string, Row[]>, rpc: Record<string, unknown> = {}) {
  const calls: unknown[][] = [];
  const query = (table: string) => {
    const tests: Test[] = [];
    const steps: unknown[] = [];
    let columns: string[] = [];
    let orders: { column: string; ascending: boolean }[] = [];
    let take = Infinity;
    const run = (): Answer => {
      calls.push([table, ...steps]);
      const rows = (tables[table] ?? []).filter((row) => tests.every((t) => t(row)));
      rows.sort((a, b) => {
        for (const { column, ascending } of orders) {
          const order = compare(a[column], b[column]);
          if (order !== 0) return order * (ascending ? 1 : -1);
        }
        return 0;
      });
      return { data: rows.slice(0, take).map((row) => Object.fromEntries(columns.map((c) => [c, row[c]]))), error: null };
    };
    const builder = {
      select: (cols: string) => { steps.push(['select', cols]); columns = cols.split(',').map((c) => c.trim()); return builder; },
      eq: (column: string, value: unknown) => { steps.push(['eq', column, value]); tests.push((row) => row[column] === value); return builder; },
      in: (column: string, values: unknown[]) => { steps.push(['in', column, values]); tests.push((row) => values.includes(row[column])); return builder; },
      gt: (column: string, value: number) => { steps.push(['gt', column, value]); tests.push((row) => compare(row[column], value) > 0); return builder; },
      not: (column: string, op: string, value: unknown) => {
        steps.push(['not', column, op, value]);
        tests.push((row) => row[column] !== null && row[column] !== undefined);
        return builder;
      },
      or: (filter: string) => { steps.push(['or', filter]); tests.push(keyset(filter)); return builder; },
      order: (column: string, options: { ascending: boolean }) => { steps.push(['order', column, options]); orders = [...orders, { column, ascending: options.ascending }]; return builder; },
      limit: (n: number) => { steps.push(['limit', n]); take = n; return builder; },
      then: (resolve: (answer: Answer) => unknown) => Promise.resolve(run()).then(resolve),
    };
    return builder;
  };
  const db = {
    from: query,
    rpc: (fn: string, args: unknown) => { calls.push(['rpc', fn, args]); return Promise.resolve({ data: rpc[fn] ?? null, error: null }); },
  } as unknown as PublicApiDb;
  return { db, calls };
}

function dossier(n: number, more: Row = {}): Row {
  return {
    id: dossierId(n), workspace_id: NORTHWIND, kind: 'prd', prd: n, product_seq: null, product_id: null, title: `PRD ${n}`,
    home_repo: 'northwind/backend', created_at: momentOf(n), numbered_at: momentOf(n), ...more,
  };
}

describe('the public API’s repository', () => {
  it('reads one page of the workspace’s numbered dossiers of a kind, newest first, by the keyset', async () => {
    const { db, calls } = evaluating({ dossiers: [] });
    await publicApiRepository(db).dossiers({
      workspace: NORTHWIND, kind: 'bug', repos: ['northwind/backend'], after: { createdAt: momentOf(9), id: dossierId(9) }, take: 51,
    });
    expect(calls).toEqual([[
      'dossiers',
      ['select', 'id, prd, product_seq, product_id, title, home_repo, created_at'],
      ['eq', 'workspace_id', NORTHWIND],
      ['eq', 'kind', 'bug'],
      ['not', 'numbered_at', 'is', null],
      ['in', 'home_repo', ['northwind/backend']],
      ['or', `created_at.lt."${momentOf(9)}",and(created_at.eq."${momentOf(9)}",id.lt."${dossierId(9)}")`],
      ['order', 'created_at', { ascending: false }],
      ['order', 'id', { ascending: false }],
      ['limit', 51],
    ]]);
  });

  it('filters no repository for a key with an empty allow-list, and no keyset on the first page', async () => {
    const { db, calls } = evaluating({ dossiers: [] });
    await publicApiRepository(db).dossiers({ workspace: NORTHWIND, kind: 'prd', repos: [], after: null, take: 51 });
    expect(JSON.stringify(calls)).not.toMatch(/"in"|"or"/);
  });

  it('keeps the other workspace, drafts and other kinds out', async () => {
    const rows = [
      dossier(1), dossier(2, { workspace_id: SOUTHWIND }), dossier(3, { prd: null, numbered_at: null }), dossier(4, { kind: 'bug' }),
      dossier(5, { home_repo: 'northwind/web' }),
    ];
    const { db } = evaluating({ dossiers: rows });
    const read = await publicApiRepository(db).dossiers({ workspace: NORTHWIND, kind: 'prd', repos: ['northwind/backend'], after: null, take: 10 });
    expect(read.map((r) => r.id)).toEqual([dossierId(1)]);
  });

  it('pages 120 rows by 50 with rows added between pages, each exactly once', async () => {
    const rows = [...Array(120).keys()].map((i) => dossier(i + 1));
    const { db } = evaluating({ dossiers: rows });
    const repository = publicApiRepository(db);
    const seen: string[] = [];
    let after: { createdAt: string; id: string } | null = null;
    for (let page = 0; page < 5; page += 1) {
      const read = await repository.dossiers({ workspace: NORTHWIND, kind: 'prd', repos: [], after, take: 51 });
      const kept = read.slice(0, 50);
      seen.push(...kept.map((r) => r.id));
      const last = kept.at(-1);
      if (read.length <= 50 || !last) break;
      // A cursor goes out and comes back: the time is the database's, to the microsecond.
      after = decodeCursor(encodeCursor({ list: 'prds', createdAt: last.created_at, id: last.id }), 'prds');
      rows.push(dossier(200 + page));
    }
    expect(seen).toEqual(rows.slice(0, 120).reverse().map((r) => r.id));
  });

  it('parses each dossier where it comes in', async () => {
    const { db } = evaluating({ dossiers: [dossier(1)] });
    expect(await publicApiRepository(db).dossiers({ workspace: NORTHWIND, kind: 'prd', repos: [], after: null, take: 1 })).toEqual([{
      id: dossierId(1), prd: 1, product_seq: null, product_id: null, title: 'PRD 1', home_repo: 'northwind/backend', created_at: momentOf(1),
    }]);
    const broken = evaluating({ dossiers: [dossier(1, { prd: 'one' })] });
    await expect(publicApiRepository(broken.db).dossiers({ workspace: NORTHWIND, kind: 'prd', repos: [], after: null, take: 1 })).rejects.toThrow();
  });

  it('asks api_key_of() with the hash, and reads its key or nothing', async () => {
    const key = { key_id: 'k-1', workspace_id: NORTHWIND, repos: ['northwind/backend'], made_by: 'u-1', name: 'QA dashboard' };
    const live = evaluating({}, { api_key_of: key });
    expect(await publicApiRepository(live.db).keyOf('f'.repeat(64))).toEqual(key);
    expect(live.calls).toEqual([['rpc', 'api_key_of', { p_hash: 'f'.repeat(64) }]]);
    expect(await publicApiRepository(evaluating({}).db).keyOf('f'.repeat(64))).toBeNull();
  });

  it('throws, naming the call, when the database refuses', async () => {
    const db = {
      rpc: () => Promise.resolve({ data: null, error: { message: 'permission denied for function api_key_of' } }),
    } as unknown as PublicApiDb;
    await expect(publicApiRepository(db).keyOf('f'.repeat(64))).rejects.toThrow('api_key_of: permission denied for function api_key_of');
  });

  it('reads the workspace’s products among the ids, and none for no id', async () => {
    const { db, calls } = evaluating({
      products: [
        { id: 'p-1', workspace_id: NORTHWIND, key: 'mobile', name: 'Mobile' },
        { id: 'p-2', workspace_id: SOUTHWIND, key: 'web', name: 'Web' },
      ],
    });
    const repository = publicApiRepository(db);
    expect(await repository.products(NORTHWIND, ['p-1', 'p-2'])).toEqual([{ id: 'p-1', key: 'mobile', name: 'Mobile' }]);
    expect(await repository.products(NORTHWIND, [])).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('reads the stages of one repository’s PRDs in the workspace, and none for no PRD', async () => {
    const { db, calls } = evaluating({
      prd_stages: [
        { workspace_id: NORTHWIND, repository: 'northwind/backend', prd: 7, stage: 'inbox' },
        { workspace_id: NORTHWIND, repository: 'northwind/web', prd: 7, stage: 'retro' },
        { workspace_id: SOUTHWIND, repository: 'northwind/backend', prd: 7, stage: 'shipped' },
        { workspace_id: NORTHWIND, repository: 'northwind/backend', prd: 8, stage: 'prd' },
      ],
    });
    const repository = publicApiRepository(db);
    expect(await repository.stages(NORTHWIND, 'northwind/backend', [parsePrd(7)])).toEqual([{ repository: 'northwind/backend', prd: 7, stage: 'inbox' }]);
    expect(await repository.stages(NORTHWIND, 'northwind/backend', [])).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('reads whether a product of the workspace names a repository as its plan repository', async () => {
    const { db, calls } = evaluating({
      products: [
        { id: 'p-1', workspace_id: NORTHWIND, key: 'web', name: 'Web', plan_repository: 'northwind/plan' },
        { id: 'p-2', workspace_id: NORTHWIND, key: 'mobile', name: 'Mobile', plan_repository: null },
        { id: 'p-3', workspace_id: SOUTHWIND, key: 'web', name: 'Web', plan_repository: 'southwind/plan' },
      ],
    });
    const repository = publicApiRepository(db);
    expect(await repository.isPlanRepository(NORTHWIND, 'northwind/plan')).toBe(true);
    expect(await repository.isPlanRepository(NORTHWIND, 'northwind/backend')).toBe(false);
    expect(await repository.isPlanRepository(NORTHWIND, 'southwind/plan')).toBe(false);
    expect(calls[0]).toEqual(['products', ['select', 'id'], ['eq', 'workspace_id', NORTHWIND], ['eq', 'plan_repository', 'northwind/plan'], ['limit', 1]]);
  });

  describe('a job’s lines (PRD 2425 s4)', () => {
    const JOB = '0b4c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3';
    const OTHER = '1c4d2e3f-4051-4b6c-9d7e-8f90a1b2c3d4';
    const line = (job: string, seq: number, more: Row = {}): Row => ({ job_id: job, workspace_id: NORTHWIND, seq, text: `line ${String(seq)}`, ...more });

    it('reads the first lines of the job after a sequence number, oldest first, in its workspace', async () => {
      const { db, calls } = evaluating({ runner_job_lines: [] });
      await publicApiRepository(db).jobLines({ workspace: NORTHWIND, job: JOB, after: 50, take: 51 });
      expect(calls).toEqual([[
        'runner_job_lines',
        ['select', 'seq, text'],
        ['eq', 'workspace_id', NORTHWIND],
        ['eq', 'job_id', JOB],
        ['gt', 'seq', 50],
        ['order', 'seq', { ascending: true }],
        ['limit', 51],
      ]]);
    });

    it('keeps another job’s lines and another workspace’s out, and orders the sequence numbers as numbers', async () => {
      const rows = [
        ...[12, 3, 10, 9, 1, 11, 2].map((seq) => line(JOB, seq)),
        line(OTHER, 5), line(JOB, 6, { workspace_id: SOUTHWIND }),
      ];
      const { db } = evaluating({ runner_job_lines: rows });
      const repository = publicApiRepository(db);
      expect(await repository.jobLines({ workspace: NORTHWIND, job: JOB, after: 0, take: 20 })).toEqual(
        [1, 2, 3, 9, 10, 11, 12].map((seq) => ({ seq, text: `line ${String(seq)}` })),
      );
      expect((await repository.jobLines({ workspace: NORTHWIND, job: JOB, after: 3, take: 3 })).map((l) => l.seq)).toEqual([9, 10, 11]);
    });

    it('pages 120 lines by 50, each exactly once and in order', async () => {
      const { db } = evaluating({ runner_job_lines: [...Array(120).keys()].map((i) => line(JOB, i + 1)) });
      const repository = publicApiRepository(db);
      const seen: number[] = [];
      let after = 0;
      for (let page = 0; page < 5; page += 1) {
        const read = await repository.jobLines({ workspace: NORTHWIND, job: JOB, after, take: 51 });
        const kept = read.slice(0, 50);
        seen.push(...kept.map((l) => l.seq));
        const last = kept.at(-1);
        if (read.length <= 50 || !last) break;
        after = last.seq;
      }
      expect(seen).toEqual([...Array(120).keys()].map((i) => i + 1));
    });

    it('reads none for a job that holds none, as one past the retention', async () => {
      const { db } = evaluating({ runner_job_lines: [line(OTHER, 1)] });
      expect(await publicApiRepository(db).jobLines({ workspace: NORTHWIND, job: JOB, after: 0, take: 51 })).toEqual([]);
    });

    it('parses each line where it comes in, and throws, naming the call, when the database refuses', async () => {
      const broken = evaluating({ runner_job_lines: [line(JOB, 1, { text: 3 })] });
      await expect(publicApiRepository(broken.db).jobLines({ workspace: NORTHWIND, job: JOB, after: 0, take: 1 })).rejects.toThrow();
      const refused = {
        from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ gt: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'permission denied for table runner_job_lines' } }) }) }) }) }) }) }),
      } as unknown as PublicApiDb;
      await expect(publicApiRepository(refused).jobLines({ workspace: NORTHWIND, job: JOB, after: 0, take: 1 })).rejects.toThrow('runner_job_lines: permission denied for table runner_job_lines');
    });
  });

  describe('a key’s GitHub App (PRD 2433 s6)', () => {
    const OPENED = { app_id: 123456, slug: 'acme-bot', bot_id: 777, ciphertext: 'c2VhbGVk', iv: 'aXY=' };

    it('asks which keys hold an App by key_id alone, then opens the one that does', async () => {
      const held = evaluating({ api_key_github_apps: [{ key_id: 'k-1', ciphertext: 'never-selected' }] }, { api_key_github_app_of_key: { working: true, app: OPENED } });
      expect(await publicApiRepository(held.db).githubAppOf('k-1')).toEqual({ appId: 123456, slug: 'acme-bot', ciphertext: 'c2VhbGVk', iv: 'aXY=' });
      expect(held.calls).toEqual([
        ['api_key_github_apps', ['select', 'key_id'], ['eq', 'key_id', 'k-1'], ['limit', 1]],
        ['rpc', 'api_key_github_app_of_key', { p_key: 'k-1' }],
      ]);
    });

    it('opens nothing for a key that holds no App, so a key with none never reaches the function that opens one', async () => {
      const other = evaluating({ api_key_github_apps: [{ key_id: 'k-2' }] }, { api_key_github_app_of_key: { working: true, app: OPENED } });
      expect(await publicApiRepository(other.db).githubAppOf('k-1')).toBeNull();
      expect(other.calls).toHaveLength(1);
    });

    it('reads no App when the key lost it between the two reads', async () => {
      const gone = evaluating({ api_key_github_apps: [{ key_id: 'k-1' }] }, { api_key_github_app_of_key: { working: true, app: null } });
      expect(await publicApiRepository(gone.db).githubAppOf('k-1')).toBeNull();
    });

    it('throws, naming the call, when the function that opens the key is refused, missing or out of shape', async () => {
      const { db: tables } = evaluating({ api_key_github_apps: [{ key_id: 'k-1' }] });
      const refused = { from: tables.from, rpc: () => Promise.resolve({ data: null, error: { message: 'Could not find the function public.api_key_github_app_of_key' } }) } as unknown as PublicApiDb;
      await expect(publicApiRepository(refused).githubAppOf('k-1')).rejects.toThrow('api_key_github_app_of_key: Could not find the function');
      const odd = evaluating({ api_key_github_apps: [{ key_id: 'k-1' }] }, { api_key_github_app_of_key: { app: { ...OPENED, ciphertext: '' } } });
      await expect(publicApiRepository(odd.db).githubAppOf('k-1')).rejects.toThrow();
    });
  });
});

// `pnpm schemas:verify` (PRD 1030), on fixtures: the boundary files of scripts/schemas-verify.fixtures/
// run through the script's own loader against a stand-in for PostgREST, so no test calls Supabase. The
// live runs (`--local` in the `supabase` workflow, `--production` once before a feature PR is ready)
// are the script's, not the suite's.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { readOnlyClient } from '../apps/galaxy/src/data/parse-rows-client.ts';
import { isBoundaryFile, loadBoundaries, localTarget, parseArgs, productionTarget, verifyBoundary, verifyFiles } from './schemas-verify.ts';
import { boundaries as fleets } from './schemas-verify.fixtures/fleets.ts';
import { boundaries as drifted } from './schemas-verify.fixtures/fleets-drifted.ts';

const FIXTURES = 'scripts/schemas-verify.fixtures';

// The rows the demo seed holds, as PostgREST answers them: `teams` has fleets, `jev_calls` none.
const TABLES: Record<string, unknown[]> = {
  teams: [
    { name: 'beaver', label: 'BEAVER', sort: 10, retired_at: null },
    { name: 'octopod', label: 'OCTOPOD', sort: 20, retired_at: '2026-10-01T00:00:00+00:00' },
  ],
  jev_calls: [],
};

/** A stand-in for PostgREST: a table's rows, cut to the columns and the limit the read names, or a 400 for a column it lacks. */
const postgrest = vi.fn<typeof fetch>(async (input) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const rows = TABLES[url.pathname.replace('/rest/v1/', '')] ?? [];
  const columns = (url.searchParams.get('select') ?? '').split(',').map((c) => c.trim());
  const unknown = columns.find((c) => rows.some((row) => typeof row === 'object' && row !== null && !(c in row)));
  if (unknown) return Response.json({ message: `column teams.${unknown} does not exist` }, { status: 400 });
  const limit = url.searchParams.get('limit');
  const cut = rows.slice(0, limit === null ? undefined : Number(limit)).map((row) => Object.fromEntries(columns.map((c) => [c, typeof row === 'object' && row !== null ? Reflect.get(row, c) : null])));
  return Response.json(cut);
});
const db = readOnlyClient('http://db.test', 'service-role', postgrest);

describe('parseArgs', () => {
  it('reads one target, a workdir for the local one, and the files to run', () => {
    expect(parseArgs(['--local'])).toEqual({ ok: true, value: { target: 'local', workdir: null, files: [] } });
    expect(parseArgs(['--local', '--workdir', 'tmp/sb', 'a.boundary.ts'])).toEqual({ ok: true, value: { target: 'local', workdir: 'tmp/sb', files: ['a.boundary.ts'] } });
    expect(parseArgs(['--production'])).toEqual({ ok: true, value: { target: 'production', workdir: null, files: [] } });
  });

  it('refuses no target, both, an unknown flag, a workdir with no value or for production', () => {
    for (const argv of [[], ['--local', '--production'], ['--local', '--fast'], ['--local', '--workdir'], ['--production', '--workdir', 'x']]) {
      expect(parseArgs(argv).ok).toBe(false);
    }
  });
});

describe('isBoundaryFile', () => {
  it('finds a module\'s *.boundary.ts, and nothing else', () => {
    expect(isBoundaryFile('apps/galaxy/src/jev/store.boundary.ts')).toBe(true);
    expect(isBoundaryFile('apps/galaxy/src/jev/store.boundary.test.ts')).toBe(false);
    expect(isBoundaryFile('apps/galaxy/src/jev/store.ts')).toBe(false);
    expect(isBoundaryFile(`${FIXTURES}/fleets.ts`)).toBe(false);
  });
});

describe('localTarget and productionTarget', () => {
  it("reads the local stack's API and service role key from `supabase status -o json`", () => {
    expect(localTarget('{"API_URL":"http://127.0.0.1:54321","SERVICE_ROLE_KEY":"k","DB_URL":"x"}')).toEqual({ ok: true, value: { url: 'http://127.0.0.1:54321', key: 'k' } });
    const noKey = localTarget('{"API_URL":"http://127.0.0.1:54321"}');
    expect(noKey.ok ? '' : noKey.error).toContain('supabase start');
    expect(localTarget('not json').ok).toBe(false);
  });

  it("reads production's URL and service role key from the environment, and names what is missing", () => {
    expect(productionTarget({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' })).toEqual({ ok: true, value: { url: 'https://p.supabase.co', key: 'k' } });
    expect(productionTarget({ NEXT_PUBLIC_SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }).ok).toBe(true);
    const none = productionTarget({});
    expect(none.ok ? '' : none.error).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});

describe('verifyBoundary', () => {
  it('passes a read whose rows parse, counting them', async () => {
    expect(await verifyBoundary(fleets[0]!, db)).toEqual({ status: 'ok', line: 'ok     fixtures/fleets: teams (2 rows)' });
  });

  it('names a read the database leaves empty, which parsed nothing', async () => {
    expect(await verifyBoundary(fleets[1]!, db)).toEqual({ status: 'empty', line: 'empty  fixtures/fleets: jev_calls: no row to parse' });
  });

  it('fails a read whose rows do not parse, naming the zod path', async () => {
    const outcome = await verifyBoundary(drifted[0]!, db);
    expect(outcome).toEqual({ status: 'fail', line: 'FAIL   fixtures/fleets-drifted: teams: the answer does not parse: [0].sort invalid_type (expected string); [1].sort invalid_type (expected string)' });
  });

  it('fails a single-row read that does not parse', async () => {
    const outcome = await verifyBoundary(drifted[1]!, db);
    expect(outcome.status).toBe('fail');
    expect(outcome.line).toContain('fixtures/fleets-drifted: the oldest fleet: the answer does not parse: sort invalid_type');
  });

  it('fails a read the database refuses, and one that throws or writes', async () => {
    const missing = await verifyBoundary({ ...fleets[0]!, read: (d) => d.from('teams').select('name, nickname') }, db);
    expect(missing).toEqual({ status: 'fail', line: 'FAIL   fixtures/fleets: teams: the read failed: column teams.nickname does not exist' });
    const thrown = await verifyBoundary({ ...fleets[0]!, read: () => { throw new Error('no port'); } }, db);
    expect(thrown).toEqual({ status: 'fail', line: 'FAIL   fixtures/fleets: teams: the read threw: no port' });
    const writes = await verifyBoundary({ ...fleets[0]!, read: (d) => d.from('teams').delete().eq('name', 'beaver') }, db);
    expect(writes.line).toContain('schemas:verify only reads: a DELETE was refused');
  });
});

describe('loadBoundaries', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'schemas-verify-'));
  afterAll(() => { rmSync(scratch, { recursive: true, force: true }); });

  it("loads a file's boundaries through the same transform the tests use", async () => {
    const loaded = await loadBoundaries(`${FIXTURES}/fleets.ts`);
    expect(loaded.ok && loaded.value.map((b) => [b.name, b.shape])).toEqual([['fixtures/fleets: teams', 'rows'], ['fixtures/fleets: jev_calls', 'rows']]);
  });

  it('refuses a file that exports no boundaries, naming it', async () => {
    expect(await loadBoundaries(`${FIXTURES}/no-boundaries.ts`)).toEqual({ ok: false, error: `${FIXTURES}/no-boundaries.ts: exports no boundaries: the answer does not parse: boundaries invalid_type (expected array)` });
  });

  it("loads a module marked server-only, as a store of the arcade's server is", async () => {
    const file = join(scratch, 'server.boundary.ts');
    // Outside the repository, so zod is named by where it lies.
    writeFileSync(file, `import 'server-only';\nimport { z } from '${import.meta.resolve('zod')}';\n` + "export const boundaries = [{ name: 'server', read: async () => ({ data: [], error: null }), schema: z.object({}), shape: 'rows' }];\n");
    const loaded = await loadBoundaries(file);
    expect(loaded.ok ? loaded.value.map((b) => b.name) : loaded.error).toEqual(['server']);
  });
});

describe('verifyFiles', () => {
  it('reports each read and fails when any read or file fails', async () => {
    const report = await verifyFiles([`${FIXTURES}/fleets.ts`, `${FIXTURES}/fleets-drifted.ts`, `${FIXTURES}/no-boundaries.ts`], db);
    expect(report.failed).toBe(true);
    expect(report.lines).toEqual([
      'ok     fixtures/fleets: teams (2 rows)',
      'empty  fixtures/fleets: jev_calls: no row to parse',
      expect.stringMatching(/^FAIL {3}fixtures\/fleets-drifted: teams: the answer does not parse/),
      expect.stringMatching(/^FAIL {3}fixtures\/fleets-drifted: the oldest fleet: the answer does not parse/),
      `FAIL   ${FIXTURES}/no-boundaries.ts: exports no boundaries: the answer does not parse: boundaries invalid_type (expected array)`,
      '4 reads in 3 files: 1 parsed, 1 empty, 3 failed',
    ]);
  });

  it('passes when every read parses, an empty one included', async () => {
    const report = await verifyFiles([`${FIXTURES}/fleets.ts`], db);
    expect(report).toEqual({ failed: false, lines: ['ok     fixtures/fleets: teams (2 rows)', 'empty  fixtures/fleets: jev_calls: no row to parse', '2 reads in 1 file: 1 parsed, 1 empty, 0 failed'] });
  });

  it('passes, saying so, when no file registers a read yet', async () => {
    expect(await verifyFiles([], db)).toEqual({ failed: false, lines: ['no *.boundary.ts file is tracked: nothing to verify'] });
  });
});

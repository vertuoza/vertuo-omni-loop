#!/usr/bin/env node
// pnpm schemas:verify --local [--workdir <dir>] [<file>…] | --production [<file>…] — the safety net of
// PRD 1030. Every module that parses its Supabase reads with a zod schema registers those reads in a
// file beside it named `*.boundary.ts` (the `Boundary` type, apps/galaxy/src/data/parse-rows.ts). This
// finds every such file git tracks (or runs only the files named), runs each read against a real
// database, and parses its answer with the module's own schema, as the module does. It prints one
// line per read: `ok` with its count of rows, `empty` for a read the database holds no row for (so a
// boundary the seed never reaches is seen, not silently passed), or `FAIL` with the zod path of each
// mismatch, never a row's values.
//
// --local       the local stack (`supabase start`: the API is needed, not only the database), its URL
//               and service role key read from `supabase status -o json` (`--workdir` is passed on).
//               The `supabase` workflow runs it on every pull request that touches a schema.
// --production  SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY, from the
//               environment or apps/galaxy/.env.local; run once before a feature PR is marked ready.
//
// It only reads, whichever the target: the client refuses any request but a GET, and PostgREST runs a
// GET in a read-only transaction (apps/galaxy/src/data/parse-rows-client.ts). It is a script, not a
// test: `pnpm test` never calls Supabase.
//
// Exit codes: 0 every read parsed (or was empty), 1 a mismatch, a read or a file that failed, or a
// bad argument.
import { spawnSync } from 'node:child_process';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs as parseFlags } from 'node:util';
import { runnerImport, type Plugin } from 'vite';
import { z } from 'zod';
import { EnvError, processEnv, readEnv, requireGroup, SUPABASE, type EnvSource } from '../kit/lib/env/read.ts';
import { readOnlyClient } from '../apps/galaxy/src/data/parse-rows-client.ts';
import { parseRow, parseRows, type Boundary, type Parsed } from '../apps/galaxy/src/data/parse-rows.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const USAGE = 'usage: pnpm schemas:verify --local [--workdir <dir>] [<file>…] | --production [<file>…]';

type Db = Parameters<Boundary['read']>[0];
type Args = { target: 'local' | 'production'; workdir: string | null; files: string[] };
type Target = { url: string; key: string };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const failed = (error: string): { ok: false; error: string } => ({ ok: false, error });
const quiet = (): void => undefined;
const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** The command line: one target, a workdir for the local one, and the files to run (none: every one). */
export function parseArgs(argv: readonly string[]): Parsed<Args> {
  let read;
  try {
    read = parseFlags({
      args: [...argv],
      options: { local: { type: 'boolean' }, production: { type: 'boolean' }, workdir: { type: 'string' } },
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    return failed(messageOf(err));
  }
  const { local = false, production = false, workdir = null } = read.values;
  if (local === production) return failed('name one target, --local or --production');
  if (workdir !== null && production) return failed('--workdir is for --local only');
  return ok({ target: local ? 'local' : 'production', workdir, files: read.positionals });
}

/** A module's boundary file: `<module>.boundary.ts`, never a test. */
export function isBoundaryFile(path: string): boolean {
  return /[^/]\.boundary\.ts$/.test(path);
}

/** Every boundary file git tracks, from the root. */
function trackedBoundaryFiles(): string[] {
  const listed = spawnSync('git', ['ls-files', '-z', '--', '*.boundary.ts'], { cwd: ROOT, encoding: 'utf8' });
  return listed.stdout.split('\0').filter(isBoundaryFile);
}

const Status = z.object({ API_URL: z.string().min(1), SERVICE_ROLE_KEY: z.string().min(1) });

/** The local stack's API and service role key, from what `supabase status -o json` printed. */
export function localTarget(statusJson: string): Parsed<Target> {
  let status: unknown;
  try {
    status = JSON.parse(statusJson);
  } catch {
    return failed('supabase status printed no JSON: is the local stack running (`supabase start`)?');
  }
  const read = Status.safeParse(status);
  if (!read.success) return failed('supabase status names no API URL and service role key: start the local stack with its API and auth (`supabase start`)');
  return ok({ url: read.data.API_URL, key: read.data.SERVICE_ROLE_KEY });
}

/** Production's URL and service role key, from the environment, or what is unset or wrong there. */
export function productionTarget(env: EnvSource): Parsed<Target> {
  try {
    return ok(requireGroup(readEnv(env).supabase, SUPABASE, '--production reads them, from the environment or apps/galaxy/.env.local'));
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    return failed(error.message);
  }
}

function connect(args: Args): Parsed<Target> {
  if (args.target === 'production') return productionTarget(processEnv());
  const status = spawnSync('supabase', ['status', '-o', 'json', ...(args.workdir ? ['--workdir', args.workdir] : [])], { cwd: ROOT, encoding: 'utf8' });
  if (status.error) return failed(`supabase status: ${status.error.message}`);
  return localTarget(status.stdout);
}

// What a boundary file must export. Its read and its schema are checked for what they are (a
// function, a zod schema); the read's answer is parsed again when it comes back.
const LoadedBoundary = z.strictObject({
  name: z.string().min(1),
  read: z.custom<Boundary['read']>((value) => typeof value === 'function', 'a function of the database'),
  schema: z.custom<z.ZodType>((value) => value instanceof z.ZodType, 'a zod schema'),
  shape: z.enum(['rows', 'row']),
});
const BoundaryModule = z.object({ boundaries: z.array(LoadedBoundary).min(1) });
const Answer = z.object({ data: z.unknown(), error: z.object({ message: z.string() }).nullable() });

/**
 * `server-only` marks a store of the arcade's server; outside Next.js it has nothing to refuse. Vite's
 * runner resolves a bare package import before any plugin's resolveId sees it, so the marker import is
 * removed from each module's source instead.
 */
const SERVER_ONLY = /^\s*import\s+['"]server-only['"];?\s*$/gm;
const serverOnly: Plugin = {
  name: 'schemas-verify:server-only',
  enforce: 'pre',
  transform: (code) => {
    const stripped = code.replace(SERVER_ONLY, '');
    return stripped === code ? null : stripped;
  },
};

/** A boundary file's reads, loaded through Vite's module runner (the transform the tests use). */
export async function loadBoundaries(file: string): Promise<Parsed<Boundary[]>> {
  let loaded: unknown;
  try {
    ({ module: loaded } = await runnerImport<unknown>(isAbsolute(file) ? file : join(ROOT, file), {
      configFile: false, root: ROOT, logLevel: 'error', plugins: [serverOnly],
    }));
  } catch (err) {
    return failed(`${file}: does not load: ${messageOf(err)}`);
  }
  const parsed = parseRow(BoundaryModule, loaded, `${file}: exports no boundaries`, quiet);
  return parsed.ok ? ok(parsed.value.boundaries) : parsed;
}

type Status = 'ok' | 'empty' | 'fail';
export type Outcome = { status: Status; line: string };

const PAD: Record<Status, string> = { ok: 'ok     ', empty: 'empty  ', fail: 'FAIL   ' };
const outcome = (status: Status, text: string): Outcome => ({ status, line: `${PAD[status]}${text}` });

/** One read, run against `db` and parsed with its schema. */
export async function verifyBoundary(boundary: Boundary, db: Db): Promise<Outcome> {
  let raw: unknown;
  try {
    raw = await boundary.read(db);
  } catch (err) {
    return outcome('fail', `${boundary.name}: the read threw: ${messageOf(err)}`);
  }
  const answer = Answer.safeParse(raw);
  if (!answer.success) return outcome('fail', `${boundary.name}: the read answered no { data, error }`);
  const { data, error } = answer.data;
  if (error) return outcome('fail', `${boundary.name}: the read failed: ${error.message}`);
  if (boundary.shape === 'row') {
    const parsed = parseRow(boundary.schema, data, boundary.name, quiet);
    if (!parsed.ok) return outcome('fail', parsed.error);
    return data === null ? outcome('empty', `${boundary.name}: no row to parse`) : outcome('ok', `${boundary.name} (1 row)`);
  }
  const parsed = parseRows(boundary.schema, data, boundary.name, quiet);
  if (!parsed.ok) return outcome('fail', parsed.error);
  const n = parsed.value.length;
  return n === 0 ? outcome('empty', `${boundary.name}: no row to parse`) : outcome('ok', `${boundary.name} (${n} row${n === 1 ? '' : 's'})`);
}

/** Every read of every file, one line each and a total; failed when any read or file failed. */
export async function verifyFiles(files: readonly string[], db: Db): Promise<{ failed: boolean; lines: string[] }> {
  if (files.length === 0) return { failed: false, lines: ['no *.boundary.ts file is tracked: nothing to verify'] };
  const outcomes: Outcome[] = [];
  let reads = 0;
  for (const file of files) {
    const loaded = await loadBoundaries(file);
    if (!loaded.ok) {
      outcomes.push(outcome('fail', loaded.error));
      continue;
    }
    for (const boundary of loaded.value) {
      reads++;
      outcomes.push(await verifyBoundary(boundary, db));
    }
  }
  const count = (status: Status) => outcomes.filter((o) => o.status === status).length;
  const total = `${reads} read${reads === 1 ? '' : 's'} in ${files.length} file${files.length === 1 ? '' : 's'}: ${count('ok')} parsed, ${count('empty')} empty, ${count('fail')} failed`;
  return { failed: count('fail') > 0, lines: [...outcomes.map((o) => o.line), total] };
}

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  if (!args.ok) {
    console.error(`${args.error}\n${USAGE}`);
    return 1;
  }
  const target = connect(args.value);
  if (!target.ok) {
    console.error(target.error);
    return 1;
  }
  const files = args.value.files.length > 0 ? args.value.files : trackedBoundaryFiles();
  console.log(`schemas:verify --${args.value.target}: ${target.value.url}`);
  const report = await verifyFiles(files, readOnlyClient(target.value.url, target.value.key));
  for (const line of report.lines) console.log(line);
  return report.failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(await main(process.argv.slice(2)));

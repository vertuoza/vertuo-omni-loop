#!/usr/bin/env node
// node scripts/supabase-types.ts [--check] [--workdir <dir>] [--file <path>] — the database's types
// (PRD 725, s5). Runs `supabase gen types --local` against a running local database (`supabase db
// start` applies supabase/migrations first) and writes what it prints to supabase/database.types.ts,
// unchanged. With --check it writes nothing: it fails when the committed file differs from what the
// migrations generate, naming the first line that differs. The `supabase` workflow runs --check on
// every pull request that touches supabase/.
//
// --workdir is passed to the CLI (a copy of supabase/ on other ports, say); --file names another
// committed file (the tests use it).
//
// Exit codes: 0 written (or no drift), 1 drift, a generator failure, or a bad argument.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'database.types.ts');
const USAGE = 'usage: node scripts/supabase-types.ts [--check] [--workdir <dir>] [--file <path>]';

function lines(text: string): string[] {
  const all = text.split('\n');
  if (all.at(-1) === '') all.pop();
  return all;
}

/** Where the committed types first differ from the generated ones, or null when they are the same. */
export function drift(committed: string, generated: string): string | null {
  if (committed === generated) return null;
  const have = lines(committed);
  const want = lines(generated);
  for (let i = 0; i < Math.max(have.length, want.length); i++) {
    const h = have[i];
    const w = want[i];
    if (h === w) continue;
    const line = `line ${i + 1}`;
    if (h === undefined) return `${line}: the committed file ends, the migrations generate ${JSON.stringify(w)}`;
    if (w === undefined) return `${line}: the committed file has ${JSON.stringify(h)}, the migrations generate nothing more`;
    return `${line}: the committed file has ${JSON.stringify(h)}, the migrations generate ${JSON.stringify(w)}`;
  }
  return 'the trailing newline differs';
}

type Args = { check: boolean; workdir: string | null; file: string };

function parse(argv: string[]): Args | null {
  const args: Args = { check: false, workdir: null, file: FILE };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') args.check = true;
    else if (arg === '--workdir' || arg === '--file') {
      const value = argv[++i];
      if (!value) return null;
      if (arg === '--workdir') args.workdir = value;
      else args.file = value;
    } else return null;
  }
  return args;
}

function generate(workdir: string | null): { ok: true; types: string } | { ok: false; error: string } {
  const run = spawnSync('supabase', ['gen', 'types', '--local', ...(workdir ? ['--workdir', workdir] : [])], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (run.error) return { ok: false, error: `supabase gen types: ${run.error.message}` };
  if (run.status !== 0) return { ok: false, error: `supabase gen types failed (exit ${run.status}):\n${run.stderr.trim()}` };
  return { ok: true, types: run.stdout };
}

function readCommitted(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export function main(argv: string[]): number {
  const args = parse(argv);
  if (!args) {
    console.error(USAGE);
    return 1;
  }
  const generated = generate(args.workdir);
  if (!generated.ok) {
    console.error(generated.error);
    return 1;
  }
  if (!args.check) {
    writeFileSync(args.file, generated.types);
    console.log(`wrote ${args.file}`);
    return 0;
  }
  const committed = readCommitted(args.file);
  if (committed === null) {
    console.error(`no committed types at ${args.file}: run node scripts/supabase-types.ts and commit it`);
    return 1;
  }
  const where = drift(committed, generated.types);
  if (where === null) {
    console.log(`${args.file} is what the migrations generate`);
    return 0;
  }
  console.error(`${args.file} has drifted from the migrations, ${where}.\nRun node scripts/supabase-types.ts against a fresh \`supabase db start\` and commit the result.`);
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main(process.argv.slice(2)));

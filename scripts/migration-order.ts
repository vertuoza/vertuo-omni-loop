#!/usr/bin/env node
// node scripts/migration-order.ts [--base <ref>] — a new migration is dated after every migration the
// base already has. `supabase db push` refuses a migration dated before the newest one production
// applied, so one that lands out of order blocks the deploy (PRD 1364's column drop, 2026-10-11: PRD
// 1440's later migration reached production first). The `supabase` workflow runs it on every pull
// request that touches supabase/; the deploy then pushes with --include-all, for a later migration
// that merges after this check ran.
//
// --base is the ref the branch merges into (default origin/main). A migration is new when its file is
// in HEAD and not in the base.
//
// Exit codes: 0 every new migration is dated after the base's newest, 1 one is not, or a bad argument.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DIR = 'supabase/migrations';
const USAGE = 'usage: node scripts/migration-order.ts [--base <ref>]';

/** A migration's version: the digits before its first underscore. */
export function versionOf(file: string): string {
  return file.split('_')[0] ?? file;
}

/** Each new migration dated at or before the base's newest, with that newest file. */
export function outOfOrder(base: string[], head: string[]): { file: string; newest: string }[] {
  const known = new Set(base);
  const newest = [...base].sort((a, b) => versionOf(a).localeCompare(versionOf(b))).at(-1);
  if (!newest) return [];
  return head
    .filter((file) => !known.has(file) && versionOf(file) <= versionOf(newest))
    .sort()
    .map((file) => ({ file, newest }));
}

function migrations(ref: string): string[] {
  const run = spawnSync('git', ['ls-tree', '--name-only', `${ref}:${DIR}`], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`git ls-tree ${ref}:${DIR} failed: ${run.stderr.trim()}`);
  return run.stdout.split('\n').filter((name) => name.endsWith('.sql'));
}

function main(argv: string[]): number {
  let base = 'origin/main';
  if (argv.length === 2 && argv[0] === '--base' && argv[1]) base = argv[1];
  else if (argv.length !== 0) {
    console.error(USAGE);
    return 1;
  }
  const late = outOfOrder(migrations(base), migrations('HEAD'));
  for (const { file, newest } of late) {
    console.error(`${DIR}/${file} is dated at or before ${newest}, the newest on ${base}: re-date it after ${versionOf(newest)}`);
  }
  if (late.length > 0) return 1;
  console.log(`every new migration is dated after the newest on ${base}`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main(process.argv.slice(2)));

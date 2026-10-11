// A folder outside every outbox that items are written to instead (`omni item new --out`, PRD 563) and
// relayed from (`omni item relay`): a slice built in another repository hands its items over through it.
// Both stores read and write it the same way (PRD 1548): it is the caller's folder, never a store's.
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { OutboxItemId } from '../ids.ts';
import type { OutFolder } from './store.ts';

/** Whether `dir` is a folder. */
export function isFolder(dir: string): boolean {
  return existsSync(dir) && statSync(dir).isDirectory();
}

/** The `*.md` file names directly under `dir`, sorted; none when `dir` does not exist. */
export function markdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && statSync(join(dir, name)).isFile())
    .sort();
}

/** Adds to `ids` the id of every item the folder `dir` holds: its own `.md` files. */
export function spendFolder(ids: Set<string>, dir: string): void {
  for (const name of markdownFiles(dir)) ids.add(basename(name, '.md'));
}

/** Writes item `id` into `out`, creating it if needed; where it went, as the caller spelled the folder. */
export function writeInto(out: OutFolder, id: OutboxItemId, text: string): string {
  mkdirSync(out.abs, { recursive: true });
  writeFileSync(join(out.abs, `${id}.md`), text);
  return join(out.shown, `${id}.md`);
}

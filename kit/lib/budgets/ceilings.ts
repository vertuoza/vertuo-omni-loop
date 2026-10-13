// The ceilings file (PRD 1679): `{ "<target>": <ceiling in bytes> }`, versioned and reviewed like a
// mutation floor. `budgets.context.file` names it. A ceiling only goes up through a person's yes
// (`ratchet`, s2), so setting the ceilings never raises one: it writes a first ceiling for each
// target that has none, at today's size rounded up to the next KiB (D8: installing never turns red).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { messageOf } from '../narrow.ts';
import type { Measure } from './measure.ts';

/** One KiB, the step a first ceiling is rounded up to. */
const KIB = 1024;

/** The ceilings, by target. */
export type Ceilings = Readonly<Record<string, number>>;

const CeilingsSchema = z.record(z.string().min(1), z.number().int().nonnegative());

/** `bytes` rounded up to the next whole KiB, never below one. */
export function roundUpToKib(bytes: number): number {
  return Math.max(KIB, Math.ceil(bytes / KIB) * KIB);
}

/** Parses the ceilings file's text; an Error naming `file` when it is no object of whole byte counts. */
export function parseCeilings(text: string, file: string): Ceilings {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new Error(`${file}: not valid JSON — ${messageOf(error)}`);
  }
  const result = CeilingsSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`${file}: ${issue?.path.join('.') || '(top level)'}: ${issue?.message ?? 'not a ceilings file'} — each target's ceiling is a whole number of bytes`);
  }
  return result.data;
}

/** The ceilings at `<root>/<file>`; `{}` when the file does not exist yet. */
export function readCeilings({ root, file }: { root: string; file: string }): Ceilings {
  const path = join(root, file);
  return existsSync(path) ? parseCeilings(readFileSync(path, 'utf8'), file) : {};
}

/** The ceilings as the file holds them: targets sorted, two-space JSON, one trailing newline. */
export function ceilingsText(ceilings: Ceilings): string {
  const sorted = Object.fromEntries(Object.entries(ceilings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

/** What setting the ceilings did: the file's new ceilings, and the targets it gave a first one. */
export type SetResult = { ceilings: Ceilings; added: { target: string; ceiling: number }[] };

/**
 * `existing` with a first ceiling for each measured target that has none, at its size rounded up
 * to the next KiB. A ceiling that exists is kept as it is, whatever the target measures today, and a
 * ceiling whose target is no longer measured is kept too. Throws when a measure is an error: no
 * ceiling is written from a size nobody could read.
 */
export function setCeilings(existing: Ceilings, measures: readonly Measure[]): SetResult {
  const failed = measures.flatMap((measure) => ('error' in measure ? [`${measure.target}: ${measure.error}`] : []));
  if (failed.length > 0) throw new Error(`cannot measure ${failed.join('; ')}`);
  const added: SetResult['added'] = [];
  const ceilings: Record<string, number> = { ...existing };
  for (const measure of measures) {
    if (!('bytes' in measure) || Object.hasOwn(ceilings, measure.target)) continue;
    const ceiling = roundUpToKib(measure.bytes);
    ceilings[measure.target] = ceiling;
    added.push({ target: measure.target, ceiling });
  }
  return { ceilings, added };
}

/** Writes `ceilings` to `<root>/<file>`, making its folder when it has none. */
export function writeCeilings({ root, file }: { root: string; file: string }, ceilings: Ceilings): void {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, ceilingsText(ceilings));
}

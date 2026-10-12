// PRD 1274: a healed recording waits outside the branch until a person confirms it. `holdHealed` moves each
// healed recording (a step whose actions differ from the merge-base's) into a hold folder inside the
// repository's git directory, which no commit holds, and puts the committed recording back; `confirmHeld`
// commits the held recordings and notes them in `<e2e.dir>/.e2e/confirmed.json`, so a later comparison does
// not list them again; `rejectHeld` drops them. Files and git only: no network, no browser, no model.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { ExecText } from '../context.ts';
import type { PrdNumber } from '../ids.ts';
import { pairHealed } from './heals.ts';
import type { Healed } from './heals.ts';
import { RecordingError, parseRecording, readRecordings } from './recording.ts';
import type { Action } from './recording.ts';

const ActionSchema = z.object({ name: z.string(), target: z.string() });

/** A healed recording that waits: where it belongs, what it says, and the file that holds it. */
const HeldSchema = z.object({
  testId: z.string(),
  callIndex: z.number(),
  summary: z.string(),
  /** The recording's path in the repository. */
  file: z.string(),
  /** The path the committed recording had at the merge-base. */
  was: z.string(),
  actions: z.array(ActionSchema).readonly(),
  /** Its name in the hold folder. */
  heldAs: z.string(),
}).readonly();
export type Held = z.infer<typeof HeldSchema>;

/** A healed step a person confirmed: found again by its test, its call index and the actions it has now. */
const ConfirmedSchema = z.object({ testId: z.string(), callIndex: z.number(), actions: z.array(ActionSchema).readonly() }).readonly();
export type Confirmed = z.infer<typeof ConfirmedSchema>;

const sameActions = (a: readonly Action[], b: readonly Action[]): boolean =>
  a.length === b.length && a.every((action, i) => action.name === b.at(i)?.name && action.target === b.at(i)?.target);

const ledgerFile = (dir: string): string => `${dir.replace(/\/+$/, '')}/.e2e/confirmed.json`;

/** The confirmed steps in a ledger's text; an empty text holds none, and one that does not read names `file`. */
function parseLedger(file: string, text: string): Confirmed[] {
  if (text.trim() === '') return [];
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new RecordingError(file, 'not valid JSON');
  }
  const parsed = z.array(ConfirmedSchema).safeParse(json);
  if (!parsed.success) throw new RecordingError(file, 'not a list of confirmed steps');
  return parsed.data;
}

/** The healed steps a person has not confirmed with the actions they have now. */
export function withoutConfirmed(healed: readonly Healed[], ledger: readonly Confirmed[]): Healed[] {
  return healed.filter((step) => !ledger.some((done) => done.testId === step.testId && done.callIndex === step.callIndex && sameActions(done.actions, step.new)));
}

const gitOptions = (root: string): ExecFileSyncOptionsWithStringEncoding => ({ cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

/** The ledger as committed at `rev`; a revision without one holds none. */
export function readLedgerAt({ root, rev, dir, exec }: { root: string; rev: string; dir: string; exec: ExecText }): Confirmed[] {
  const file = ledgerFile(dir);
  let text: string;
  try {
    text = exec('git', ['show', `${rev}:${file}`], gitOptions(root));
  } catch {
    return [];
  }
  return parseLedger(file, text);
}

function readLedger(root: string, dir: string): Confirmed[] {
  const file = ledgerFile(dir);
  return existsSync(join(root, file)) ? parseLedger(file, readFileSync(join(root, file), 'utf8')) : [];
}

type Where = { root: string; dir: string; prd: PrdNumber; exec: ExecText };

function holdFolder({ root, prd, exec }: Where): string {
  return join(exec('git', ['rev-parse', '--absolute-git-dir'], gitOptions(root)).trim(), 'omni-e2e-hold', String(prd));
}

function readIndex(folder: string): Held[] {
  const file = join(folder, 'index.json');
  return existsSync(file) ? z.array(HeldSchema).parse(JSON.parse(readFileSync(file, 'utf8'))) : [];
}

/**
 * Moves the healed recordings of the working tree (against those at `base`) into the hold folder and puts
 * the recording from `base` back. Returns everything now held, earlier holds included.
 */
export function holdHealed(where: Where & { base: string }): Held[] {
  const { root, dir, base, exec } = where;
  const folder = holdFolder(where);
  const text = (path: string): string => exec('git', ['show', `${base}:${path}`], gitOptions(root));
  const baseFiles = exec('git', ['ls-tree', '-r', '--name-only', base, '--', `${dir.replace(/\/+$/, '')}/.e2e/cache/`], gitOptions(root))
    .split('\n').filter((path) => path.endsWith('.json')).sort();
  const before = baseFiles.map((path) => ({ path, text: text(path) }));
  const baseRecordings = before.map(({ path, text: body }) => parseRecording(path, body));
  const ledger = readLedger(root, dir);
  const held = readIndex(folder);
  const fresh = pairHealed(baseRecordings, readRecordings(root, dir))
    .filter(({ after }) => !ledger.some((done) => done.testId === after.testId && done.callIndex === after.callIndex && sameActions(done.actions, after.actions)));
  mkdirSync(join(folder, 'files'), { recursive: true });
  for (const { before: was, after } of fresh) {
    const heldAs = `files/${held.length}.json`;
    writeFileSync(join(folder, heldAs), readFileSync(join(root, after.file), 'utf8'));
    held.push({ testId: after.testId, callIndex: after.callIndex, summary: after.summary, file: after.file, was: was.file, actions: after.actions, heldAs });
    writeFileSync(join(root, was.file), text(was.file));
    if (after.file !== was.file) rmSync(join(root, after.file), { force: true });
  }
  writeFileSync(join(folder, 'index.json'), `${JSON.stringify(held, null, 2)}\n`);
  return held;
}

/** Commits every held recording and notes it as confirmed; returns what was committed. */
export function confirmHeld(where: Where): Held[] {
  const { root, dir, exec } = where;
  const folder = holdFolder(where);
  const held = readIndex(folder);
  if (held.length === 0) return [];
  const paths = new Set<string>();
  for (const entry of held) {
    mkdirSync(dirname(join(root, entry.file)), { recursive: true });
    writeFileSync(join(root, entry.file), readFileSync(join(folder, entry.heldAs), 'utf8'));
    paths.add(entry.file);
    if (entry.was !== entry.file) {
      rmSync(join(root, entry.was), { force: true });
      paths.add(entry.was);
    }
  }
  const ledger = [...readLedger(root, dir), ...held.map(({ testId, callIndex, actions }) => ({ testId, callIndex, actions }))];
  const file = ledgerFile(dir);
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), `${JSON.stringify(ledger, null, 2)}\n`);
  paths.add(file);
  const list = [...paths];
  exec('git', ['add', '-A', '--', ...list], gitOptions(root));
  exec('git', ['commit', '-q', '-m', `e2e: confirm ${held.length} healed recording${held.length === 1 ? '' : 's'} of PRD ${where.prd}`, '--', ...list], gitOptions(root));
  rmSync(folder, { recursive: true, force: true });
  return held;
}

/** Drops every held recording: the committed one stays as it is. Returns what was dropped. */
export function rejectHeld(where: Where): Held[] {
  const folder = holdFolder(where);
  const held = readIndex(folder);
  rmSync(folder, { recursive: true, force: true });
  return held;
}

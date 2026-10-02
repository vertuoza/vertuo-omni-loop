// Relaying a folder of outbox items and accounts into a PRD's outbox (PRD 563, s3). A slice built
// in a target repository writes its items (`omni item new --out <dir>`) and its account
// (`<dir>/accounts/<slice>.md`) into a scratch folder; once its sub-PR merges, the orchestrator
// moves them into the plan repository's outbox with `omni item relay`, so that one outbox, and one
// gate, holds every decision of the PRD.
//
// Every file is graded before it moves, exactly as `omni item new` grades an item before writing
// it: an item by `checkItemText` (the same check `omni check outbox` runs), an account by
// `parseAccount`. A file is also refused when it belongs to another PRD, when an item's file name
// is not its id, or when its name is already taken in the outbox (an open file, or an id the
// settled ledger carries): a relay never overwrites. A refused file stays where it is; the others
// still move.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Laws } from '../laws.ts';
import { ACCOUNTS_DIR, parseAccount } from './account.ts';
import { checkItemText } from './check-outbox.ts';
import { parseOutboxItem, SETTLED_FILE } from './outbox.ts';
import type { OutboxContext } from './outbox.ts';
import { parseSettledEntries } from './settle.ts';

/** The part of the context a relay reads: the root, the PRD's outbox directory and the markers. */
type RelayContext = OutboxContext;

/** One file a relay moved: `from` its path in the relayed folder, `to` repo-relative. */
export type RelayMove = { from: string; to: string };

/** One file a relay refused, left where it was, and why. */
export type RelayRefusal = { file: string; reason: string };

/** The `*.md` file names directly under `dir`, sorted; `[]` when `dir` does not exist. */
function markdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && statSync(join(dir, name)).isFile())
    .sort();
}

/** The ids the PRD's settled ledger already carries. */
function settledIds(ctx: RelayContext, outboxDir: string): Set<string> {
  const file = join(ctx.root, outboxDir, SETTLED_FILE);
  if (!existsSync(file)) return new Set();
  return new Set(parseSettledEntries(readFileSync(file, 'utf8'), ctx.markers).map((entry): string => entry.id));
}

/** Moves `from` to `to`, across file systems too (a scratch folder is rarely on the repository's). */
function move(from: string, to: string): void {
  try {
    renameSync(from, to);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EXDEV') throw error;
    writeFileSync(to, readFileSync(from));
    unlinkSync(from);
  }
}

/** Why one item file may not move, or `null` when it may. */
function itemRefusal({
  ctx,
  laws,
  prd,
  outboxDir,
  name,
  text,
  taken,
}: {
  ctx: RelayContext;
  laws: Laws;
  prd: number;
  outboxDir: string;
  name: string;
  text: string;
  taken: ReadonlySet<string>;
}): string | null {
  const renderedFile = `${outboxDir}/${name}`;
  const violations: string[] = checkItemText(renderedFile, text, { ctx, laws });
  if (violations.length > 0) return violations.join('; ');
  // An item `checkItemText` passed always parses: its first check is this same parse.
  const parsed = parseOutboxItem(text, { file: renderedFile });
  if (!parsed.ok) return parsed.errors.join('; ');
  const { item } = parsed;
  if (item.prd !== prd) return `it belongs to PRD ${item.prd}, not PRD ${prd}`;
  if (`${item.id}.md` !== name) return `its file name is not its id ${item.id}`;
  if (taken.has(item.id)) return `${item.id} is already in the outbox of PRD ${prd}`;
  return null;
}

/** Why one account file may not move, or `null` when it may. */
function accountRefusal({
  prd,
  destination,
  name,
  text,
}: {
  prd: number;
  destination: string;
  name: string;
  text: string;
}): string | null {
  const parsed = parseAccount(text, { file: name });
  if (!parsed.ok) return parsed.errors.join('; ');
  if (parsed.account.prd !== prd) return `it belongs to PRD ${parsed.account.prd}, not PRD ${prd}`;
  if (existsSync(destination)) return `an account of that name is already in the outbox of PRD ${prd}`;
  return null;
}

/**
 * Relays `dir` (absolute) into PRD `prd`'s outbox. Items first, so an account naming one of them
 * finds it there. Returns `{ moved: [{ from, to }], refused: [{ file, reason }] }`, `to` repo-relative
 * and `from`/`file` the path in `dir`.
 */
export function relayFolder({
  ctx,
  laws,
  prd,
  dir,
}: {
  ctx: RelayContext;
  laws: Laws;
  prd: number;
  dir: string;
}): { moved: RelayMove[]; refused: RelayRefusal[] } {
  const outboxDir = ctx.layout.outboxDir(prd);
  // `omni item relay` refuses a PRD with no inbox or shipped folder before it relays anything.
  if (outboxDir === null) throw new Error(`PRD ${prd} has no inbox or shipped folder`);
  const moved: RelayMove[] = [];
  const refused: RelayRefusal[] = [];

  const taken = settledIds(ctx, outboxDir);
  for (const name of markdownFiles(join(ctx.root, outboxDir))) taken.add(basename(name, '.md'));

  for (const name of markdownFiles(dir)) {
    const from = join(dir, name);
    const reason = itemRefusal({ ctx, laws, prd, outboxDir, name, text: readFileSync(from, 'utf8'), taken });
    if (reason !== null) {
      refused.push({ file: from, reason });
      continue;
    }
    const to = `${outboxDir}/${name}`;
    mkdirSync(join(ctx.root, outboxDir), { recursive: true });
    move(from, join(ctx.root, to));
    taken.add(basename(name, '.md'));
    moved.push({ from, to });
  }

  const accountsDir = join(dir, ACCOUNTS_DIR);
  for (const name of markdownFiles(accountsDir)) {
    const from = join(accountsDir, name);
    const to = `${outboxDir}/${ACCOUNTS_DIR}/${name}`;
    const reason = accountRefusal({ prd, destination: join(ctx.root, to), name: from, text: readFileSync(from, 'utf8') });
    if (reason !== null) {
      refused.push({ file: from, reason });
      continue;
    }
    mkdirSync(join(ctx.root, outboxDir, ACCOUNTS_DIR), { recursive: true });
    move(from, join(ctx.root, to));
    moved.push({ from, to });
  }

  return { moved, refused };
}

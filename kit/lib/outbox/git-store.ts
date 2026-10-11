// The `git` outbox store (PRD 1548, slice s6): a PRD's outbox as files in the repository, exactly as
// every outbox verb read and wrote them before the seam — open items under the PRD's outbox folder,
// the append-only `settled.md` beside them, accounts under `accounts/`. Each method is the code a
// verb ran, moved behind `OutboxStore`; the library functions it calls are unchanged.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';
import type { Context } from '../context.ts';
import type { PrdNumber } from '../ids.ts';
import { adoptedEntriesForPrd, openItemsForPrd, upsertOutboxComment, upsertOutboxPrComment } from './comment.ts';
import { outboxItemFiles, SETTLED_FILE } from './outbox.ts';
import { relayFolder } from './relay.ts';
import { readReplies } from './replies.ts';
import { adoptItem, parseSettledEntries, settleItem } from './settle.ts';
import { gateResult } from './status.ts';
import type { ItemRead, OutboxStore } from './store.ts';

/** `path` as the repository root resolves it: an absolute path as is. */
function inRoot(root: string, path: string): string {
  return isAbsolute(path) ? path : join(root, path);
}

/** The outbox folder of PRD `prd`, or the error the library throws for a PRD with none. */
function outboxDirOf(ctx: Context, prd: PrdNumber): string {
  const dir = ctx.layout.outboxDir(prd);
  if (dir === null) throw new Error(`PRD ${prd} has no inbox or shipped folder`);
  return dir;
}

/** The text of the file at `path`, or the code of a file that cannot be read: no such file, a
 * folder, or no permission. Any other error is thrown. */
function readText(path: string): ItemRead {
  try {
    return { ok: true, text: readFileSync(path, 'utf8') };
  } catch (error) {
    const code: unknown = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT' || code === 'EISDIR' || code === 'EACCES') return { ok: false, code };
    throw error;
  }
}

/** Every id PRD `prd` has spent: an open item file's basename, or an id `settled.md` already
 * carries — a medium item adopted at raise time leaves no open file behind at all. */
function spentInOutbox(ctx: Context, prd: PrdNumber): Set<string> {
  const outboxDir = outboxDirOf(ctx, prd);
  const prefix = `${outboxDir}/`;
  const ids = new Set(
    outboxItemFiles({ ctx })
      .filter((path) => path.startsWith(prefix))
      .map((path) => basename(path, '.md')),
  );
  const settledFile = join(ctx.root, outboxDir, SETTLED_FILE);
  if (existsSync(settledFile)) {
    for (const entry of parseSettledEntries(readFileSync(settledFile, 'utf8'), ctx.markers)) ids.add(entry.id);
  }
  return ids;
}

/** Adds to `ids` the id of every item a folder outside the outbox holds: its own `.md` files. */
function spendFolder(ids: Set<string>, dir: string): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name.endsWith('.md') && statSync(join(dir, name)).isFile()) ids.add(basename(name, '.md'));
  }
}

/** Whether `dir` is a folder. */
function isFolder(dir: string): boolean {
  return existsSync(dir) && statSync(dir).isDirectory();
}

/** `run`'s value as a promise, as an `async` function that awaits nothing gives it: an error it
 * throws rejects the promise. */
function promised<T>(run: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(run());
  });
}

/** The `git` store of the repository `ctx` reads. */
export function gitOutboxStore(ctx: Context): OutboxStore {
  return {
    readItem: (ref) => promised(() => readText(inRoot(ctx.root, ref))),
    removeItem: (ref) => promised(() => {
      rmSync(inRoot(ctx.root, ref));
    }),
    spentIds: (prd, out) => promised(() => {
      const ids = spentInOutbox(ctx, prd);
      // With `--out`, the folder's own items are spent too: two items raised into one scratch folder
      // never share an id, and the relay never finds two files of one name.
      if (out !== null) spendFolder(ids, out.abs);
      return ids;
    }),
    writeItem: ({ prd, id, text }, out) => promised(() => {
      const outboxDir = outboxDirOf(ctx, prd);
      const { abs, shown } = out ?? { abs: join(ctx.root, outboxDir), shown: outboxDir };
      mkdirSync(abs, { recursive: true });
      writeFileSync(join(abs, `${id}.md`), text);
      return join(shown, `${id}.md`);
    }),
    adopt: (itemText) => promised(() => adoptItem({ ctx, itemText })),
    settle: (ref, answer) => promised(() => settleItem({ ctx, file: ref, answer })),
    relay: (prd, dir, laws) => promised(() => (isFolder(dir) ? relayFolder({ ctx, laws, prd, dir }) : null)),
    gate: (prd, options) => promised(() => gateResult(prd, { ctx, ...options })),
    openItems: (prd) => promised(() => openItemsForPrd(prd, { ctx })),
    adoptedEntries: (prd) => promised(() => adoptedEntriesForPrd(prd, { ctx })),
    replies: (request, client) => promised(() => readReplies({ ctx, ...request }, client)),
    prComment: (prd, client) => promised(() => upsertOutboxPrComment({ prd, ctx }, client)),
    issueComment: (request, client) => promised(() => upsertOutboxComment({ ctx, ...request }, client)),
  };
}

// The `git` outbox store (PRD 1548, slice s6): a PRD's outbox as files in the repository, exactly as
// every outbox verb read and wrote them before the seam — open items under the PRD's outbox folder,
// the append-only `settled.md` beside them, accounts under `accounts/`. Each method is the code a
// verb ran, moved behind `OutboxStore`; the library functions it calls are unchanged.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';
import type { Context } from '../context.ts';
import type { PrdNumber } from '../ids.ts';
import { adoptedEntriesForPrd, openItemsForPrd, upsertOutboxComment, upsertOutboxPrComment } from './comment.ts';
import { outboxItemFiles } from './outbox.ts';
import { markdownFiles, relayFolder, settledIds } from './relay.ts';
import { readReplies } from './replies.ts';
import { adoptItem, settleItem } from './settle.ts';
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
  const ids = settledIds(ctx, outboxDir);
  for (const path of outboxItemFiles({ ctx })) if (path.startsWith(prefix)) ids.add(basename(path, '.md'));
  return ids;
}

/** Whether `dir` is a folder. */
function isFolder(dir: string): boolean {
  return existsSync(dir) && statSync(dir).isDirectory();
}

/** The `git` store of the repository `ctx` reads. */
export function gitOutboxStore(ctx: Context): OutboxStore {
  return {
    async readItem(ref) {
      return readText(inRoot(ctx.root, ref));
    },
    async removeItem(ref) {
      rmSync(inRoot(ctx.root, ref));
    },
    async spentIds(prd, out) {
      const ids = spentInOutbox(ctx, prd);
      // With `--out`, the folder's own items are spent too: two items raised into one scratch folder
      // never share an id, and the relay never finds two files of one name.
      if (out !== null) for (const name of markdownFiles(out.abs)) ids.add(basename(name, '.md'));
      return ids;
    },
    async writeItem({ prd, id, text }, out) {
      const outboxDir = outboxDirOf(ctx, prd);
      const { abs, shown } = out ?? { abs: join(ctx.root, outboxDir), shown: outboxDir };
      mkdirSync(abs, { recursive: true });
      writeFileSync(join(abs, `${id}.md`), text);
      return join(shown, `${id}.md`);
    },
    async adopt(itemText) {
      return adoptItem({ ctx, itemText });
    },
    async settle(ref, answer) {
      return settleItem({ ctx, file: ref, answer });
    },
    async relay(prd, dir, laws) {
      if (!isFolder(dir)) return null;
      return relayFolder({ ctx, laws, prd, dir });
    },
    async gate(prd, options) {
      return gateResult(prd, { ctx, ...options });
    },
    async openItems(prd) {
      return openItemsForPrd(prd, { ctx });
    },
    async adoptedEntries(prd) {
      return adoptedEntriesForPrd(prd, { ctx });
    },
    async replies(request, client) {
      return readReplies({ ctx, ...request }, client);
    },
    async prComment(prd, client) {
      return upsertOutboxPrComment({ prd, ctx }, client);
    },
    async issueComment(request, client) {
      return upsertOutboxComment({ ctx, ...request }, client);
    },
  };
}

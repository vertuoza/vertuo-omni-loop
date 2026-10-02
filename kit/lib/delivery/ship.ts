// The ship step: on the feature branch, before the feature pull request leaves draft, the PRD's
// inbox folder becomes its shipped folder and its outbox moves inside it. The human merge is what
// ships it — no bot writes to the default branch. settled.md is append-only and never rewritten.
// With `releaseNotes.enabled` (PRD 262), a PRD ships only with a release note that holds: the note
// is in its folder, so the move carries it to shipped.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { trackedFiles } from '../check-report.ts';
import { openItemFiles, unreworkedDrift } from '../outbox/status.ts';
import { SETTLED_FILE } from '../outbox/outbox.ts';
import { releaseNotePath } from '../releases/check-releases.ts';
import { gradeReleaseNote } from '../releases/note.ts';
import type { Context, ExecRaw } from '../context.ts';
import type { PrdNumber } from '../layout.ts';

/** Reads a repository file's text, by its path from the root. */
export type ReadFile = (file: string) => string;

/** A folder the ship step moves, from the root. */
export type ShipMove = { from: string; to: string };

/** A file whose text names a moved folder, and its text once the paths are rewritten. */
export type ShipRewrite = { file: string; text: string };

/** What shipping PRD `prd` would do, or why it cannot. */
export type ShipPlan =
  | { ok: false; reasons: string[]; moves?: undefined; rewrites?: undefined }
  | { ok: true; moves: ShipMove[]; rewrites: ShipRewrite[]; reasons?: undefined };

const REWRITTEN = /\.(md|html|yml|yaml|json)$/;

/** Why the release note stops PRD `prd` in `dir` from shipping: `[]` when the switch is off or the
 * note holds. */
function releaseNoteReasons(ctx: Context, prd: PrdNumber, dir: string, read: ReadFile): string[] {
  if (!ctx.config.releaseNotes.enabled) return [];
  const file = releaseNotePath(dir);
  if (!existsSync(join(ctx.root, file))) return [`no release note: ${file}`];
  return gradeReleaseNote(read(file), { prd }).map((rule) => `release note: ${rule}`);
}

export function planShip(ctx: Context, prd: PrdNumber, { files, read }: { files: readonly string[]; read: ReadFile }): ShipPlan {
  const where = ctx.layout.whereIs(prd);
  if (where?.state !== 'inbox') {
    return { ok: false, reasons: [`PRD ${Number(prd)} is not in the inbox (${where ? where.state : 'nowhere'})`] };
  }
  const reasons: string[] = [
    ...openItemFiles(prd, { ctx }).map((file) => `open outbox item: ${file}`),
    ...unreworkedDrift(prd, { ctx }).map((entry: { id: string }) => `drifted, not reworked: ${entry.id}`),
    ...releaseNoteReasons(ctx, prd, where.dir, read),
  ];
  if (reasons.length) return { ok: false, reasons };

  const { dirs } = ctx.layout;
  const shipped = `${dirs.shipped}/${where.name}`;
  const outbox = `${dirs.outbox}/${where.name}`;
  const moves: ShipMove[] = [{ from: where.dir, to: shipped }];
  const hasOutbox = existsSync(join(ctx.root, outbox));
  if (hasOutbox) moves.push({ from: outbox, to: `${shipped}/outbox` });

  const rewrites: ShipRewrite[] = [];
  for (const file of files) {
    if (!REWRITTEN.test(file) || basename(file) === SETTLED_FILE) continue;
    // A file git tracks but the working tree no longer holds (a settled item not yet committed)
    // has nothing to rewrite.
    if (!existsSync(join(ctx.root, file))) continue;
    const before = read(file);
    let after = before.split(where.dir).join(shipped);
    if (hasOutbox) after = after.split(outbox).join(`${shipped}/outbox`);
    if (after !== before) rewrites.push({ file, text: after });
  }
  return { ok: true, moves, rewrites };
}

/** Thrown when the delivery folder holds uncommitted changes — the user's to commit, not a refusal
 * of the PRD itself. */
export class DirtyDeliveryError extends Error {
  constructor(delivery: string) {
    super(`uncommitted changes under ${delivery} — commit the settle first`);
    this.name = 'DirtyDeliveryError';
  }
}

export function applyShip(ctx: Context, prd: PrdNumber, { exec = execFileSync }: { exec?: ExecRaw } = {}): ShipPlan & { ok: true } {
  // Ship moves folders with git mv and never commits: it runs on a committed delivery folder, as
  // yolo-fix commits the settle before shipping.
  const delivery = ctx.config.paths.delivery;
  const dirty = exec('git', ['status', '--porcelain', '--', delivery], { cwd: ctx.root, encoding: 'utf8' });
  if (String(dirty).trim()) throw new DirtyDeliveryError(delivery);
  const read: ReadFile = (file) => readFileSync(join(ctx.root, file), 'utf8');
  const plan = planShip(ctx, prd, { files: trackedFiles(ctx), read });
  if (!plan.ok) throw new Error(`Cannot ship PRD ${Number(prd)}:\n${plan.reasons.map((r) => `  - ${r}`).join('\n')}`);
  for (const { from, to } of plan.moves) {
    mkdirSync(dirname(join(ctx.root, to)), { recursive: true });
    exec('git', ['mv', from, to], { cwd: ctx.root, stdio: 'ignore' });
  }
  for (const { file, text } of plan.rewrites) {
    writeFileSync(join(ctx.root, movedPath(plan.moves, file)), text);
  }
  return plan;
}

/** Where `file` lives once `moves` have run: a file inside a moved folder follows its folder. */
export function movedPath(moves: readonly ShipMove[], file: string): string {
  return moves.reduce((path, { from, to }) => (path.startsWith(`${from}/`) ? to + path.slice(from.length) : path), file);
}

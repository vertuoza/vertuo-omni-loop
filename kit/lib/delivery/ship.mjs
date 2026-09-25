// The ship step: on the feature branch, before the feature pull request leaves draft, the PRD's
// inbox folder becomes its shipped folder and its outbox moves inside it. The human merge is what
// ships it — no bot writes to the default branch. settled.md is append-only and never rewritten.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { trackedFiles } from '../check-report.mjs';
import { openItemFiles, unreworkedDrift } from '../outbox/status.mjs';
import { SETTLED_FILE } from '../outbox/outbox.mjs';

const REWRITTEN = /\.(md|html|yml|yaml|json)$/;

export function planShip(ctx, prd, { files, read }) {
  const where = ctx.layout.whereIs(prd);
  if (where?.state !== 'inbox') {
    return { ok: false, reasons: [`PRD ${Number(prd)} is not in the inbox (${where ? where.state : 'nowhere'})`] };
  }
  const reasons = [
    ...openItemFiles(prd, { ctx }).map((file) => `open outbox item: ${file}`),
    ...unreworkedDrift(prd, { ctx }).map((entry) => `drifted, not reworked: ${entry.id}`),
  ];
  if (reasons.length) return { ok: false, reasons };

  const { dirs } = ctx.layout;
  const shipped = `${dirs.shipped}/${where.name}`;
  const outbox = `${dirs.outbox}/${where.name}`;
  const moves = [{ from: where.dir, to: shipped }];
  const hasOutbox = existsSync(join(ctx.root, outbox));
  if (hasOutbox) moves.push({ from: outbox, to: `${shipped}/outbox` });

  const rewrites = [];
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
  constructor(delivery) {
    super(`uncommitted changes under ${delivery} — commit the settle first`);
    this.name = 'DirtyDeliveryError';
  }
}

export function applyShip(ctx, prd, { exec = execFileSync } = {}) {
  // Ship moves folders with git mv and never commits: it runs on a committed delivery folder, as
  // yolo-fix commits the settle before shipping.
  const delivery = ctx.config.paths.delivery;
  const dirty = exec('git', ['status', '--porcelain', '--', delivery], { cwd: ctx.root, encoding: 'utf8' });
  if (String(dirty ?? '').trim()) throw new DirtyDeliveryError(delivery);
  const read = (file) => readFileSync(join(ctx.root, file), 'utf8');
  const plan = planShip(ctx, prd, { files: trackedFiles(ctx), read });
  if (!plan.ok) throw new Error(`Cannot ship PRD ${Number(prd)}:\n${plan.reasons.map((r) => `  - ${r}`).join('\n')}`);
  for (const { from, to } of plan.moves) {
    mkdirSync(dirname(join(ctx.root, to)), { recursive: true });
    exec('git', ['mv', from, to], { cwd: ctx.root, stdio: 'ignore' });
  }
  for (const { file, text } of plan.rewrites) {
    const moved = plan.moves.reduce((path, { from, to }) => (path.startsWith(`${from}/`) ? to + path.slice(from.length) : path), file);
    writeFileSync(join(ctx.root, moved), text);
  }
  return plan;
}

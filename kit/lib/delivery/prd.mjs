// One lookup an agent runs before following any delivery path: where PRD <n> lives today.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { openItemFiles } from '../outbox/status.mjs';

export function whereIs(ctx, prd) {
  const where = ctx.layout.whereIs(prd);
  if (!where) return null;
  const absolute = join(ctx.root, where.dir);
  const files = readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `${where.dir}/${entry.name}`)
    .sort();
  const outboxDir = ctx.layout.outboxDir(prd);
  return {
    prd: Number(prd),
    name: where.name,
    state: where.state,
    dir: where.dir,
    files,
    outboxDir,
    openItems: openItemFiles(prd, { ctx }),
  };
}

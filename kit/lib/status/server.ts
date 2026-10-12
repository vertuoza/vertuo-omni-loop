// PRD 1299, slice s5: the ◆ PRDs `omni status` and `omni next` place through `prdState()`. Git cannot
// tell a ◆ PRD's stage: no phase-0 PR approves it, the server does. This reads every PRD folder of the
// checkout's inbox, asks `prdState()` where each stands, and keeps the ones born on the server, each
// with its stage and the lines its approval said. A ◇ PRD is skipped before any call, and so is one
// the base already shipped. The overview (`overview.ts`) then puts them in its stages.
import { join } from 'node:path';
import { prdState } from '../approval/prd-state.ts';
import type { ApprovalCall } from '../approval/prd-state.ts';
import type { Context } from '../context.ts';
import { parseFolderName, prdFoldersIn } from '../layout.ts';
import type { ServerPrd } from './overview.ts';

/** The ◆ PRDs of the checkout's inbox, lowest first, leaving out the numbers in `shipped`. */
export async function serverPrds(ctx: Context, shipped: ReadonlySet<number>, approval: ApprovalCall): Promise<ServerPrd[]> {
  const out: ServerPrd[] = [];
  for (const { name, prd } of prdFoldersIn(join(ctx.root, ctx.layout.dirs.inbox))) {
    if (shipped.has(prd)) continue;
    const state = await prdState(ctx, prd, { approval });
    if (state === null || state.birthplace !== 'server' || state.state === 'shipped') continue;
    out.push({ prd, topic: parseFolderName(name)?.topic ?? name, stage: state.state, lines: state.approval?.lines ?? [] });
  }
  return out;
}

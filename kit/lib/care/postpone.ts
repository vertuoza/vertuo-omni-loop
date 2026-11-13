// PRD 2739, s3: the outbox item a `later` care reply records, through the same writer `omni item new`
// uses: the recording policy ranks it (high, `postponesReview`, never#2), `renderOutboxItem` renders it,
// `checkItemText` grades it as `omni check outbox` would, and the PRD's outbox store writes it. It is
// prepared before the reply is posted, so a refused item posts nothing.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Context } from '../context.ts';
import { defined } from '../narrow.ts';
import type { OutboxItemId, PrdNumber } from '../ids.ts';
import { parsePlanSlices } from '../inbox/territory.ts';
import { lawsFor } from '../laws.ts';
import { checkItemText } from '../outbox/check-outbox.ts';
import { outboxStore } from '../outbox/stores.ts';
import { decideRecording, renderOutboxItem } from '../policy/outbox-policy.ts';
import { POSTPONE_SLICE, postponeItem, postponeItemId } from './later.ts';

/** An item ready to write, or the reasons `omni check outbox` would refuse it. */
export type PreparedPostpone =
  | { ok: true; id: OutboxItemId; rank: string; write: () => Promise<string> }
  | { ok: false; violations: string[] };

/** The plan's last wave, the one care's items are raised after; 1 when the plan names none. */
function lastWave(ctx: Context, prd: PrdNumber): number {
  const plan = ctx.layout.planPath(prd);
  if (plan === null || !existsSync(join(ctx.root, plan))) return 1;
  const waves = parsePlanSlices(readFileSync(join(ctx.root, plan), 'utf8')).flatMap((slice) => (slice.wave === null ? [] : [slice.wave]));
  return waves.length === 0 ? 1 : Math.max(...waves);
}

/** Renders and grades PRD `prd`'s item for a postponed point; `write` records it in the PRD's outbox. */
export async function preparePostpone(ctx: Context, prd: PrdNumber, point: Parameters<typeof postponeItem>[0]): Promise<PreparedPostpone> {
  const outboxDir = defined(ctx.layout.outboxDir(prd), `PRD ${prd}'s outbox folder`);
  const laws = lawsFor(ctx);
  const { slug, ...fields } = postponeItem(point);
  const decision = decideRecording({ postponesReview: true, laws });
  const rank = defined(decision.rank, 'the rank of a postponed point');
  const store = outboxStore(ctx, prd);
  const id = postponeItemId(await store.spentIds(prd, null), slug);
  const text = renderOutboxItem({
    ...fields,
    id,
    prd,
    slice: POSTPONE_SLICE,
    wave: lastWave(ctx, prd),
    raised: new Date().toISOString().slice(0, 10),
    bearsOn: 'none',
    rank,
    laws,
  });
  const violations = checkItemText(`${outboxDir}/${id}.md`, text, { ctx, laws });
  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, id, rank, write: () => store.writeItem({ prd, id, text }, null) };
}

// PRD 2898, s1: what excuses a finding of the ready checks 4 (a loosened test) and 5 (a file outside
// every slice's territory). Two recorded fields, and nothing else: the item's `excuses:` paths, which
// the agent wrote when it raised the item, and its settled entry's verdict, as the ledger records it.
// `agreed` (the person picked A, what was built) excuses a finding of either check; `adopted` (a medium
// item nobody was asked about) excuses one of check 5 only. A `drifted` verdict, an open item, an item
// whose field does not name the exact path, and any answer's words excuse nothing: the rule never
// reads meaning into what a person wrote, never rewords it and never writes to the ledger (BL-ASK-1).
import type { OutboxItemId } from '../ids.ts';
import { itemExcuses } from '../outbox/excuses.ts';
import { ADOPTED_VERDICT } from '../outbox/settle.ts';
import type { SettledEntry } from '../outbox/settle.ts';

/** One item, as the ready rule reads it: its verdict (`null` while it is open) and the paths it excuses. */
export type ExcuseItem = { item: OutboxItemId; verdict: string | null; excuses: readonly string[] };

/** The two checks an item may excuse a finding of. */
export type ExcusingCheck = 'loosening' | 'area';

/** The verdicts that excuse a finding of each check. */
const EXCUSING_VERDICTS: Record<ExcusingCheck, readonly string[]> = {
  loosening: ['agreed'],
  area: ['agreed', ADOPTED_VERDICT],
};

/** Whether a finding is excused, and by which item; when it is not, `note` names an item that names the
 * path but cannot excuse it, or is null when none does. */
type Excuse = { excused: true; item: OutboxItemId } | { excused: false; note: string | null };

/**
 * The items of a PRD's outbox as the ready rule reads them: each settled entry (the ledger's latest per
 * id) with its verdict and the paths its item's text excuses, then each open item not settled since, as
 * unanswered.
 */
export function excuseItems({ settled, open }: { settled: readonly SettledEntry[]; open: readonly { id: OutboxItemId; text: string }[] }): ExcuseItem[] {
  const fromLedger = settled.map((entry) => ({ item: entry.id, verdict: entry.verdict?.trim() ?? null, excuses: itemExcuses(entry.itemText) }));
  const settledIds = new Set<string>(settled.map((entry) => entry.id));
  const stillOpen = open.filter((item) => !settledIds.has(item.id)).map((item) => ({ item: item.id, verdict: null, excuses: itemExcuses(item.text) }));
  return [...fromLedger, ...stillOpen];
}

/** Why an item that names the path does not excuse it. */
function whyNot({ item, verdict }: ExcuseItem): string {
  if (verdict === null) return `${item} names it, but is still open`;
  if (verdict === 'drifted') return `${item} names it, but its answer drifted from what was built`;
  if (verdict === ADOPTED_VERDICT) return `${item} names it, but was adopted, never answered by a person`;
  return `${item} names it, but its verdict reads "${verdict}"`;
}

/** Whether `path`'s finding of `check` is excused: by the first item naming that exact path whose
 * verdict excuses that check. */
export function excuse(path: string, items: readonly ExcuseItem[], check: ExcusingCheck): Excuse {
  const naming = items.filter((item) => item.excuses.includes(path));
  const excusing = naming.find((item) => item.verdict !== null && EXCUSING_VERDICTS[check].includes(item.verdict));
  if (excusing) return { excused: true, item: excusing.item };
  const [first] = naming;
  return { excused: false, note: first === undefined ? null : whyNot(first) };
}

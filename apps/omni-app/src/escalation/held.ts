// What still waits on a person on a pull request the outbox check just graded (PRD 1794): each locked
// law `law-locked` still holds, and, on a feature PR, each open `high` or `human-action` item of its
// PRD. Read from what the check already computed and the head it already snapshotted: it makes no
// request, and it decides nothing the check did not.
import { join } from 'node:path';
import { createContext } from 'omni-loop/kit/lib/context.ts';
import { escalates, type EscalationSettings, type HeldKind } from 'omni-loop/kit/lib/escalation/escalation.ts';
import { prdFoldersIn } from 'omni-loop/kit/lib/layout.ts';
import { openItems } from 'omni-loop/kit/lib/outbox/status.ts';
import type { Config } from 'omni-loop/kit/lib/types.ts';
import { prdDirs, prdOfTopic, pullKind } from '../evaluate/evaluate.ts';
import type { LawGate } from '../outbox-check/law-locked.ts';

/** A thing that waits on a person, as the check saw it: a locked law by its id, or an item by its id. */
export type Held = { readonly thing: string; readonly kind: HeldKind };

/** What the check hands the record: the repository's escalation settings and what still holds. */
export type HeldNow = { readonly settings: EscalationSettings; readonly held: readonly Held[] };

/** The ranks of an item that waits on a person's answer; a lower one is adopted when it is raised. */
const WAITING_RANKS: ReadonlySet<string> = new Set(['high', 'human-action']);

/** What escalation reads from the base branch's config. */
export function settingsOf(config: Config): EscalationSettings {
  return { owners: config.laws.owners, leadership: config.laws.leadership, workingDays: config.limits.escalationWorkingDays };
}

/** The open `high` and `human-action` items of the feature PR's PRD at `head`; none on any other pull request. */
function heldItems(config: Config, head: string, pr: { baseRef: string; headRef: string }): Held[] {
  const kind = pullKind(pr, config);
  if ('skip' in kind || kind.kind !== 'feature') return [];
  const prd = prdOfTopic(kind.topic, prdDirs(config).flatMap((dir) => prdFoldersIn(join(head, dir)).map((folder) => folder.name)), config);
  if ('skip' in prd) return [];
  return openItems(prd.number, { ctx: createContext(head, config) })
    .filter((item) => item.rank !== null && WAITING_RANKS.has(item.rank))
    .map((item) => ({ thing: item.id ?? item.file.replace(/^.*\//, '').replace(/\.md$/, ''), kind: 'item' as const }));
}

/** Each locked law the gate still holds, once. */
function heldLaws(gate: LawGate | null): Held[] {
  if (gate === null) return [];
  return [...new Set(gate.awaiting.map((one) => one.law))].map((law) => ({ thing: law, kind: 'law' as const }));
}

/**
 * What still holds on the pull request: its held laws first, then its held items. Null on a repository
 * that names no delegate and no leadership: it escalates nothing, so nothing is handed on.
 */
export function heldAt({ config, head, pr, gate }: { config: Config; head: string; pr: { baseRef: string; headRef: string }; gate: LawGate | null }): HeldNow | null {
  const settings = settingsOf(config);
  if (!escalates(settings)) return null;
  return { settings, held: [...heldLaws(gate), ...heldItems(config, head, pr)] };
}

/**
 * **A high item the fleet answered** (PRD 2896 s10, spec "6. The committee, at `alone`").
 *
 * At a mission's level `alone`, the fleet's committee may answer a high outbox item: every member who sat answered `yes` to
 * option A, as built, and nothing on the escalation list applied (`kit/lib/committee/`). The App then settles it in the PRD's
 * ledger, exactly as a person's answer is settled — the question kept verbatim, `settled.md` appended, the item file deleted
 * — but in the fleet's name: `Approved by: fleet <key>`, never a person's (L-AIACT-1), and the answer naming the option, the
 * mission branch it was given for and each member's verdict.
 *
 * - {@link settleByFleet} is pure over the tree `ctx` is rooted at: it returns the ledger's new text and the file to delete,
 *   and touches no file. The App writes both in one commit on the feature branch.
 * - Only option A settles: the fleet agrees with what was built, so there is nothing to rework. A member who wants another
 *   option answers `no`, and the item goes to a person.
 * - {@link fleetAnswered} names the items whose latest entry the fleet answered. The merge gate into the mission branch reads
 *   them as answered (they are no open item); a pull request into the default branch is held on them, since no person
 *   answered them (BR-PRODUCT-5): {@link fleetHeldLines} says so in the outbox check.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readRepoFile } from '../check-report.ts';
import type { PrdNumber } from '../ids.ts';
import type { Layout } from '../layout.ts';
import { SETTLED_FILE } from './outbox.ts';
import { parseItem, parseSettledEntries, renderSettledEntry, settledHeader, type Markers } from './settle.ts';
import { openItemFiles } from './status.ts';

/** What `Approved by:` starts with on an entry a fleet answered. */
const FLEET_PREFIX = 'fleet ';

/** The only option the fleet settles with: what was built. */
const BUILT = 'A';

/** One member's verdict, as the committee recorded it. */
export type FleetVerdict = { role: string; answer: string; sentence: string };

/** What the fleet answered: its key, the option, the mission branch it answered for, when, on which pull request, and the verdicts. */
export type FleetAnswer = { fleet: string; option: string; branch: string; at: string; pr: number; url?: string; verdicts: readonly FleetVerdict[] };

/** What settling reads of a context. */
type FleetContext = { root: string; layout: Pick<Layout, 'outboxDir' | 'outboxDirs'>; markers: Markers; config: { paths: { delivery: string } } };

/** A member's name, as the committee's lines say it. */
const NAMES: Readonly<Record<string, string>> = { pm: 'the PM', architect: 'the Architect', reviewer: 'the Reviewer' };

/** The answer's text, as it is kept verbatim in the ledger: the option, then who answered it and each verdict. */
function answerText(option: { letter: string; text: string }, answer: FleetAnswer): string {
  return [
    `${option.letter}. ${option.text}`,
    '',
    `Answered by fleet ${answer.fleet} for ${answer.branch}: every member who sat answered yes.`,
    ...answer.verdicts.map(({ role, answer: said, sentence }) => `- ${NAMES[role] ?? role}: ${said} — ${sentence}`),
  ].join('\n');
}

/** The open item of PRD `prd` whose id is `item`: its file and text; null when none is open. */
function openItem(ctx: FleetContext, prd: PrdNumber, item: string): { file: string; text: string } | null {
  for (const file of openItemFiles(prd, { ctx })) {
    const text = readRepoFile(ctx, file);
    const parsed = parseItem(text, file);
    if (parsed.ok && parsed.item.id === item) return { file, text };
  }
  return null;
}

/**
 * The ledger of PRD `prd` once item `item` is settled as the fleet answered it, and the file to delete; or why it is refused.
 * Pure: it reads the tree and writes nothing.
 */
export function settleByFleet({ ctx, prd, item, answer }: { ctx: FleetContext; prd: PrdNumber; item: string; answer: FleetAnswer }):
  | { ok: true; settledFile: string; text: string; entry: string; deletes: string[] }
  | { ok: false; errors: string[] } {
  const refused = (why: string) => ({ ok: false as const, errors: [`${item}: ${why}`] });
  const outboxDir = ctx.layout.outboxDir(prd);
  const open = outboxDir === null ? null : openItem(ctx, prd, item);
  if (outboxDir === null || open === null) return refused(`no such open item of PRD ${String(prd)}.`);
  const parsed = parseItem(open.text, open.file);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const { item: read } = parsed;
  if (read.rank !== 'high') return refused(`the fleet answers a high item only, not a ${read.rank} one.`);
  const option = read.sections.options?.find((one) => one.letter === answer.option);
  if (option === undefined) return refused(`it offers no option ${answer.option}.`);
  if (option.letter !== BUILT) return refused(`the fleet settles an item with option ${BUILT}, as built, only: ${option.letter} goes to a person.`);
  if (answer.verdicts.length === 0) return refused('the fleet answers with the verdicts of the members who sat.');

  const settledFile = `${outboxDir}/${SETTLED_FILE}`;
  const existing = existsSync(join(ctx.root, settledFile)) ? readRepoFile(ctx, settledFile) : settledHeader(prd, { ctx });
  const entry = renderSettledEntry({
    item: read,
    itemText: open.text,
    answer: {
      text: answerText(option, answer),
      approvedBy: `${FLEET_PREFIX}${answer.fleet}`,
      approvedAt: answer.at,
      channel: { kind: 'feature-pull-request', number: answer.pr, ...(answer.url === undefined ? {} : { url: answer.url }) },
    },
    judgement: {
      verdict: 'agreed',
      basis: 'fleet',
      reason: `the fleet's committee chose option ${BUILT}, as built: every member who sat answered yes`,
    },
    markers: ctx.markers,
  });
  // Append, never rewrite: the ledger goes out first, untouched, and the entry follows it.
  const text = `${existing}${existing.endsWith('\n') ? '\n' : '\n\n'}${entry}`;
  return { ok: true, settledFile, text, entry, deletes: [open.file] };
}

/** An item whose latest entry a fleet answered: its id and who answered it (`fleet <key>`). */
export type FleetAnswered = { id: string; by: string };

/** Every item of PRD `prd` whose latest ledger entry a fleet answered, in the ledger's order. */
export function fleetAnswered(prd: PrdNumber, { ctx }: { ctx: FleetContext }): FleetAnswered[] {
  const outboxDir = ctx.layout.outboxDir(prd);
  if (outboxDir === null) return [];
  const settledFile = `${outboxDir}/${SETTLED_FILE}`;
  if (!existsSync(join(ctx.root, settledFile))) return [];
  return parseSettledEntries(readRepoFile(ctx, settledFile), ctx.markers).flatMap((entry) => {
    const by = entry.fields['Approved by'] ?? '';
    return by.startsWith(FLEET_PREFIX) ? [{ id: entry.id, by }] : [];
  });
}

/** What the outbox check of a pull request into the default branch says of the items a fleet answered; nothing when there are none. */
export function fleetHeldLines(answered: readonly FleetAnswered[]): string[] {
  if (answered.length === 0) return [];
  const n = answered.length;
  return [
    `outbox-status — ${String(n)} item${n === 1 ? '' : 's'} answered by a fleet, not by a person: ${n === 1 ? 'it holds' : 'they hold'} a pull request into the default branch (BR-PRODUCT-5):`,
    ...answered.map(({ id, by }) => `  - ${id} (${by})`),
  ];
}

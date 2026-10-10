/**
 * **The gate holds the feature pull request** (PRD #985, slice s3; a second reason to be red added
 * by PRD #1044, slice s4; a third reason added by this task).
 *
 * The whole gate, as pure functions plus one report renderer: `gateResult` says `ok: true` when a
 * PRD's outbox has no open item, no drifted decision sits unreworked, AND (when the caller graded
 * a range) that range holds no unaccounted risky change — `false` otherwise. `kit/bin` (a later
 * task) is the CLI half that reads this result's `ok` field for its exit code and prints
 * `formatReport`'s text either way, because a workflow log is the only place a red run is read
 * from.
 *
 * Item discovery goes through `outbox.mjs`'s `outboxItemFiles` and `parseOutboxItem` — the one
 * parser — never by re-globbing or re-parsing an outbox directory's markdown here. A file that
 * fails to parse still counts as an open item (it holds the gate exactly as a well-formed one
 * would); `check-outbox.mjs` is what refuses a malformed item, on a different schedule, not this
 * one.
 *
 * **The second reason (PRD #1044).** `decision-coverage.mjs`'s `riskyChanges` names the ground a
 * range touches that a silent decision would be expensive on; `account.mjs`'s `readAccounts` reads
 * what each slice wrote down about it and `compare`s the two. An `unaccounted` change — risky
 * ground no account names — holds the gate exactly as an open item does. Grading the range needs a
 * `changes` list (`{ path, status }[]`, exactly `git diff --name-status` shape) the caller
 * computes; `gateResult` stays pure over it and shells out to nothing. Omitting `changes` (the
 * default) skips the range check entirely, and the result carries no `unaccounted` field at all —
 * the shape every existing caller of this module already has, unchanged.
 *
 * **The third reason (this task).** A `drifted` verdict in a PRD's `settled.md` means the build and
 * the human's decision disagree; a rework closes it by amending that entry's one `Closed:` line in
 * place to start with "yes" (`closeDriftedEntry` in `kit/lib/policy/rework.ts`, which touches no
 * other byte) — and, since `settle.mjs`'s "latest wins" rule (`parseSettledEntries`) reads only the
 * newest entry for an id, a later objection re-opens it by appending, never by editing. `unreworkedDrift`
 * names every id still open in this sense, and it holds the gate exactly as an open item or an
 * unaccounted change does, even when the outbox itself is otherwise empty.
 *
 * The label named by `ctx.config.labels.outboxGo` overrides the gate unconditionally, whatever the
 * open-item count, the unreworked-drift count, or the unaccounted-change count — that override is
 * tested here, in the pure `gateResult`, not in the workflow's own branching. Every result carries
 * that same label back as `overrideLabel`, so `formatReport` (which takes no `ctx` of its own) can
 * still name the actual configured label in its override line, byte-identically to upstream's own
 * hard-coded text when the label is left at its default.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-status.mjs — changes in kit/porting/outbox--status.md.
import { existsSync } from 'node:fs';
import { readRepoFile } from '../check-report.ts';
import { COMMANDS } from '../commands.ts';
import { ACCOUNTS_DIR, LAW_RULES, compare, readAccounts } from './account.ts';
import type { Change } from './account.ts';
import { riskyChanges } from './decision-coverage.ts';
import { readKnowledge, readRegisters } from '../knowledge/registers.ts';
import type { KnowledgeEntry } from '../knowledge/registers.ts';
import { SETTLED_FILE, outboxItemFiles, parseOutboxItem } from './outbox.ts';
import type { OutboxContext } from './outbox.ts';
import type { CoverageContext, RiskyChange } from './decision-coverage.ts';
import { parseSettledEntries } from './settle.ts';
import type { PrdNumber } from '../ids.ts';
import type { KnowledgeSource } from '../knowledge/registers.ts';

/** The part of the context the gate reads. */
type GateContext = OutboxContext & CoverageContext;

/** One open item, described for the report: `id` and `rank` are `null` when the file fails to parse. */
export type OpenItem = { file: string; id: string | null; rank: string | null };

/** A drifted decision not yet reworked: its id and its `Closed:` line. */
export type UnreworkedEntry = { id: string; closedLine: string | undefined };

/** A risky change no account accounts for; `refused` says why the account naming it did not (PRD 1342). */
export type UnaccountedChange = RiskyChange & { refused?: string };

/** What {@link gateResult} returns; `unaccounted` is there only when the range was graded. */
export type GateResult = {
  ok: boolean;
  items: OpenItem[];
  overridden: boolean;
  unreworked: UnreworkedEntry[];
  unaccounted?: UnaccountedChange[];
  overrideLabel: string;
};

/**
 * Every open item file for one PRD, sorted — `outboxItemFiles({ ctx })` scoped to its own
 * directory. A PRD with no folder at all (`ctx.layout.outboxDir(prd)` is `null`) has nothing open.
 */
export function openItemFiles(prd: PrdNumber, { ctx }: { ctx: Pick<OutboxContext, 'root' | 'layout'> }): string[] {
  const outboxDir = ctx.layout.outboxDir(prd);
  if (outboxDir === null) return [];
  const prefix = `${outboxDir}/`;
  return outboxItemFiles({ ctx }).filter((file) => file.startsWith(prefix));
}

/**
 * One open item file's id and rank, for the printed report. Falls back to `{ id: null, rank: null
 * }` when the file itself does not parse — a malformed item still holds the gate; it does not need
 * to be well-formed to count as open.
 */
function describeItem(file: string, { ctx }: { ctx: { root: string } }): OpenItem {
  const text = readRepoFile(ctx, file);
  const parsed = parseOutboxItem(text, { file });
  return parsed.ok
    ? { file, id: parsed.item.id, rank: parsed.item.rank }
    : { file, id: null, rank: null };
}

/** Every open item for one PRD, described for the report. */
export function openItems(prd: PrdNumber, { ctx }: { ctx: Pick<OutboxContext, 'root' | 'layout'> }): OpenItem[] {
  return openItemFiles(prd, { ctx }).map((file) => describeItem(file, { ctx }));
}

/**
 * The range's risky changes no account names for this PRD — the second reason `gateResult` can be
 * red (PRD #1044, slice s4). Pure over a precomputed `changes` list (`{ path, status }[]`, exactly
 * what `git diff --name-status` gives); this function shells out to nothing itself. Only a
 * successfully-parsed account (`ok: true`) is handed to `compare` — a malformed account file is not
 * this function's failure to report; `check-decision-coverage.mjs` is what refuses one.
 *
 * `base`, the knowledge folder as the range's base holds it, also grades `law-demoted` (PRD 1342).
 *
 * @param {string | number} prd
 * @param {{ path: string, status: string }[]} changes
 * @param {{ ctx: object, base?: object | null }} options
 * @returns {{ path: string, status: string, rule: string, refused?: string }[]}
 */
export function unaccountedChanges(
  prd: PrdNumber,
  changes: readonly Change[],
  { ctx, base = null }: { ctx: GateContext; base?: KnowledgeSource | null },
): UnaccountedChange[] {
  const risky: RiskyChange[] = riskyChanges(changes, { ctx, base });
  const accounts = readAccounts(prd, { ctx }).flatMap((result) => (result.ok ? [result.account] : []));
  return compare(risky, accounts).unaccounted;
}

/**
 * Every `drifted` decision this PRD's `settled.md` still holds open — the third reason
 * `gateResult` can be red (this task). Reads the ledger through `parseSettledEntries`
 * (`settle.mjs`), which already keeps only the LATEST entry per id, so an id reworked since it
 * drifted (its `Closed:` line amended in place to start with "yes") never shows up here. A PRD with
 * no folder at all, or a folder with no `settled.md` yet, has no drift to report.
 *
 * @param {string | number} prd
 * @param {{ ctx: object }} options
 * @returns {{ id: string, closedLine: string }[]}
 */
export function unreworkedDrift(prd: PrdNumber, { ctx }: { ctx: OutboxContext }): UnreworkedEntry[] {
  const outboxDir = ctx.layout.outboxDir(prd);
  if (outboxDir === null) return [];
  const settledFile = `${outboxDir}/${SETTLED_FILE}`;
  if (!existsSync(`${ctx.root}/${settledFile}`)) return [];
  const entries = parseSettledEntries(readRepoFile(ctx, settledFile), ctx.markers);
  return entries
    .filter((entry) => entry.verdict === 'drifted' && !entry.closed)
    .map((entry): UnreworkedEntry => ({ id: entry.id, closedLine: entry.fields.Closed }));
}

/**
 * The whole gate as a pure-ish function of a PRD, the labels on the pull request grading it, and
 * (optionally) the range's own changes. `ok: true` is a green gate. The label named by
 * `ctx.config.labels.outboxGo` overrides unconditionally, whatever the open-item count, the
 * unreworked-drift count, or the unaccounted-change count — that is the whole override, tested
 * here rather than in the workflow.
 *
 * `changes` is the range's `{ path, status }[]` (a caller-computed `git diff --name-status`); when
 * it is omitted, the range is never graded and the result carries no `unaccounted` field at all —
 * every existing caller of this function keeps its exact old shape and behavior.
 *
 * `base`, the knowledge folder as the range's base holds it, also grades `law-demoted` (PRD 1342).
 *
 * @param {string | number} prd
 * @param {{ ctx: object, labels?: string[], changes?: { path: string, status: string }[] | null, base?: object | null }} options
 */
export function gateResult(
  prd: PrdNumber,
  { ctx, labels = [], changes = null, base = null }: { ctx: GateContext; labels?: readonly string[]; changes?: readonly Change[] | null; base?: KnowledgeSource | null },
): GateResult {
  const items = openItems(prd, { ctx });
  const unreworked = unreworkedDrift(prd, { ctx });
  const overrideLabel = ctx.config.labels.outboxGo;
  const overridden = labels.includes(overrideLabel);

  if (changes === null) {
    const ok = overridden || (items.length === 0 && unreworked.length === 0);
    return { ok, items, overridden, unreworked, overrideLabel };
  }

  const unaccounted = unaccountedChanges(prd, changes, { ctx, base });
  const ok =
    overridden || (items.length === 0 && unreworked.length === 0 && unaccounted.length === 0);
  return { ok, items, overridden, unreworked, unaccounted, overrideLabel };
}

/** Where a fix's outbox lives (PRD 1342): an `outbox/` folder inside the fix's own folder. */
function fixOutboxDir(folder: string): string {
  return `${folder}/outbox`;
}

/**
 * `ctx` with its outbox read from a fix's folder (PRD 1342) rather than from a PRD's: every PRD
 * number names `<folder>/outbox`, and it is the only outbox there is. The gate, the accounts, the
 * settle step and the pull request comment read a fix's outbox through it unchanged.
 */
export function fixOutboxContext<C extends { root: string; layout: object }>(ctx: C, folder: string, number: PrdNumber): C {
  const dir = fixOutboxDir(folder);
  const layout = {
    ...ctx.layout,
    outboxDir: () => dir,
    outboxDirs: () => (existsSync(`${ctx.root}/${dir}`) ? [{ prd: number, dir, shipped: false }] : []),
  };
  return { ...ctx, layout };
}

/** What {@link fixGateResult} returns: the gate's result, always graded, and the outbox it read. */
export type FixGateResult = GateResult & { unaccounted: UnaccountedChange[]; outbox: string | null };

/**
 * The gate of a fix PR (PRD 1342): green unless its range fires one of the four law rules. A change
 * to a law is answered in the fix's own folder, `<folder>/outbox/`, exactly as a feature PR answers
 * it in its PRD's outbox: by an item ranked high that an account names, and that a person answered.
 * The other risk rules (`stored-shape`, `shared-contract`) ask a fix nothing. `fix` null: the
 * range holds no fix folder, so every change to a law is unaccounted. Nothing is asked unless
 * `laws.source` is `knowledge`. The override label waves it
 * through as it does a feature PR.
 */
export function fixGateResult({
  ctx,
  fix,
  labels = [],
  changes,
  base = null,
}: {
  ctx: GateContext;
  fix: { folder: string; number: PrdNumber } | null;
  labels?: readonly string[];
  changes: readonly Change[];
  base?: KnowledgeSource | null;
}): FixGateResult {
  const overrideLabel = ctx.config.labels.outboxGo;
  const overridden = labels.includes(overrideLabel);
  const outbox = fix === null ? null : fixOutboxDir(fix.folder);
  const laws = riskyChanges(changes, { ctx, base }).filter((change) => LAW_RULES.includes(change.rule));
  const clear = { items: [], unreworked: [], unaccounted: [], overridden, overrideLabel, outbox };
  if (laws.length === 0 || ctx.config.laws.source !== 'knowledge') return { ok: true, ...clear };
  if (fix === null) return { ...clear, ok: overridden, unaccounted: laws };

  const { folder, number } = fix;
  const fixCtx = fixOutboxContext(ctx, folder, number);
  const items = openItems(number, { ctx: fixCtx });
  const unreworked = unreworkedDrift(number, { ctx: fixCtx });
  const accounts = readAccounts(number, { ctx: fixCtx }).flatMap((result) => (result.ok ? [result.account] : []));
  const { unaccounted } = compare(laws, accounts);
  const ok = overridden || (items.length === 0 && unreworked.length === 0 && unaccounted.length === 0);
  return { ok, items, overridden, unreworked, unaccounted, overrideLabel, outbox };
}

/**
 * One line per change to a law a fix has not yet accounted for, naming the outbox it needs (what
 * `omni bug` and `omni visual` print). An open item is not a failure here: a person answers it on
 * the pull request.
 */
export function fixLawFailures(result: Pick<FixGateResult, 'unaccounted' | 'outbox'>): string[] {
  const { outbox } = result;
  return result.unaccounted.map((change) => {
    const head = `${change.path} (${change.rule}): `;
    if (outbox === null) return `${head}a change to a law needs an outbox in the fix's folder, and this range has no fix folder.`;
    if (change.refused !== undefined) return `${head}${change.refused}.`;
    return `${head}a change to a law needs an item ranked high in ${outbox}/ and an account naming it in ${outbox}/${ACCOUNTS_DIR}/.`;
  });
}

/**
 * What `omni bug` and `omni visual` ask of a fix's folder (PRD 1342): given the range and the base's
 * knowledge folder, the lines {@link fixLawFailures} names for the folder graded.
 */
export function fixLawCheck({ ctx, number, changes, base }: { ctx: GateContext; number: PrdNumber; changes: readonly Change[]; base: KnowledgeSource | null }): (folder: string) => string[] {
  return (folder) => fixLawFailures(fixGateResult({ ctx, fix: { folder, number }, changes, base }));
}

/** A law a range touches: its id, its statement and the register file it sits in. */
export type TouchedLaw = { id: string; statement: string; file: string };

/** The paths an entry's `Enforced by:` line names, none for `unenforced` or `pending #<n>`. */
function proofPaths(entry: KnowledgeEntry): string[] {
  if (!entry.enforced) return [];
  return String(entry.enforcedBy).split(',').map((path) => path.replace(/`/g, '').trim()).filter(Boolean);
}

/** A rule or an invariant, confirmed or proposed. */
function isRuleOrInvariant(entry: KnowledgeEntry): boolean {
  return entry.kind === 'rule' || entry.kind === 'invariant';
}

/** Whether the range touched `law`, given its other side `other` (`undefined`: on one side only). */
function touched(law: KnowledgeEntry, other: KnowledgeEntry | undefined, paths: ReadonlySet<string>, compared: boolean): boolean {
  if (proofPaths(law).some((path) => paths.has(path))) return true;
  if (!compared) return paths.has(law.file);
  return other === undefined || other.statement !== law.statement || other.enforcedBy !== law.enforcedBy;
}

/**
 * The laws (rules and invariants) a range touches (PRD 1342), sorted by id: a law whose proof the
 * range changes, and, given the base's knowledge folder, a law added, removed, reworded or given
 * another `Enforced by:`; without it, every law of a register file the range changes. What a
 * knowledge PR's or an enforce PR's check lists. None when `laws.source` is not `knowledge`.
 */
export function lawsTouched(changes: readonly Change[], { ctx, base = null }: { ctx: CoverageContext; base?: KnowledgeSource | null }): TouchedLaw[] {
  if (ctx.config.laws.source !== 'knowledge') return [];
  const paths = new Set(changes.map((change) => change.path));
  const head = readRegisters({ ctx }).entries.filter(isRuleOrInvariant);
  const was = base === null ? [] : readKnowledge({ ctx, source: base }).entries.filter(isRuleOrInvariant);
  const byId = (entries: KnowledgeEntry[]) => new Map(entries.map((entry) => [entry.id, entry]));
  const headById = byId(head);
  const wasById = byId(was);
  const compared = base !== null;
  const laws = new Map<string, TouchedLaw>();
  for (const entry of head) {
    if (touched(entry, wasById.get(entry.id), paths, compared)) laws.set(entry.id, entry);
  }
  for (const entry of was) {
    if (!laws.has(entry.id) && touched(entry, headById.get(entry.id), paths, compared)) laws.set(entry.id, entry);
  }
  return [...laws.values()]
    .map(({ id, statement, file }) => ({ id, statement, file }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function formatItem(item: OpenItem): string {
  return item.rank ? `  - ${item.file} (${item.rank})` : `  - ${item.file}`;
}

function formatUnaccounted(change: UnaccountedChange): string {
  const line = `  - ${change.path} (${change.rule})`;
  return change.refused === undefined ? line : `${line} — ${change.refused}`;
}

function formatUnreworked(entry: UnreworkedEntry): string {
  return `  - ${entry.id}`;
}

/**
 * Renders `gateResult`'s report to a string — what the workflow's log shows either way. Names each
 * reason the gate can be red distinctly: the open-item count, the unreworked-drift count (when
 * there is any), and, when `result` carries an `unaccounted` field at all (i.e. the caller graded
 * the range), the unaccounted-change count too. `subject` names what was graded: the PRD by
 * default, a fix's folder for a fix PR (PRD 1342).
 */
export function formatReport(
  prd: PrdNumber,
  result: {
    ok?: boolean;
    items: readonly OpenItem[];
    overridden?: boolean;
    overrideLabel?: string;
    unreworked?: readonly UnreworkedEntry[];
    unaccounted?: readonly UnaccountedChange[];
  },
  { subject = `PRD #${prd}` }: { subject?: string } = {},
): string {
  const lines: string[] = [];

  if (result.items.length === 0) {
    lines.push(`outbox-status — ${subject}: no open item.`);
  } else {
    lines.push(`outbox-status — ${subject}: ${result.items.length} open item(s):`);
    lines.push(...result.items.map(formatItem));
  }

  const unreworked = result.unreworked ?? [];
  if (unreworked.length > 0) {
    const n = unreworked.length;
    lines.push(
      `${n} drifted decision${n === 1 ? '' : 's'} not yet reworked — run ${COMMANDS.yoloFix} #${prd}`,
    );
    lines.push(...unreworked.map(formatUnreworked));
  }

  if (result.unaccounted !== undefined) {
    if (result.unaccounted.length === 0) {
      lines.push('outbox-status — no unaccounted risky change.');
    } else {
      lines.push(`outbox-status — ${result.unaccounted.length} unaccounted risky change(s):`);
      lines.push(...result.unaccounted.map(formatUnaccounted));
    }
  }

  if (result.overridden) {
    lines.push(`${result.overrideLabel} — override in effect; waved through.`);
  }
  return lines.join('\n');
}

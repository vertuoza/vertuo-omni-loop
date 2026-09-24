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
 * the human's decision disagree; a rework closes it by appending a fresh entry for the SAME id
 * whose `Closed:` field starts with "yes" — `settle.mjs`'s own "latest wins" rule
 * (`parseSettledEntries`) means only the newest entry for that id is ever read. `unreworkedDrift`
 * names every id still open in this sense, and it holds the gate exactly as an open item or an
 * unaccounted change does, even when the outbox itself is otherwise empty.
 *
 * The label named by `ctx.config.labels.outboxGo` overrides the gate unconditionally, whatever the
 * open-item count, the unreworked-drift count, or the unaccounted-change count — that override is
 * tested here, in the pure `gateResult`, not in the workflow's own branching.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-status.mjs — changes in kit/porting/outbox--status.md.
import { existsSync } from 'node:fs';
import { readRepoFile } from '../check-report.mjs';
import { COMMANDS } from '../commands.mjs';
import { compare, readAccounts } from './account.mjs';
import { riskyChanges } from './decision-coverage.mjs';
import { SETTLED_FILE, outboxItemFiles, parseOutboxItem } from './outbox.mjs';
import { parseSettledEntries } from './settle.mjs';

/**
 * Every open item file for one PRD, sorted — `outboxItemFiles({ ctx })` scoped to its own
 * directory. A PRD with no folder at all (`ctx.layout.outboxDir(prd)` is `null`) has nothing open.
 */
export function openItemFiles(prd, { ctx }) {
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
function describeItem(file, { ctx }) {
  const text = readRepoFile(ctx, file);
  const parsed = parseOutboxItem(text, { file });
  return parsed.ok
    ? { file, id: parsed.item.id, rank: parsed.item.rank }
    : { file, id: null, rank: null };
}

/** Every open item for one PRD, described for the report. */
export function openItems(prd, { ctx }) {
  return openItemFiles(prd, { ctx }).map((file) => describeItem(file, { ctx }));
}

/**
 * The range's risky changes no account names for this PRD — the second reason `gateResult` can be
 * red (PRD #1044, slice s4). Pure over a precomputed `changes` list (`{ path, status }[]`, exactly
 * what `git diff --name-status` gives); this function shells out to nothing itself. Only a
 * successfully-parsed account (`ok: true`) is handed to `compare` — a malformed account file is not
 * this function's failure to report; `check-decision-coverage.mjs` is what refuses one.
 *
 * @param {string | number} prd
 * @param {{ path: string, status: string }[]} changes
 * @param {{ ctx: object }} options
 * @returns {{ path: string, status: string, rule: string }[]}
 */
export function unaccountedChanges(prd, changes, { ctx }) {
  const risky = riskyChanges(changes, { ctx });
  const accounts = readAccounts(prd, { ctx })
    .filter((result) => result.ok)
    .map((result) => result.account);
  return compare(risky, accounts).unaccounted;
}

/**
 * Every `drifted` decision this PRD's `settled.md` still holds open — the third reason
 * `gateResult` can be red (this task). Reads the ledger through `parseSettledEntries`
 * (`settle.mjs`), which already keeps only the LATEST entry per id, so an id reworked since it
 * drifted (a fresh entry whose `Closed:` field starts with "yes") never shows up here. A PRD with
 * no folder at all, or a folder with no `settled.md` yet, has no drift to report.
 *
 * @param {string | number} prd
 * @param {{ ctx: object }} options
 * @returns {{ id: string, closedLine: string }[]}
 */
export function unreworkedDrift(prd, { ctx }) {
  const outboxDir = ctx.layout.outboxDir(prd);
  if (outboxDir === null) return [];
  const settledFile = `${outboxDir}/${SETTLED_FILE}`;
  if (!existsSync(`${ctx.root}/${settledFile}`)) return [];
  const entries = parseSettledEntries(readRepoFile(ctx, settledFile), ctx.markers);
  return entries
    .filter((entry) => entry.verdict === 'drifted' && !entry.closed)
    .map((entry) => ({ id: entry.id, closedLine: entry.fields.Closed }));
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
 * @param {string | number} prd
 * @param {{ ctx: object, labels?: string[], changes?: { path: string, status: string }[] | null }} options
 */
export function gateResult(prd, { ctx, labels = [], changes = null } = {}) {
  const items = openItems(prd, { ctx });
  const unreworked = unreworkedDrift(prd, { ctx });
  const overridden = labels.includes(ctx.config.labels.outboxGo);

  if (changes === null) {
    const ok = overridden || (items.length === 0 && unreworked.length === 0);
    return { ok, items, overridden, unreworked };
  }

  const unaccounted = unaccountedChanges(prd, changes, { ctx });
  const ok =
    overridden || (items.length === 0 && unreworked.length === 0 && unaccounted.length === 0);
  return { ok, items, overridden, unreworked, unaccounted };
}

function formatItem(item) {
  return item.rank ? `  - ${item.file} (${item.rank})` : `  - ${item.file}`;
}

function formatUnaccounted(change) {
  return `  - ${change.path} (${change.rule})`;
}

function formatUnreworked(entry) {
  return `  - ${entry.id}`;
}

/**
 * Renders `gateResult`'s report to a string — what the workflow's log shows either way. Names each
 * reason the gate can be red distinctly: the open-item count, the unreworked-drift count (when
 * there is any), and, when `result` carries an `unaccounted` field at all (i.e. the caller graded
 * the range), the unaccounted-change count too.
 */
export function formatReport(prd, result) {
  const lines = [];

  if (result.items.length === 0) {
    lines.push(`outbox-status — PRD #${prd}: no open item.`);
  } else {
    lines.push(`outbox-status — PRD #${prd}: ${result.items.length} open item(s):`);
    lines.push(...result.items.map(formatItem));
  }

  if ((result.unreworked ?? []).length > 0) {
    const n = result.unreworked.length;
    lines.push(
      `${n} drifted decision${n === 1 ? '' : 's'} not yet reworked — run ${COMMANDS.yoloFix} #${prd}`,
    );
    lines.push(...result.unreworked.map(formatUnreworked));
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
    lines.push('override label in effect — waved through.');
  }
  return lines.join('\n');
}

/**
 * **The diff names the risky ground** (PRD #1044, slice s1).
 *
 * Five rules read a change (`{ path, status }`, exactly what `git diff --name-status` gives) and
 * say whether it lands on ground where a silent decision would be expensive. `riskyChanges` is the
 * one entry point: it grades a whole range and returns every `{ path, status, rule }` a rule fired
 * on — **every** rule that matches a given change, never only the first, so a deleted test that is
 * also the proof of an invariant is reported as both `test-removed` and `law-proof`.
 *
 * Two of the five rules are repository-specific and come from `ctx.config.risk`: `stored-shape`
 * matches any of `risk.storedShape`'s regular expressions against the path, and `shared-contract`
 * matches any of `risk.sharedContract`'s prefixes. A repository that sets neither (the default,
 * `[]`) never fires either rule — the ground they name is this repository's own call, not a
 * literal this module hard-codes.
 *
 * `law-text` and `law-proof` are about the knowledge folder `ctx.layout.knowledgeRoot` roots and
 * the decision records under `ctx.layout.adrDir` — the law's own text, and a path an `Enforced
 * by:` line names as its proof. `law-proof` only ever fires when `ctx.config.laws.source` is
 * `'knowledge'`: a repository that keeps its laws elsewhere (an ADR list in CLAUDE.md, or none at
 * all) has no `Enforced by:` lines to read, and `law-proof` never fires for it. `law-proof` is
 * **derived** from `readRegisters({ ctx })`, read fresh on every call rather than copied into a
 * module-level constant — the anti-rot lever the PRD is built around: a register entry that gains
 * a real `Enforced by:` path widens this rule with no edit to this file.
 *
 * `test-removed` is structural and needs no context at all: a `*.test.*` or `*.feature` file,
 * deleted — the cheapest way to turn a red check green.
 *
 * `briefing-text` (PRD 1793) is about the rules every agent reads before it changes anything: a
 * change, of any status, to one of the briefing's files ({@link briefingFiles}: the briefing form at
 * its own path under `paths.playbook`, its `points-to` file, each section's `See:` file), its
 * pointers read at the head (`ctx.root`). It fires whatever `laws.source` says, never on another
 * playbook form and never on the kit's template of the briefing.
 *
 * `law-demoted` (PRD 1342) reads the range, not a change: given the knowledge folder as the base
 * holds it, it names each register file where a law left the registers, or where a law's
 * `Enforced by:` path turned to `pending #<n>` or `unenforced`. Its proof gone, the law's own test
 * no longer fires `law-proof`, so this is the rule that still sees the change.
 *
 * This module is pure: it takes the changes the caller already computed and, for `law-proof`, the
 * `ctx` to read the registers from. It shells out to nothing, reads no account, and touches no
 * gate — those are later slices (s2, s3, s4).
 */
// Ported from nimbus-brain@c4a210122:scripts/decision-coverage.mjs — changes in kit/porting/outbox--decision-coverage.md.
import type { Context } from '../context.ts';

/** What the rules read: the root, the config, and where the knowledge and decisions live. */
export type CoverageContext = Pick<Context, 'root' | 'config'> & {
  layout: Pick<Context['layout'], 'knowledgeRoot' | 'adrDir'>;
};
import type { NameStatus } from '../git.ts';
import { isOwnedBy, isPersonOwner } from '../codeowners.ts';
import { briefingFiles, isBriefingFile } from '../playbook/briefing-files.ts';
import { isConfirmedRule, isLaw, readKnowledge, readRegisters } from '../knowledge/registers.ts';
import type { KnowledgeEntry, KnowledgeSource } from '../knowledge/registers.ts';

/** One change a rule fired on, and which rule. */
export type RiskyChange = { path: string; status: string; rule: string };

/** A `*.test.*` or `*.feature` file. */
const TEST_OR_FEATURE_PATH = /\.test\.[^/]+$|\.feature$/;

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `ctx.config.risk.storedShape.some((s) => new RegExp(s).test(path))` — a repository's own list
 * of stored-shape patterns; `[]` by default, so this fires nothing unless the repository sets it. */
function isStoredShape(change: NameStatus, { ctx }: { ctx: CoverageContext }): boolean {
  return ctx.config.risk.storedShape.some((source: string) => new RegExp(source).test(change.path));
}

/**
 * Every path named by an `Enforced by:` line anywhere under `ctx.layout.knowledgeRoot`, read
 * fresh through `readRegisters({ ctx })` — never memoized past the call it is computed in. A line
 * may hold several comma-separated paths (one register entry names three) and may be the literal
 * `unenforced`, which names no path.
 *
 * @param {{ ctx: object }} options
 * @returns {Set<string>}
 */
export function enforcedByPaths({ ctx }: { ctx: CoverageContext }): Set<string> {
  return new Set(readRegisters({ ctx }).entries.flatMap(proofPathsOf));
}

/** The paths one entry's `Enforced by:` line names; none for `unenforced` or `pending #<n>` (PRD 1342). */
function proofPathsOf(entry: KnowledgeEntry): string[] {
  if (!entry.enforced) return [];
  return String(entry.enforcedBy)
    .split(',')
    .map((rawPath) => rawPath.replace(/`/g, '').trim())
    .filter(Boolean);
}

/** The path is named by an `Enforced by:` line under `ctx.layout.knowledgeRoot`, read at call
 * time — only when `ctx.config.laws.source` is `'knowledge'`; otherwise this never fires. */
function isLawProof(change: NameStatus, { ctx }: { ctx: CoverageContext }): boolean {
  if (ctx.config.laws.source !== 'knowledge') return false;
  return enforcedByPaths({ ctx }).has(change.path);
}

/** A file directly under `<knowledgeRoot>/product/` or `<knowledgeRoot>/domains/<d>/` named
 * `principles.md`, `rules.md`, `invariants.md` or `contracts.md` (a domain contract, PRD 1796: a
 * change to the file it points to fires nothing by itself); any `.md` under `<knowledgeRoot>/cross-domain/`;
 * or any `.md` directly under `ctx.layout.adrDir` but its `README.md`. A folder's `README.md`
 * describes; it states no law — the ADR folder's is the decisions form (PRD #45). */
function isLawText(change: NameStatus, { ctx }: { ctx: CoverageContext }): boolean {
  const knowledgeRoot = escapeRegExp(ctx.layout.knowledgeRoot);
  const adrDir = escapeRegExp(ctx.layout.adrDir);
  const pattern = new RegExp(
    `^${knowledgeRoot}/(?:product|domains/[^/]+)/(?:principles|rules|invariants|contracts)\\.md$` +
      `|^${knowledgeRoot}/cross-domain/[^/]+\\.md$` +
      `|^${adrDir}/(?!README\\.md$)[^/]+\\.md$`,
  );
  return pattern.test(change.path);
}

/** A `*.test.*` or `*.feature` file, deleted. */
function isTestRemoved(change: NameStatus): boolean {
  return change.status === 'D' && TEST_OR_FEATURE_PATH.test(change.path);
}

/** `ctx.config.risk.sharedContract.some((p) => path.startsWith(p))` — a repository's own list of
 * shared-contract prefixes; `[]` by default, so this fires nothing unless the repository sets it. */
function isSharedContract(change: NameStatus, { ctx }: { ctx: CoverageContext }): boolean {
  return ctx.config.risk.sharedContract.some((prefix: string) => change.path.startsWith(prefix));
}

/**
 * The five rules, ids exactly as the plan and the spec spell them. Every `matches` function takes
 * the change and the same `{ ctx }` `riskyChanges` was given, even the ones (`test-removed`) that
 * ignore it.
 */
const RULES: { id: string; matches: (change: NameStatus, options: { ctx: CoverageContext }) => boolean }[] = [
  { id: 'stored-shape', matches: isStoredShape },
  { id: 'law-proof', matches: isLawProof },
  { id: 'law-text', matches: isLawText },
  { id: 'test-removed', matches: isTestRemoved },
  { id: 'shared-contract', matches: isSharedContract },
];

/** The rule a range fires when it takes a law's proof away or removes the law (PRD 1342). */
const LAW_DEMOTED = 'law-demoted';

/** The rule a change to one of the briefing's files fires (PRD 1793). */
export const BRIEFING_TEXT = 'briefing-text';

/** The five per-change rule ids, in `RULES`' own order, then `briefing-text`, then `law-demoted`, read over the range. */
export const RULE_IDS = [...RULES.map((rule) => rule.id), BRIEFING_TEXT, LAW_DEMOTED];

/**
 * The register files where a confirmed rule or invariant ({@link isConfirmedRule}: every law, and
 * every rule no `Proposed:` line holds back) was demoted between `base` and the head (`ctx.root`),
 * each once: the base's file of one the head no longer holds, and the head's file of one whose base
 * named a proof path and whose head is `pending #<n>` or `unenforced`. One moved to another path,
 * or promoted, is not demoted. Never fires when `ctx.config.laws.source` is not `'knowledge'`.
 */
function demotedFiles({ ctx, base }: { ctx: CoverageContext; base: KnowledgeSource }): string[] {
  if (ctx.config.laws.source !== 'knowledge') return [];
  const head = new Map(readRegisters({ ctx }).entries.map((entry) => [entry.id, entry]));
  const files = new Set<string>();
  for (const was of readKnowledge({ ctx, source: base }).entries.filter(isConfirmedRule)) {
    const now = head.get(was.id);
    if (now === undefined) files.add(was.file);
    else if (was.enforced && !now.enforced) files.add(now.file);
  }
  return [...files];
}

/**
 * Grades a range's changes against the five rules, then `briefing-text`. Returns every `{ path,
 * status, rule }` a rule fired on — a change matching two rules produces two entries, in `RULE_IDS`
 * order, and neither shadows the other.
 *
 * `base` is the knowledge folder as the range's base holds it (PRD 1342): given, `law-demoted`
 * fires once per register file holding a demoted law, after the per-change rules, with that file's
 * status in `changes` (`M` when the range does not list it). Omitted, it never fires.
 *
 * @param {{ path: string, status: string }[]} changes
 * @param {{ ctx: object, base?: object | null }} options
 * @returns {{ path: string, status: string, rule: string }[]}
 */
export function riskyChanges(
  changes: readonly NameStatus[],
  { ctx, base = null }: { ctx: CoverageContext; base?: KnowledgeSource | null },
): RiskyChange[] {
  const risky: RiskyChange[] = [];
  const briefing = briefingFiles({ ctx });
  for (const change of changes) {
    for (const rule of RULES) {
      if (rule.matches(change, { ctx })) {
        risky.push({ path: change.path, status: change.status, rule: rule.id });
      }
    }
    if (isBriefingFile(change.path, briefing)) risky.push({ path: change.path, status: change.status, rule: BRIEFING_TEXT });
  }
  if (base === null) return risky;
  const statuses = new Map(changes.map((change) => [change.path, change.status]));
  for (const path of demotedFiles({ ctx, base })) {
    risky.push({ path, status: statuses.get(path) ?? 'M', rule: LAW_DEMOTED });
  }
  return risky;
}

/** The rule a range fires when it changes a locked law (PRD 1726): only its files' CODEOWNERS clear it. */
export const LAW_LOCKED = 'law-locked';

/** A change `law-locked` fired on, and the law it changed. */
export type LockedLawChange = RiskyChange & { law: string };

/** An entry as read, every field: where it sits counts, so a law moved to another register is changed. */
function entryText(entry: KnowledgeEntry): string {
  return JSON.stringify(entry);
}

/**
 * **`law-locked`** (PRD 1726): every change of the range to a locked law, the law named. A law is a
 * locked rule or invariant ({@link isLaw}) at the base or at the head (`ctx.root`). It fires on:
 *
 * - the register file of a law the base and the head do not hold alike: a `Locked:` line added or
 *   removed, its text edited, or the entry deleted — only when that file is among `changes`, so a
 *   base branch that moved on alone fires nothing;
 * - a path a law's `Enforced by:` line names, at the base or the head, among `changes`.
 *
 * A rule or invariant no one locked never fires it: the rule-level gate (`law-proof`, `law-text`,
 * `law-demoted`, {@link riskyChanges}) is unchanged. It is not one of `RULE_IDS`: no account clears
 * it, only an approving review on GitHub ({@link lawsAwaitingOwners}). Without a `base`, only the
 * proofs of the head's laws are read. Never fires when `ctx.config.laws.source` is not `'knowledge'`.
 */
export function lockedLawChanges(
  changes: readonly NameStatus[],
  { ctx, base = null }: { ctx: CoverageContext; base?: KnowledgeSource | null },
): LockedLawChange[] {
  if (ctx.config.laws.source !== 'knowledge') return [];
  const statuses = new Map(changes.map((change) => [change.path, change.status]));
  const head = new Map(readRegisters({ ctx }).entries.map((entry) => [entry.id, entry]));
  const was = new Map((base === null ? [] : readKnowledge({ ctx, source: base }).entries).map((entry) => [entry.id, entry]));
  const fired: LockedLawChange[] = [];
  const fire = (law: string, path: string) => {
    const status = statuses.get(path);
    if (status === undefined || fired.some((one) => one.law === law && one.path === path)) return;
    fired.push({ path, status, rule: LAW_LOCKED, law });
  };
  for (const id of new Set([...was.keys(), ...head.keys()])) {
    for (const path of lawPaths(was.get(id), head.get(id), { compared: base !== null })) fire(id, path);
  }
  return fired;
}

/**
 * The paths one entry's change may fire `law-locked` on, when it is a law at the base (`before`) or
 * at the head (`after`): its register file when the two differ (`compared`: a base was read), then
 * the paths its `Enforced by:` names. None when it is a law at neither end.
 */
function lawPaths(before: KnowledgeEntry | undefined, after: KnowledgeEntry | undefined, { compared }: { compared: boolean }): string[] {
  const laws = [before, after].filter((entry) => entry !== undefined).filter(isLaw);
  const changed = compared && (before === undefined || after === undefined || entryText(before) !== entryText(after));
  return [...laws.filter(() => changed).map((entry) => entry.file), ...laws.flatMap(proofPathsOf)];
}

/** Why a law a range changed is not cleared yet: no person owns one of its files, or no owner approved. */
export type LawAwaiting = { law: string; reason: 'no-codeowner' | 'no-approval'; paths: string[]; owners: string[] };

/**
 * What still holds each law `law-locked` fired on (PRD 1726). Every file that fired it must be
 * approved by a person CODEOWNERS lists for that file (`ownersOf`, read from the base branch), among
 * `approvers` (the logins whose review approves the head). A file no person in CODEOWNERS owns falls
 * back to `lawOwners`, the logins the base branch's config names as law owners (issue 2387: a law
 * moved into a new file, or a new domain's file, is still cleared by a law owner's approval). With
 * neither, the file holds its law as `no-codeowner`, whatever was approved (fail closed); otherwise a
 * file none of its owners approved holds it as `no-approval`. `paths` are the files holding it,
 * `owners` the persons who could clear them. `approvedBy`: the approvers who cleared a file.
 */
export function lawsAwaitingOwners(
  fired: readonly LockedLawChange[],
  { ownersOf, approvers, lawOwners = [] }: { ownersOf: (path: string) => string[]; approvers: readonly string[]; lawOwners?: readonly string[] },
): { awaiting: LawAwaiting[]; approvedBy: string[] } {
  const fallback = lawOwners.map((login) => `@${login.replace(/^@/, '')}`).filter(isPersonOwner);
  const files = fired.map(({ law, path }) => {
    const listed = ownersOf(path).filter(isPersonOwner);
    const persons = listed.length > 0 ? listed : fallback;
    return { law, path, persons, approved: approvers.filter((login) => isOwnedBy(persons, login)) };
  });
  const awaiting: LawAwaiting[] = [];
  for (const law of new Set(fired.map((one) => one.law))) {
    const own = files.filter((file) => file.law === law);
    const owners = [...new Set(own.flatMap((file) => file.persons))];
    const unowned = own.filter((file) => file.persons.length === 0).map((file) => file.path);
    const unapproved = own.filter((file) => file.approved.length === 0).map((file) => file.path);
    if (unowned.length > 0) awaiting.push({ law, reason: 'no-codeowner', paths: unowned, owners });
    else if (unapproved.length > 0) awaiting.push({ law, reason: 'no-approval', paths: unapproved, owners });
  }
  return { awaiting, approvedBy: [...new Set(files.flatMap((file) => file.approved))] };
}

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
 * This module is pure: it takes the changes the caller already computed and, for `law-proof`, the
 * `ctx` to read the registers from. It shells out to nothing, reads no account, and touches no
 * gate — those are later slices (s2, s3, s4).
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/decision-coverage.mjs — changes in kit/porting/outbox--decision-coverage.md.
import type { Context } from '../context.ts';
import type { NameStatus } from '../git.ts';
import { readRegisters } from '../knowledge/registers.ts';

/** One change a rule fired on, and which rule. */
export type RiskyChange = { path: string; status: string; rule: string };

/** A `*.test.*` or `*.feature` file. */
const TEST_OR_FEATURE_PATH = /\.test\.[^/]+$|\.feature$/;

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `ctx.config.risk.storedShape.some((s) => new RegExp(s).test(path))` — a repository's own list
 * of stored-shape patterns; `[]` by default, so this fires nothing unless the repository sets it. */
function isStoredShape(change: NameStatus, { ctx }: { ctx: Context }): boolean {
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
export function enforcedByPaths({ ctx }: { ctx: Context }): Set<string> {
  const { entries } = readRegisters({ ctx });
  const paths = new Set<string>();
  for (const entry of entries) {
    if (!entry.enforcedBy || entry.enforcedBy === 'unenforced') continue;
    for (const rawPath of entry.enforcedBy.split(',')) {
      const path = rawPath.replace(/`/g, '').trim();
      if (path) paths.add(path);
    }
  }
  return paths;
}

/** The path is named by an `Enforced by:` line under `ctx.layout.knowledgeRoot`, read at call
 * time — only when `ctx.config.laws.source` is `'knowledge'`; otherwise this never fires. */
function isLawProof(change: NameStatus, { ctx }: { ctx: Context }): boolean {
  if (ctx.config.laws.source !== 'knowledge') return false;
  return enforcedByPaths({ ctx }).has(change.path);
}

/** A file directly under `<knowledgeRoot>/product/` or `<knowledgeRoot>/domains/<d>/` named
 * `principles.md`, `rules.md` or `invariants.md`; any `.md` under `<knowledgeRoot>/cross-domain/`;
 * or any `.md` directly under `ctx.layout.adrDir` but its `README.md`. A folder's `README.md`
 * describes; it states no law — the ADR folder's is the decisions form (PRD #45). */
function isLawText(change: NameStatus, { ctx }: { ctx: Context }): boolean {
  const knowledgeRoot = escapeRegExp(ctx.layout.knowledgeRoot);
  const adrDir = escapeRegExp(ctx.layout.adrDir);
  const pattern = new RegExp(
    `^${knowledgeRoot}/(?:product|domains/[^/]+)/(?:principles|rules|invariants)\\.md$` +
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
function isSharedContract(change: NameStatus, { ctx }: { ctx: Context }): boolean {
  return ctx.config.risk.sharedContract.some((prefix: string) => change.path.startsWith(prefix));
}

/**
 * The five rules, ids exactly as the plan and the spec spell them. Every `matches` function takes
 * the change and the same `{ ctx }` `riskyChanges` was given, even the ones (`test-removed`) that
 * ignore it.
 */
const RULES: { id: string; matches: (change: NameStatus, options: { ctx: Context }) => boolean }[] = [
  { id: 'stored-shape', matches: isStoredShape },
  { id: 'law-proof', matches: isLawProof },
  { id: 'law-text', matches: isLawText },
  { id: 'test-removed', matches: isTestRemoved },
  { id: 'shared-contract', matches: isSharedContract },
];

/** The five rule ids, in `RULES`' own order. */
export const RULE_IDS = RULES.map((rule) => rule.id);

/**
 * Grades a range's changes against all five rules. Returns every `{ path, status, rule }` a rule
 * fired on — a change matching two rules produces two entries, in `RULES` order, and neither
 * shadows the other.
 *
 * @param {{ path: string, status: string }[]} changes
 * @param {{ ctx: object }} options
 * @returns {{ path: string, status: string, rule: string }[]}
 */
export function riskyChanges(changes: readonly NameStatus[], { ctx }: { ctx: Context }): RiskyChange[] {
  const risky: RiskyChange[] = [];
  for (const change of changes) {
    for (const rule of RULES) {
      if (rule.matches(change, { ctx })) {
        risky.push({ path: change.path, status: change.status, rule: rule.id });
      }
    }
  }
  return risky;
}

// @ts-nocheck
/**
 * **A brainstorm ends in a phase-0 pull request** (PRD #1015, slice s6).
 *
 * Executable policy beside the skill's prose, the same shape `outbox-policy.mjs` has: what a
 * phase-0 pull request may carry, as pure functions a test can hold open with no model in the
 * loop. The brainstorming skill tells the agent what to do; this module is what decides whether
 * it did it.
 *
 * Two rules, both of them scenarios of the PRD:
 *
 * 1. **No source file is in that pull request.** A phase-0 pull request is the review gate between
 *    a design being approved and delivery beginning. It carries the PRD's own spec, plan and
 *    before/after page — the three files that live directly under its own delivery folder
 *    (`ctx.layout.whereIs(prd).dir`) — and, when this repository grades acceptance separately
 *    (`ctx.config.acceptance.enabled`), a pending acceptance file. Everything else in the diff makes
 *    the pull request not docs-only. {@link classifyPhase0Path} sorts one path against one known
 *    PRD; {@link phase0Verdict} grades the whole set.
 * 2. **The handoff points at a repository path rather than a private link.** A `claude.ai` artifact
 *    is private to its author, so the URL in a PRD's Handoff cannot be opened by the people the
 *    spec is for. {@link beforeAfterHandoff} refuses one by name.
 *
 * Nothing here restates the folder layout: `ctx.layout.specPath`/`planPath`/`beforeAfterPath` are
 * the one place a PRD's own delivery files are named, so a phase-0 pull request and the rest of the
 * kit can never disagree about where a file belongs.
 *
 * A third rule came with PRD #99: **every commit in that pull request is signed.** A phase-0 branch
 * is made only by the loop, so a commit without the trailer `omni sign trailer` prints is a skill
 * that forgot to sign. {@link phase0Verdict} grades the commits it is given; with `signature: null`
 * in the config it grades none.
 */
// Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-brainstorming/phase-0-policy.mjs — changes in kit/porting/policy--phase-0.md.
import { carriesTrailer, trailerLine } from '../signature.ts';

/**
 * The three things a phase-0 pull request exists to offer for review, in the order a reader wants
 * them: what was decided, how it will be built, and what it will look like.
 */
export const PHASE_0_REQUIRED_KINDS = /** @type {const} */ (['spec', 'plan', 'before-after']);

/** Repo-relative, no `./` and no leading slash — so `a/b.md` and `./a/b.md` classify alike. */
function normalize(path) {
  return String(path ?? '')
    .trim()
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

/**
 * The three files a phase-0 pull request carries for one PRD, plus where a pending acceptance file
 * would sit — `null` when this repository does not grade acceptance separately
 * (`ctx.config.acceptance.enabled` is `false`).
 *
 * @param {number | string} prd
 * @param {{ ctx: object }} options
 * @returns {{ spec: string | null, plan: string | null, beforeAfter: string | null, acceptanceDir: string | null }}
 */
export function phase0Paths(prd, { ctx }) {
  const { acceptance } = ctx.config;
  return {
    spec: ctx.layout.specPath(prd),
    plan: ctx.layout.planPath(prd),
    beforeAfter: ctx.layout.beforeAfterPath(prd),
    acceptanceDir: acceptance.enabled ? acceptance.dir : null,
  };
}

/** `.pending.feature`, or `ctx.config.acceptance.pendingSuffix` when this repository names its own. */
function acceptanceSuffix(ctx) {
  return ctx.config.acceptance.pendingSuffix ?? '.feature';
}

function isPendingAcceptance(file, ctx) {
  const { acceptance } = ctx.config;
  if (!acceptance.enabled || !acceptance.dir) return false;
  return file.startsWith(`${acceptance.dir}/`) && file.endsWith(acceptanceSuffix(ctx));
}

/**
 * Whether `file` reads as an ordinary document rather than code — the kit's equivalent of a bare
 * fixed documentation-tree fallback, generalized to the places the kit's own config and layout
 * name as prose rather than as one fixed directory: anywhere under the delivery tree
 * (`ctx.config.paths.delivery` — every PRD's own folder, not only the one a verdict is grading),
 * the knowledge folder or the ADR directory, the configured glossary file, or one of the
 * configured context files (`CLAUDE.md` by default). Checked AFTER the PRD-specific kinds and the
 * acceptance-pending kind, exactly as upstream checked its specific kinds before falling back to a
 * bare documentation prefix — so this never reclassifies a path {@link classifyPhase0Path} already
 * named `spec`/`plan`/`before-after`/`pending-acceptance`.
 */
function isDocsPath(file, ctx) {
  const { paths } = ctx.config;
  const prefixes = [paths.delivery, ctx.layout.knowledgeRoot, ctx.layout.adrDir].filter(Boolean);
  if (prefixes.some((prefix) => file === prefix || file.startsWith(`${prefix}/`))) return true;
  if (paths.glossary && file === paths.glossary) return true;
  if ((paths.context ?? []).includes(file)) return true;
  return false;
}

/**
 * Sorts one changed path into `'spec' | 'plan' | 'before-after' | 'pending-acceptance' | 'docs' |
 * 'source'`, against the one PRD named. The first three are exact: a path belonging to a
 * DIFFERENT PRD's own folder is never `spec`/`plan`/`before-after` for THIS one — but it still
 * falls into `docs`, since it sits under the shared delivery tree, exactly as any other document
 * does. `source` is everything else — code, config, a test — the one thing a phase-0 pull request
 * may never carry.
 *
 * @param {string} path repo-relative
 * @param {{ ctx: object, prd: number | string }} options
 */
export function classifyPhase0Path(path, { ctx, prd }) {
  const file = normalize(path);
  const paths = phase0Paths(prd, { ctx });
  if (file === paths.spec) return 'spec';
  if (file === paths.plan) return 'plan';
  if (file === paths.beforeAfter) return 'before-after';
  if (isPendingAcceptance(file, ctx)) return 'pending-acceptance';
  if (isDocsPath(file, ctx)) return 'docs';
  return 'source';
}

/** The paths that make a set not docs-only, in the order they were given. */
function sourceFiles(paths, ctx) {
  return (paths ?? [])
    .map(normalize)
    .filter((file) => file && !isPendingAcceptance(file, ctx) && !isDocsPath(file, ctx));
}

/**
 * Whether a set of changed paths is docs-only — the rule the scenario states as *no source file is
 * in that pull request*. Structural, and not tied to any one PRD: a path counts as a document when
 * it is a pending acceptance file or reads as an ordinary document ({@link isDocsPath}) —
 * including, deliberately, another PRD's own spec/plan/before-after, since that is still a
 * document, just not one THIS PRD's own verdict ({@link phase0Verdict}) carries as required. An
 * empty set is docs-only and says nothing else; {@link phase0Verdict} is what refuses a pull
 * request carrying nothing for the one PRD it grades.
 *
 * @param {string[]} paths
 * @param {{ ctx: object }} options
 */
export function isDocsOnly(paths, { ctx }) {
  return sourceFiles(paths, ctx).length === 0;
}

/**
 * Grades a candidate phase-0 pull request, for one PRD, by what its diff contains.
 *
 * `ok` needs both halves: the set is docs-only, **and** it carries the three kinds a reviewer is
 * being asked to approve for THIS PRD. A pull request that is docs-only but carries no plan is not
 * a phase-0 pull request; it is a docs change.
 *
 * A change with nothing to show — docs, a config — writes no before/after page and says so; pass
 * `needsBeforeAfter: false` for that case rather than inventing a page to satisfy the check.
 *
 * `commits` are the range's commits, `{ sha, message }` each: every one must carry the signature's
 * trailer, or the verdict is not ok and names it in `unsigned`. `signed` is `true` or `false` once
 * graded, and `null` when nothing was graded — `signature: null` in the config, or no `commits`
 * given.
 *
 * @param {string[]} paths repo-relative changed paths
 * @param {{ ctx: object, prd: number | string, needsBeforeAfter?: boolean, commits?: { sha: string, message: string }[] }} options
 */
export function phase0Verdict(paths, { ctx, prd, needsBeforeAfter = true, commits } = {}) {
  const files = (paths ?? []).map(normalize).filter(Boolean);
  const kinds = files.map((file) => classifyPhase0Path(file, { ctx, prd }));
  const carries = {
    spec: files.filter((_, index) => kinds[index] === 'spec'),
    plan: files.filter((_, index) => kinds[index] === 'plan'),
    'before-after': files.filter((_, index) => kinds[index] === 'before-after'),
    'pending-acceptance': files.filter((_, index) => kinds[index] === 'pending-acceptance'),
    docs: files.filter((_, index) => kinds[index] === 'docs'),
    source: files.filter((_, index) => kinds[index] === 'source'),
  };

  const offending = carries.source;
  const required = PHASE_0_REQUIRED_KINDS.filter(
    (kind) => kind !== 'before-after' || needsBeforeAfter,
  );
  const missing = required.filter((kind) => carries[kind].length === 0);
  const docsOnly = offending.length === 0;
  const { signed, trailer, unsigned } = gradeSignature(commits, ctx.config.signature);
  const ok = docsOnly && missing.length === 0 && unsigned.length === 0;

  return {
    ok,
    docsOnly,
    label: ctx.config.labels.phase0,
    base: ctx.config.repo.defaultBranch,
    carries,
    sourceFiles: offending,
    missing,
    signed,
    trailer,
    unsigned,
    reason: phase0Reason({ ok, docsOnly, offending, missing, trailer, unsigned }),
  };
}

/** The commits without the signature's trailer, as `{ sha, subject }`, in the order given. */
function gradeSignature(commits, signature) {
  const trailer = trailerLine(signature);
  if (trailer === null || commits === undefined) return { signed: null, trailer, unsigned: [] };
  const unsigned = commits
    .filter((commit) => !carriesTrailer(commit.message, signature))
    .map((commit) => ({ sha: commit.sha, subject: String(commit.message ?? '').split('\n')[0].trim() }));
  return { signed: unsigned.length === 0, trailer, unsigned };
}

function phase0Reason({ ok, docsOnly, offending, missing, trailer, unsigned }) {
  if (ok) {
    return 'docs-only, and it carries the spec, the plan and the before/after a reviewer is being asked to approve';
  }
  const faults = [];
  if (!docsOnly) {
    faults.push(
      `a phase-0 pull request carries no source file — ${offending.join(', ')} ${offending.length === 1 ? 'is' : 'are'} not a document`,
    );
  }
  if (missing.length > 0) {
    faults.push(`nothing in it is the ${missing.join(', the ')}`);
  }
  if (unsigned.length > 0) {
    const shas = unsigned.map((commit) => commit.sha).join(', ');
    faults.push(`unsigned: ${shas} ${unsigned.length === 1 ? 'has' : 'have'} no "${trailer}" line`);
  }
  return faults.join('; ');
}

/**
 * Grades the `Before/after:` line of a PRD's Handoff.
 *
 * With `ctx` AND `prd` both given, a repository path must equal that PRD's own
 * `ctx.layout.beforeAfterPath(prd)` exactly — "the right place is named", upstream's own rule,
 * restored here now that a caller who has both can be held to it. **Without them** (the default),
 * this function has no way to resolve a specific PRD's own folder, so it falls back to a weaker,
 * structural check: the path's basename must be `before-after.html`, wherever it sits. Callers
 * that know their PRD should always pass `{ ctx, prd }`; the basename-only fallback exists for
 * callers that do not (yet) have both in hand.
 *
 * `none` is accepted, because a change with nothing to show says so. Anything reachable only over
 * the network is refused, and a `claude.ai` artifact is refused in its own words: it is private to
 * its author, so the people the spec is written for cannot open it. That is the whole reason this
 * slice exists.
 *
 * @param {string} value the Handoff line's value
 * @param {{ ctx?: object, prd?: number | string }} [options]
 */
export function beforeAfterHandoff(value, { ctx, prd } = {}) {
  const stated = String(value ?? '').trim();

  if (stated === '') {
    return refusal(
      stated,
      'the Handoff states a before/after or states "none" — it is never blank',
    );
  }
  if (stated === 'none') {
    return { ok: true, path: null, reason: 'nothing to show, and the Handoff says so' };
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(stated)) {
    return refusal(
      stated,
      /claude\.ai/i.test(stated)
        ? 'a claude.ai artifact is private to its author, so the people this spec is for cannot open it — write the page to the repository instead'
        : 'a before/after reachable only over the network is not versioned, diffable, or reviewed in the pull request that introduces it',
    );
  }
  const path = normalize(stated);

  if (ctx && prd !== undefined && prd !== null) {
    const expected = ctx.layout.beforeAfterPath(prd);
    if (path !== expected) {
      return refusal(stated, `a before/after page for this PRD lives at ${expected}`);
    }
    return {
      ok: true,
      path,
      reason: 'a repository path: versioned, diffable, and reviewed in the phase-0 pull request',
    };
  }

  if (path.split('/').pop() !== 'before-after.html') {
    return refusal(
      stated,
      'a before/after page is named before-after.html, inside the PRD\'s own delivery folder',
    );
  }
  return {
    ok: true,
    path,
    reason: 'a repository path: versioned, diffable, and reviewed in the phase-0 pull request',
  };
}

function refusal(value, reason) {
  return { ok: false, path: null, reason: `${reason} (got "${value}")` };
}

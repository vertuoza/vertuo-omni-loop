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
 */
// Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-brainstorming/phase-0-policy.mjs — changes in kit/porting/policy--phase-0.md.

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

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
 * Whether `file` is one of the three delivery files ANY PRD's own folder carries — used where the
 * specific PRD is not known (`isDocsOnly`), never to decide which PRD a path belongs to.
 */
function ownDeliveryFileKind(file, ctx) {
  const { dirs } = ctx.layout;
  for (const prefix of [dirs.inbox, dirs.shipped].filter(Boolean)) {
    const match = file.match(
      new RegExp(`^${escapeRegExp(prefix)}/[^/]+/(spec\\.md|plan\\.md|before-after\\.html)$`),
    );
    if (!match) continue;
    if (match[1] === 'spec.md') return 'spec';
    if (match[1] === 'plan.md') return 'plan';
    return 'before-after';
  }
  return null;
}

/**
 * Sorts one changed path into `'spec' | 'plan' | 'before-after' | 'pending-acceptance' | 'source'`,
 * against the one PRD named. Exact: a path belonging to a DIFFERENT PRD's own folder is `'source'`
 * too — a phase-0 pull request for one PRD carries that PRD's own three files, never another one's.
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
  return 'source';
}

/** The paths that make a set not docs-only, in the order they were given. */
function sourceFiles(paths, ctx) {
  return (paths ?? [])
    .map(normalize)
    .filter((file) => file && ownDeliveryFileKind(file, ctx) === null && !isPendingAcceptance(file, ctx));
}

/**
 * Whether a set of changed paths is docs-only — the rule the scenario states as *no source file is
 * in that pull request*. Structural, and not tied to any one PRD: a path counts as a document when
 * it is SOME PRD's own spec/plan/before-after file, or a pending acceptance file, whichever PRD it
 * belongs to. An empty set is docs-only and says nothing else; {@link phase0Verdict} is what
 * refuses a pull request carrying nothing for the one PRD it grades.
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
 * @param {string[]} paths repo-relative changed paths
 * @param {{ ctx: object, prd: number | string, needsBeforeAfter?: boolean }} options
 */
export function phase0Verdict(paths, { ctx, prd, needsBeforeAfter = true } = {}) {
  const files = (paths ?? []).map(normalize).filter(Boolean);
  const kinds = files.map((file) => classifyPhase0Path(file, { ctx, prd }));
  const carries = {
    spec: files.filter((_, index) => kinds[index] === 'spec'),
    plan: files.filter((_, index) => kinds[index] === 'plan'),
    'before-after': files.filter((_, index) => kinds[index] === 'before-after'),
    'pending-acceptance': files.filter((_, index) => kinds[index] === 'pending-acceptance'),
    source: files.filter((_, index) => kinds[index] === 'source'),
  };

  const offending = carries.source;
  const required = PHASE_0_REQUIRED_KINDS.filter(
    (kind) => kind !== 'before-after' || needsBeforeAfter,
  );
  const missing = required.filter((kind) => carries[kind].length === 0);
  const docsOnly = offending.length === 0;
  const ok = docsOnly && missing.length === 0;

  return {
    ok,
    docsOnly,
    label: ctx.config.labels.phase0,
    base: ctx.config.repo.defaultBranch,
    carries,
    sourceFiles: offending,
    missing,
    reason: phase0Reason({ ok, docsOnly, offending, missing }),
  };
}

function phase0Reason({ ok, docsOnly, offending, missing }) {
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
  return faults.join('; ');
}

/**
 * Grades the `Before/after:` line of a PRD's Handoff.
 *
 * A repository path named `before-after.html` is accepted, wherever it sits — this function takes
 * no `ctx`, so it cannot know a specific PRD's own delivery folder; a caller that also knows the
 * PRD can additionally compare the accepted path against `phase0Paths(prd, { ctx }).beforeAfter`
 * for an exact match. `none` is accepted, because a change with nothing to show says so. Anything
 * reachable only over the network is refused, and a `claude.ai` artifact is refused in its own
 * words: it is private to its author, so the people the spec is written for cannot open it. That is
 * the whole reason this slice exists.
 *
 * @param {string} value the Handoff line's value
 */
export function beforeAfterHandoff(value) {
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

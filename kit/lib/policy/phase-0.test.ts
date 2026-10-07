import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { padPrd } from '../layout.ts';
import {
  beforeAfterHandoff,
  classifyPhase0Path,
  isDocsOnly,
  phase0Paths,
  phase0Verdict,
  PHASE_0_REQUIRED_KINDS,
} from './phase-0.ts';
import { parsePrd } from '../ids.ts';

const PRD = parsePrd(1015);
const TOPIC = 'inbox-and-planner';
const FOLDER = `${padPrd(PRD)}-${TOPIC}`;
const DIR = `.omni-loop/delivery/inbox/${FOLDER}`;

/** A repo carrying one approved PRD's own three delivery files, plus one pending acceptance file —
 * a phase-0 pull request's diff as the folders layout shapes it. */
function docsOnlyRepo({ files = {}, config = {} } = {}) {
  return makeRepo({
    files: {
      [`${DIR}/spec.md`]: '# spec\n',
      [`${DIR}/plan.md`]: '# plan\n',
      [`${DIR}/before-after.html`]: '<html></html>\n',
      'features/the-inbox-holds-the-approved-backlog.pending.feature': 'Feature: pending\n',
      ...files,
    },
    config: {
      acceptance: { enabled: true, dir: 'features', pendingSuffix: '.pending.feature' },
      ...config,
    },
  });
}

describe('An approved design lands in the PRD-s own delivery folder', () => {
  it('the spec sits in the PRD-s own folder, and phase0Paths finds it', () => {
    const { ctx } = docsOnlyRepo();

    const paths = phase0Paths(PRD, { ctx });
    expect(paths.spec).toBe(`${DIR}/spec.md`);
    expect(paths.plan).toBe(`${DIR}/plan.md`);
    expect(paths.beforeAfter).toBe(`${DIR}/before-after.html`);
    expect(paths.acceptanceDir).toBe('features');
    expect(classifyPhase0Path(paths.spec, { ctx, prd: PRD })).toBe('spec');
  });

  it('a phase-0 pull request offers it for review — docs-only, into the default branch, labelled', () => {
    const { ctx } = docsOnlyRepo();
    const paths = phase0Paths(PRD, { ctx });
    const diff = [
      paths.spec,
      paths.plan,
      paths.beforeAfter,
      'features/the-inbox-holds-the-approved-backlog.pending.feature',
    ];

    const verdict = phase0Verdict(diff, { ctx, prd: PRD });

    expect(verdict.ok, verdict.reason).toBe(true);
    expect(verdict.docsOnly).toBe(true);
    expect(verdict.missing).toEqual([]);
    expect(verdict.label).toBe(ctx.config.labels.phase0);
    expect(verdict.label).toBe('omni:phase-0');
    expect(verdict.base).toBe(ctx.config.repo.defaultBranch);
    expect(verdict.base).toBe('main');
    expect(verdict.carries.spec).toEqual([paths.spec]);
    expect(verdict.carries.plan).toEqual([paths.plan]);
    expect(verdict.carries['before-after']).toEqual([paths.beforeAfter]);
    expect(verdict.carries['pending-acceptance']).toHaveLength(1);
  });

  it('no source file is in that pull request — one is enough to refuse it, and it is named', () => {
    const { ctx } = docsOnlyRepo();
    const paths = phase0Paths(PRD, { ctx });
    const docsOnly = [paths.spec, paths.plan, paths.beforeAfter];
    const withSource = [...docsOnly, 'libs/vertuo-ai-agent/src/inbox.ts'];

    expect(isDocsOnly(docsOnly, { ctx })).toBe(true);
    expect(isDocsOnly(withSource, { ctx })).toBe(false);

    const verdict = phase0Verdict(withSource, { ctx, prd: PRD });
    expect(verdict.ok).toBe(false);
    expect(verdict.docsOnly).toBe(false);
    expect(verdict.sourceFiles).toEqual(['libs/vertuo-ai-agent/src/inbox.ts']);
    expect(verdict.reason).toContain('libs/vertuo-ai-agent/src/inbox.ts');
    expect(verdict.reason).toContain('carries no source file');
  });

  it('an unrelated file elsewhere is refused too — a phase-0 gate that is docs-only in name only is worse than none', () => {
    const { ctx } = docsOnlyRepo();
    const paths = phase0Paths(PRD, { ctx });
    const verdict = phase0Verdict(
      [paths.spec, paths.plan, paths.beforeAfter, 'kit/lib/policy/phase-0.test.ts', 'package.json'],
      { ctx, prd: PRD },
    );

    expect(verdict.sourceFiles).toEqual(['kit/lib/policy/phase-0.test.ts', 'package.json']);
  });

  it('docs-only is not enough — a pull request carrying no plan is a docs change, not a phase-0', () => {
    const { ctx } = docsOnlyRepo();
    const paths = phase0Paths(PRD, { ctx });

    const verdict = phase0Verdict([paths.spec], { ctx, prd: PRD });

    expect(verdict.ok).toBe(false);
    expect(verdict.docsOnly).toBe(true);
    expect(verdict.missing).toEqual(['plan', 'before-after']);
    expect(verdict.reason).toContain('the plan');
  });

  it('a change with nothing to show says so, and is not made to invent a page', () => {
    const { ctx } = docsOnlyRepo();
    const paths = phase0Paths(PRD, { ctx });

    const verdict = phase0Verdict([paths.spec, paths.plan], {
      ctx,
      prd: PRD,
      needsBeforeAfter: false,
    });

    expect(verdict.ok, verdict.reason).toBe(true);
  });

  it('a roadmap row is planned when the loop reaches it: with needsPlan false, no plan is missing (issue 1198)', () => {
    const { ctx } = docsOnlyRepo();
    const paths = phase0Paths(PRD, { ctx });

    const verdict = phase0Verdict([paths.spec, paths.beforeAfter], { ctx, prd: PRD, needsPlan: false });
    expect(verdict.ok, verdict.reason).toBe(true);
    expect(verdict.missing).toEqual([]);
    expect(verdict.reason).toBe('docs-only, and it carries the spec and the before/after a reviewer is being asked to approve');

    const bare = phase0Verdict([paths.spec], { ctx, prd: PRD, needsPlan: false });
    expect(bare.missing).toEqual(['before-after']);
    expect(bare.reason).not.toContain('the plan');
    expect(phase0Verdict([paths.spec, paths.beforeAfter], { ctx, prd: PRD }).missing).toEqual(['plan']);
    expect(phase0Verdict([paths.spec], { ctx, prd: PRD, needsPlan: false, needsBeforeAfter: false }).missing).toEqual([]);
    expect(phase0Verdict([paths.spec, paths.plan, paths.beforeAfter], { ctx, prd: PRD }).reason).toBe(
      'docs-only, and it carries the spec, the plan and the before/after a reviewer is being asked to approve',
    );
  });

  // Restored to upstream's own assertion (fix round 1 — the controller's ruling on this task's
  // report): a `docs` kind survives in the folders layout too, checked AFTER the PRD-specific and
  // acceptance-pending kinds, exactly as upstream checked its specific kinds before falling back to
  // a bare `docs/` prefix. The kit's equivalent of "under docs/" is "under the delivery tree, the
  // knowledge folder or the ADR directory, or the configured glossary/context files" — so an extra
  // document (the PRD's own folder README, a configured glossary) is tolerated, exactly as upstream
  // tolerated `docs/inbox/README.md` and `docs/glossary.md`.
  it('the README beside the PRD-s own files, and a configured glossary, are documents — tolerated, not source', () => {
    const { ctx } = docsOnlyRepo({ config: { paths: { glossary: 'docs/glossary.md' } } });
    const paths = phase0Paths(PRD, { ctx });

    expect(classifyPhase0Path(`${DIR}/README.md`, { ctx, prd: PRD })).toBe('docs');
    expect(classifyPhase0Path('docs/glossary.md', { ctx, prd: PRD })).toBe('docs');
    expect(isDocsOnly([paths.spec, `${DIR}/README.md`, 'docs/glossary.md'], { ctx })).toBe(true);
  });

  // As upstream, where only the `docs/` prefix counted: a root file that is not under the
  // delivery tree, the knowledge folder, the ADR directory, and is not the configured glossary or
  // one of the configured context files, is still a source file.
  it('a root README.md not listed in paths.context is source, as upstream where only docs/ counted', () => {
    const { ctx } = docsOnlyRepo();

    expect(classifyPhase0Path('README.md', { ctx, prd: PRD })).toBe('source');
    expect(isDocsOnly(['README.md'], { ctx })).toBe(false);
  });

  // A path under the shared delivery tree is a document even when it belongs to a DIFFERENT PRD's
  // own folder — it is still tolerated the way any other document is, just never one THIS PRD's own
  // verdict (`phase0Verdict`) counts as required.
  it('a file in a DIFFERENT PRD-s own folder is a document too, not source — but this PRD-s verdict still needs its own three', () => {
    const otherPrdSpec = '.omni-loop/delivery/inbox/0966-agent-outbox/spec.md';
    const { ctx } = docsOnlyRepo({ files: { [otherPrdSpec]: '# spec\n' } });

    expect(classifyPhase0Path(otherPrdSpec, { ctx, prd: PRD })).toBe('docs');
    expect(isDocsOnly([otherPrdSpec], { ctx })).toBe(true);

    const verdict = phase0Verdict([otherPrdSpec], { ctx, prd: PRD });
    expect(verdict.docsOnly).toBe(true);
    expect(verdict.missing).toEqual(['spec', 'plan', 'before-after']);
  });

  // PRD 686: a brainstorm started from a concept's area fills that area's PRD cell in the concept's
  // concept.md, in the same commit as the PRD's folder, so its phase-0 pull request carries it.
  it("a concept's concept.md edited beside the PRD's three files is a document, and the verdict stays ok", () => {
    const concept = '.omni-loop/delivery/inbox/concepts/0712-x/concept.md';
    const { ctx } = docsOnlyRepo({ files: { [concept]: '---\nconcept: 712\n---\n' } });
    const paths = phase0Paths(PRD, { ctx });

    expect(classifyPhase0Path(concept, { ctx, prd: PRD })).toBe('docs');
    const verdict = phase0Verdict([paths.spec, paths.plan, paths.beforeAfter, concept], { ctx, prd: PRD });
    expect(verdict.ok, verdict.reason).toBe(true);
    expect(verdict.docsOnly).toBe(true);
    expect(verdict.carries.docs).toEqual([concept]);
  });

  it('names the three required kinds once, in the order a reviewer wants them', () => {
    expect(PHASE_0_REQUIRED_KINDS).toEqual(['spec', 'plan', 'before-after']);
  });
});

describe('The before/after is a file in the repository', () => {
  it('the before/after is a self-contained page in the repository', () => {
    const { ctx } = docsOnlyRepo();
    const path = phase0Paths(PRD, { ctx }).beforeAfter;

    expect(path).toBe(`${DIR}/before-after.html`);
    expect(classifyPhase0Path(path, { ctx, prd: PRD })).toBe('before-after');
    expect(beforeAfterHandoff(path, { ctx, prd: PRD })).toMatchObject({ ok: true, path });
  });

  it('the handoff points at that path rather than a private link', () => {
    const refused = beforeAfterHandoff('https://claude.ai/artifact/9f3c1d2e');

    expect(refused.ok).toBe(false);
    expect(refused.path).toBeNull();
    expect(refused.reason).toContain('private to its author');
  });

  it('any published link is refused, not only a claude.ai one', () => {
    const refused = beforeAfterHandoff('https://example.com/before-after.html');

    expect(refused.ok).toBe(false);
    expect(refused.reason).toContain('not versioned');
  });

  // Restored to upstream's own assertion (fix round 1): with `ctx` AND `prd` both given, a
  // repository path must equal that PRD's own `ctx.layout.beforeAfterPath(prd)` exactly — "the
  // right place is named" — not merely carry the right file name.
  it('a repository path somewhere else is refused, and the right place is named', () => {
    const { ctx } = docsOnlyRepo();
    const expected = ctx.layout.beforeAfterPath(PRD);

    const refused = beforeAfterHandoff('docs/before-after.html', { ctx, prd: PRD });

    expect(refused.ok).toBe(false);
    expect(refused.path).toBeNull();
    expect(refused.reason).toContain(expected);
  });

  // Without `ctx`/`prd` (the fallback this function's signature still allows, per the porting
  // record) only the file NAME is checked, wherever it sits — the one invariant checkable with no
  // knowledge of any specific PRD's own folder.
  it('without ctx/prd, only the file name is checked, and a wrong one is refused', () => {
    const refused = beforeAfterHandoff('docs/before-after-page.html');

    expect(refused.ok).toBe(false);
    expect(refused.reason).toContain('before-after.html');
  });

  it('a change with nothing to show states none, and a blank line is not that statement', () => {
    expect(beforeAfterHandoff('none')).toMatchObject({ ok: true, path: null });
    expect(beforeAfterHandoff('   ').ok).toBe(false);
  });
});

// PRD #99, slice s1: a phase-0 branch is made only by the loop, so every commit in it carries the
// trailer `omni sign trailer` prints. The commits are given; this module never reads git.
describe('Every commit of a phase-0 pull request is signed', () => {
  const TRAILER = 'Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>';
  const signed = (sha: string, subject: string) => ({ sha, message: `${subject}\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n${TRAILER}\n` });
  const unsigned = (sha: string, subject: string) => ({ sha, message: `${subject}\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n` });

  function threeFiles(options = {}) {
    const { ctx } = docsOnlyRepo(options);
    const paths = phase0Paths(PRD, { ctx });
    return { ctx, diff: [paths.spec, paths.plan, paths.beforeAfter] };
  }

  it('a signed range is ok, and its reason is the one it always gave', () => {
    const { ctx, diff } = threeFiles();
    const verdict = phase0Verdict(diff, { ctx, prd: PRD, commits: [signed('a1b2c3d', 'docs(phase-0): inbox')] });

    expect(verdict.ok, verdict.reason).toBe(true);
    expect(verdict.signed).toBe(true);
    expect(verdict.trailer).toBe(TRAILER);
    expect(verdict.unsigned).toEqual([]);
    expect(verdict.reason).toBe(phase0Verdict(diff, { ctx, prd: PRD }).reason);
  });

  it('one unsigned commit is enough to refuse it, and the commit and the missing line are named', () => {
    const { ctx, diff } = threeFiles();
    const verdict = phase0Verdict(diff, {
      ctx,
      prd: PRD,
      commits: [signed('1111111', 'docs: one'), unsigned('a1b2c3d', 'docs: two')],
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.docsOnly).toBe(true);
    expect(verdict.signed).toBe(false);
    expect(verdict.unsigned).toEqual([{ sha: 'a1b2c3d', subject: 'docs: two' }]);
    expect(verdict.reason).toBe(`unsigned: a1b2c3d has no "${TRAILER}" line`);
  });

  it('several unsigned commits are named together, in the order given', () => {
    const { ctx, diff } = threeFiles();
    const verdict = phase0Verdict(diff, { ctx, prd: PRD, commits: [unsigned('aaaaaaa', 'a'), unsigned('bbbbbbb', 'b')] });

    expect(verdict.reason).toBe(`unsigned: aaaaaaa, bbbbbbb have no "${TRAILER}" line`);
  });

  it('with signature: null nothing is checked, and the verdict says so', () => {
    const { ctx, diff } = threeFiles({ config: { signature: null } });
    const verdict = phase0Verdict(diff, { ctx, prd: PRD, commits: [unsigned('a1b2c3d', 'docs: two')] });

    expect(verdict.ok, verdict.reason).toBe(true);
    expect(verdict.signed).toBeNull();
    expect(verdict.trailer).toBeNull();
    expect(verdict.unsigned).toEqual([]);
  });

  it('with no commits given, the signature is not graded, as before this check existed', () => {
    const { ctx, diff } = threeFiles();
    const verdict = phase0Verdict(diff, { ctx, prd: PRD });

    expect(verdict.ok, verdict.reason).toBe(true);
    expect(verdict.signed).toBeNull();
  });
});

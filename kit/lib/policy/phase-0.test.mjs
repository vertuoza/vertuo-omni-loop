import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.mjs';
import { padPrd } from '../layout.mjs';
import {
  beforeAfterHandoff,
  classifyPhase0Path,
  isDocsOnly,
  phase0Paths,
  phase0Verdict,
  PHASE_0_REQUIRED_KINDS,
} from './phase-0.mjs';

const PRD = 1015;
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
    expect(verdict.label).toBe('pr:phase-0');
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
      [paths.spec, paths.plan, paths.beforeAfter, 'kit/lib/policy/phase-0.test.mjs', 'package.json'],
      { ctx, prd: PRD },
    );

    expect(verdict.sourceFiles).toEqual(['kit/lib/policy/phase-0.test.mjs', 'package.json']);
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

  // Behavior change from upstream, per this task's own clarification ("Everything else makes the
  // PR not docs-only"): upstream tolerated an extra document (a glossary entry, the inbox format's
  // own README) alongside the three required kinds. The folders layout drops that third "docs"
  // bucket — anything that is not the PRD's own spec/plan/before-after, or a pending acceptance
  // file, counts as source and breaks docs-only, whatever it is.
  it('any other file is not a recognized phase-0 document, even a harmless one, and breaks docs-only', () => {
    const { ctx } = docsOnlyRepo();
    const paths = phase0Paths(PRD, { ctx });

    expect(classifyPhase0Path(`${DIR}/README.md`, { ctx, prd: PRD })).toBe('source');
    expect(classifyPhase0Path('docs/glossary.md', { ctx, prd: PRD })).toBe('source');
    expect(isDocsOnly([paths.spec, `${DIR}/README.md`], { ctx })).toBe(false);
  });

  it('a file in a DIFFERENT PRD-s own folder is source too — this PRD carries only its own three', () => {
    const { ctx } = docsOnlyRepo({
      files: { '.omni-loop/delivery/inbox/0966-agent-outbox/spec.md': '# spec\n' },
    });

    expect(
      classifyPhase0Path('.omni-loop/delivery/inbox/0966-agent-outbox/spec.md', {
        ctx,
        prd: PRD,
      }),
    ).toBe('source');
    // ... but it is still a document in the PRD-agnostic sense `isDocsOnly` uses.
    expect(
      isDocsOnly(['.omni-loop/delivery/inbox/0966-agent-outbox/spec.md'], { ctx }),
    ).toBe(true);
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
    expect(beforeAfterHandoff(path)).toMatchObject({ ok: true, path });
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

  // Rewritten for the signature constraint this task's own interface list fixes:
  // `beforeAfterHandoff(value)` takes no `ctx`, so it cannot know a specific PRD's own folder — it
  // can only check the file is named `before-after.html`, wherever it sits.
  it('a repository path with the wrong file name is refused', () => {
    const refused = beforeAfterHandoff('docs/before-after-page.html');

    expect(refused.ok).toBe(false);
    expect(refused.reason).toContain('before-after.html');
  });

  it('a change with nothing to show states none, and a blank line is not that statement', () => {
    expect(beforeAfterHandoff('none')).toMatchObject({ ok: true, path: null });
    expect(beforeAfterHandoff('   ').ok).toBe(false);
  });
});

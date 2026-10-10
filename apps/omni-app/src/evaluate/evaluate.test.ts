import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_FILE, parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { createContext } from 'vertuo-omni-plan/kit/lib/context.ts';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { settleItem } from 'vertuo-omni-plan/kit/lib/outbox/settle.ts';
import { fixOutboxContext, gateResult } from 'vertuo-omni-plan/kit/lib/outbox/status.ts';
import { deferredOutput, evaluate, planPrdOf, pullKind, type Verdict } from './evaluate.ts';

const KNOWLEDGE_INVARIANTS = '.omni-loop/knowledge/product/invariants.md';

const copies: string[] = [];
afterEach(() => {
  for (const dir of copies.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A fixture copied to a fresh folder a test may write to. */
function copyOf(name: string) {
  const dir = mkdtempSync(join(tmpdir(), 'omni-app-'));
  cpSync(fixture(name), dir, { recursive: true });
  copies.push(dir);
  return dir;
}

const gateSpy = vi.mocked(gateResult);

// The kit's gate, wrapped so a test can see evaluate call it — the real one still runs.
vi.mock('vertuo-omni-plan/kit/lib/outbox/status.ts', async (importOriginal) => {
  const kit = await importOriginal<typeof import('vertuo-omni-plan/kit/lib/outbox/status.ts')>();
  return { ...kit, gateResult: vi.fn(kit.gateResult) };
});

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name: string) => join(FIXTURES, name);

const featurePr = (over: Record<string, unknown> = {}) => ({
  baseRef: 'main',
  headRef: 'feat/widget',
  headSha: 'abc123',
  labels: [],
  ...over,
});

const NOW = () => '2026-09-25T10:00:00.000Z';

function run({ base = 'base-active', head = 'head-clear', pr = featurePr(), ...rest }: { base?: string; head?: string; pr?: ReturnType<typeof featurePr>; [input: string]: unknown } = {}): Verdict {
  return evaluate({ base: fixture(base), head: fixture(head), pr, now: NOW, ...rest });
}

describe('evaluate — the conclusion table', () => {
  it('skips a repository whose base branch has no .omni-loop/config.yml', () => {
    const verdict = run({ base: 'base-inactive' });
    expect(verdict.conclusion).toBe('skipped');
    expect(verdict.title).toBe('omni-loop is not active on this repo');
    expect(verdict.comment).toBeNull();
  });

  it('skips a pull request whose base is not the default branch (a sub-PR)', () => {
    const verdict = run({ pr: featurePr({ baseRef: 'feat/widget', headRef: 'feat/widget--s1' }) });
    expect(verdict.conclusion).toBe('skipped');
    expect(verdict.title).toBe('omni-loop is not active on this PR');
    expect(verdict.comment).toBeNull();
  });

  it('skips a pull request whose head does not match branches.feature', () => {
    const verdict = run({ pr: featurePr({ headRef: 'chore/bump-deps' }) });
    expect(verdict.conclusion).toBe('skipped');
    expect(verdict.title).toBe('omni-loop is not active on this PR');
  });

  it('skips a roadmap\'s phase-0 PR on its branch shape, never as a missing PRD (issue 1198)', () => {
    const verdict = run({ pr: featurePr({ headRef: 'docs/phase-0-roadmap-crew' }) });
    expect(verdict.conclusion).toBe('skipped');
    expect(verdict.title).toBe('omni-loop is not active on this PR');
    expect(verdict.summary).toBe('The head `docs/phase-0-roadmap-crew` does not match `feat/{topic}`.');
  });

  it('skips a feature-shaped pull request with no PRD folder for its topic', () => {
    const verdict = run({ pr: featurePr({ headRef: 'feat/gadget' }) });
    expect(verdict.conclusion).toBe('skipped');
    expect(verdict.title).toBe('omni-loop is not active on this PR');
    expect(verdict.summary).toMatch(/gadget/);
  });

  it('passes a feature pull request whose outbox is clear', () => {
    const verdict = run();
    expect(verdict.conclusion).toBe('success');
    expect(verdict.title).toBe('Outbox clear');
    expect(verdict.summary).toContain('PRD #42: no open item.');
  });

  it('fails a feature pull request with an open item, naming it in the summary and the comment', () => {
    const verdict = run({ head: 'head-open' });
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.title).toBe('1 open outbox item');
    expect(verdict.summary).toContain('s1-01-widget-colour.md (high)');
    expect(verdict.comment?.id).toBeNull();
    expect(verdict.comment?.body).toContain('<!-- omni-outbox-pr -->');
    expect(verdict.comment?.body).toContain('Which colour should the widget be?');
  });

  it('fails a feature pull request with a drifted decision nobody reworked', () => {
    const verdict = run({ head: 'head-drift' });
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.title).toBe('unreworked drift');
    expect(verdict.summary).toMatch(/1 drifted decision not yet reworked/);
  });

  it('is neutral when the override label is on a red pull request', () => {
    const verdict = run({ head: 'head-open', pr: featurePr({ labels: ['omni:outbox-go'] }) });
    expect(verdict.conclusion).toBe('neutral');
    expect(verdict.title).toBe('Override in effect (omni:outbox-go)');
  });

  it('is still success when the override label is on a green pull request', () => {
    const verdict = run({ pr: featurePr({ labels: ['omni:outbox-go'] }) });
    expect(verdict.conclusion).toBe('success');
  });

  it('fails with the schema error, on one line, when the base config is broken', () => {
    const verdict = run({ base: 'base-broken' });
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.title).toMatch(/^\.omni-loop\/config\.yml is not a valid Omni Loop config: /);
    expect(verdict.title).toMatch(/shipIt/);
    expect(verdict.title).not.toContain('\n');
    expect(verdict.comment).toBeNull();
  });
});

describe('evaluate — config from base, delivery from head', () => {
  it('ignores a head that renames the override label', () => {
    const renamed = run({ head: 'head-renames-label', pr: featurePr({ labels: ['ship-it'] }) });
    expect(renamed.conclusion).toBe('failure');
    const real = run({ head: 'head-renames-label', pr: featurePr({ labels: ['omni:outbox-go'] }) });
    expect(real.conclusion).toBe('neutral');
  });

  it('reads items from the head only: the same base with a clear head is green', () => {
    expect(run({ head: 'head-open' }).conclusion).toBe('failure');
    expect(run({ head: 'head-clear' }).conclusion).toBe('success');
  });
});

describe('evaluate — a snapshot holding only config and delivery is enough', () => {
  function filesUnder(dir: string) {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(dir, join(entry.parentPath, entry.name)));
  }

  it('evaluates from folders outside any git checkout, holding nothing but the listed paths', () => {
    const base = copyOf('base-active');
    const head = copyOf('head-open');
    expect(filesUnder(base)).toEqual(['.omni-loop/config.yml']);
    expect(filesUnder(head).every((file) => file.startsWith('.omni-loop/delivery/'))).toBe(true);
    const verdict = evaluate({ base, head, pr: featurePr(), now: NOW });
    expect(verdict.conclusion).toBe('failure');
  });
});

describe('evaluate — reuses the kit', () => {
  it('asks the kit gate, not a copy of it', () => {
    gateSpy.mockClear();
    run({ head: 'head-open' });
    expect(gateResult).toHaveBeenCalledWith(42, expect.objectContaining({ labels: [] }));
  });
});

describe('evaluate — the pull request comment', () => {
  it('rewrites the existing marker comment in place rather than adding one', () => {
    const comments = [
      { id: 7, body: 'unrelated' },
      { id: 9, body: '<!-- omni-outbox-pr -->\n\nold' },
    ];
    const verdict = run({ head: 'head-open', comments });
    expect(verdict.comment?.id).toBe(9);
    expect(verdict.comment?.body).not.toContain('old');
  });

  it('posts nothing on a clear pull request that never had a comment', () => {
    expect(run().comment).toBeNull();
  });

  it('still rewrites an existing comment once the outbox is clear', () => {
    const comments = [{ id: 9, body: '<!-- omni-outbox-pr -->\n\nold' }];
    const verdict = run({ comments });
    expect(verdict.comment?.id).toBe(9);
    expect(verdict.comment?.body).toContain('No open items.');
  });
});

describe('evaluate — the range, when changed files are given', () => {
  it('hands the changed files to the gate', () => {
    gateSpy.mockClear();
    const changes = [{ path: 'src/a.mjs', status: 'M' }];
    run({ changes });
    expect(gateResult).toHaveBeenCalledWith(42, expect.objectContaining({ changes }));
  });
});

describe('evaluate — laws on feature PRs: the base knowledge folder grades law-demoted (PRD 1342)', () => {
  it('hands the base knowledge folder to the gate when laws.source is knowledge', () => {
    gateSpy.mockClear();
    run({ base: 'base-laws', head: 'head-clear', changes: [] });
    const handed = gateSpy.mock.calls[0]?.[1].base;
    expect(typeof handed?.read).toBe('function');
  });

  it('hands none when laws.source is not knowledge', () => {
    gateSpy.mockClear();
    run({ changes: [] });
    expect(gateResult).toHaveBeenCalledWith(42, expect.objectContaining({ base: null }));
  });

  it('fails a feature PR that turns a law\'s proof back to unenforced', () => {
    const verdict = run({ base: 'base-laws', head: 'head-laws-feature-demoted', changes: [{ path: KNOWLEDGE_INVARIANTS, status: 'M' }] });
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.summary).toContain(`${KNOWLEDGE_INVARIANTS} (law-demoted)`);
  });
});

describe('evaluate — fix PRs (PRD 1342)', () => {
  const fixPr = (headRef = 'fix/77-crash') => featurePr({ headRef });
  const REMOVED = [{ path: 'src/widget.test.ts', status: 'D' }];

  it('passes a fix PR whose range touches no law', () => {
    const verdict = run({ base: 'base-laws', head: 'head-laws-fix', pr: fixPr(), changes: [{ path: 'src/widget.ts', status: 'M' }] });
    expect(verdict).toMatchObject({ conclusion: 'success', title: 'Outbox clear', comment: null });
    expect(verdict.summary).toContain('.omni-loop/delivery/bugs/0077-crash');
  });

  it('fails a fix PR that removes a law\'s test with no outbox in its folder, naming the law and the outbox', () => {
    const verdict = run({ base: 'base-laws', head: 'head-laws-fix', pr: fixPr(), changes: REMOVED });
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.title).toBe('2 unaccounted changes to a law — N-PRODUCT-1');
    expect(verdict.summary).toContain('N-PRODUCT-1: A widget is never shown without its colour.');
    expect(verdict.summary).toContain('.omni-loop/delivery/bugs/0077-crash/outbox/');
  });

  it('fails a visual fix PR the same way, reading its folder under visual/', () => {
    const verdict = run({ base: 'base-laws', head: 'head-laws-visual', pr: fixPr('fix/78-colour'), changes: REMOVED });
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.summary).toContain('.omni-loop/delivery/visual/0078-colour/outbox/');
  });

  it('fails a fix PR whose branch names no fix folder, saying so', () => {
    const verdict = run({ base: 'base-laws', head: 'head-laws-fix', pr: fixPr('fix/widget-crash'), changes: REMOVED });
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.summary).toContain('no fix folder');
  });

  it('stays red while the high item is open, posting the outbox comment, and passes once a person answered it', () => {
    const open = run({ base: 'base-laws', head: 'head-laws-fix-open', pr: fixPr(), changes: REMOVED });
    expect(open).toMatchObject({ conclusion: 'failure', title: '1 open outbox item — N-PRODUCT-1' });
    expect(open.comment?.body).toContain('The fix removes the old test');

    const head = copyOf('head-laws-fix-open');
    const folder = '.omni-loop/delivery/bugs/0077-crash';
    const ctx = createContext(head, parseConfig(readFileSync(join(fixture('base-laws'), CONFIG_FILE), 'utf8'), CONFIG_FILE));
    const settled = settleItem({
      ctx: fixOutboxContext(ctx, folder, parsePrd(77)),
      file: `${folder}/outbox/s1-01-widget-proof.md`,
      answer: { text: 'Yes, remove it.', approvedBy: 'pierrederval', approvedAt: '2026-10-10', channel: { kind: 'feature-pull-request', number: 12 }, statedVerdict: 'agreed' },
    });
    expect(settled.ok).toBe(true);
    const answered = evaluate({ base: fixture('base-laws'), head, pr: fixPr(), changes: REMOVED, now: NOW });
    expect(answered).toMatchObject({ conclusion: 'success', title: 'Outbox clear' });
  });

  it('is neutral under the override label', () => {
    const verdict = run({ base: 'base-laws', head: 'head-laws-fix', pr: featurePr({ headRef: 'fix/77-crash', labels: ['omni:outbox-go'] }), changes: REMOVED });
    expect(verdict.conclusion).toBe('neutral');
  });

  it('skips fix PRs when laws.source is not knowledge', () => {
    const verdict = run({ head: 'head-laws-fix', pr: fixPr(), changes: REMOVED });
    expect(verdict).toMatchObject({ conclusion: 'skipped', title: 'omni-loop is not active on this PR' });
  });
});

describe('evaluate — knowledge and enforce PRs are never blocked (PRD 1342)', () => {
  const CHANGES = [{ path: KNOWLEDGE_INVARIANTS, status: 'M' }, { path: 'src/name.test.ts', status: 'A' }];

  it('passes an enforce PR, listing the law it touches', () => {
    const verdict = run({ base: 'base-laws', head: 'head-laws-enforce', pr: featurePr({ headRef: 'test/law-N-PRODUCT-2' }), changes: CHANGES });
    expect(verdict).toMatchObject({ conclusion: 'success', title: 'Enforce PR: 1 law touched', comment: null });
    expect(verdict.summary).toContain('N-PRODUCT-2: A widget keeps its name once saved.');
    expect(verdict.summary).not.toContain('N-PRODUCT-1');
  });

  it('passes a knowledge PR that demotes a law and removes a test, listing the law', () => {
    const changes = [{ path: KNOWLEDGE_INVARIANTS, status: 'M' }, { path: 'src/widget.test.ts', status: 'D' }];
    const verdict = run({ base: 'base-laws', head: 'head-laws-feature-demoted', pr: featurePr({ headRef: 'docs/knowledge-widget' }), changes });
    expect(verdict).toMatchObject({ conclusion: 'success', title: 'Knowledge PR: 1 law touched' });
    expect(verdict.summary).toContain('N-PRODUCT-1');
  });

  it('says so when no law is touched', () => {
    const verdict = run({ base: 'base-laws', head: 'head-laws-fix', pr: featurePr({ headRef: 'docs/knowledge-widget' }), changes: [] });
    expect(verdict).toMatchObject({ conclusion: 'success', title: 'Knowledge PR: no law touched' });
  });

  it('skips them when laws.source is not knowledge', () => {
    expect(run({ pr: featurePr({ headRef: 'test/law-N-PRODUCT-2' }) }).conclusion).toBe('skipped');
    expect(run({ pr: featurePr({ headRef: 'docs/knowledge-widget' }) }).conclusion).toBe('skipped');
  });
});

describe('pullKind — what the check is on a pull request', () => {
  const config = (laws = 'knowledge') => parseConfig(`kit: 1\nlaws:\n  source: ${laws}\n`, CONFIG_FILE);
  const kind = (headRef: string, baseRef = 'main', laws = 'knowledge') => pullKind({ baseRef, headRef }, config(laws));

  it('reads each branch shape from the config', () => {
    expect(kind('feat/widget')).toEqual({ kind: 'feature', topic: 'widget' });
    expect(kind('fix/77-crash')).toEqual({ kind: 'fix', topic: '77-crash' });
    expect(kind('docs/knowledge-widget')).toEqual({ kind: 'knowledge', topic: 'widget' });
    expect(kind('test/law-N-PRODUCT-2')).toEqual({ kind: 'law', topic: 'N-PRODUCT-2' });
  });

  it('skips every shape but the feature one when laws.source is not knowledge', () => {
    expect(kind('feat/widget', 'main', 'none')).toEqual({ kind: 'feature', topic: 'widget' });
    expect(kind('fix/77-crash', 'main', 'none')).toEqual({ skip: 'The head `fix/77-crash` does not match `feat/{topic}`.' });
  });

  it('skips anything whose base is not the default branch', () => {
    expect(kind('fix/77-crash', 'feat/widget')).toEqual({ skip: 'The base `feat/widget` is not the default branch `main`.' });
  });
});

describe('planPrdOf — the plan repository PRD a target feature PR is part of (issue 1202)', () => {
  it('reads `Part of <owner>/<repo>#<n>` naming another repository', () => {
    expect(planPrdOf('Part of acme/plan#8\n\nThe widgets half.', 'acme/crew')).toEqual({ repo: 'acme/plan', prd: 8 });
  });

  it('reads the line wherever it sits in the body, with a dot or dashes in the names', () => {
    expect(planPrdOf('Some intro.\nPart of acme-co/vibe.plan#12', 'acme-co/crew')).toEqual({ repo: 'acme-co/vibe.plan', prd: 12 });
  });

  it('is null for a line naming this same repository (a sub-PR\'s shape), whatever its case', () => {
    expect(planPrdOf('Part of acme/crew#8', 'acme/crew')).toBeNull();
    expect(planPrdOf('Part of Acme/Crew#8', 'acme/crew')).toBeNull();
  });

  it('is null for a body with neither line, or no body', () => {
    expect(planPrdOf('Fixes the widget.', 'acme/crew')).toBeNull();
    expect(planPrdOf('', 'acme/crew')).toBeNull();
    expect(planPrdOf('Part of #8', 'acme/crew')).toBeNull();
  });

  it('is null when the body also says `Closes #<n>`: Closes wins, the PR is gated here', () => {
    expect(planPrdOf('Closes #12\nPart of acme/plan#8', 'acme/crew')).toBeNull();
  });

  it('reads only a line that starts with `Part of`, never a mention inside a sentence', () => {
    expect(planPrdOf('This is not Part of acme/plan#8 at all.', 'acme/crew')).toBeNull();
  });
});

describe('deferredOutput — the check of a target feature PR', () => {
  it('names the PRD and the plan repository, links the plan PR, and says the check passes without following it', () => {
    const output = deferredOutput({ repo: 'acme/plan', prd: parsePrd(8) }, 37);
    expect(output.title).toBe("PRD 8 is graded on acme/plan's plan PR");
    expect(output.summary).toContain('[acme/plan#37](https://github.com/acme/plan/pull/37)');
    expect(output.summary).toContain('passes here without following');
  });

  it('links the PRD issue when the plan PR could not be found', () => {
    const output = deferredOutput({ repo: 'acme/plan', prd: parsePrd(8) }, null);
    expect(output.summary).toContain('[acme/plan#8](https://github.com/acme/plan/issues/8)');
    expect(output.summary).not.toContain('/pull/');
  });
});

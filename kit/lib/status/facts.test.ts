// `omni status`'s facts on a repository whose inbox also holds a concept (PRD 686): a concept waits
// under `inbox/concepts/<nnnn>-<slug>/`, and `concepts` is no PRD folder name, so the facts count it
// nowhere — not in the inbox, not among the folders a commit touched, not on a phase-0 branch.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { readFacts } from './facts.ts';
import { assertDefined } from '../../test/assert.ts';

const INBOX = '.omni-loop/delivery/inbox';
const CONCEPT = `${INBOX}/concepts/0712-x`;

function git(root: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root, encoding: 'utf8' }).trim();
}

/** A default branch holding one PRD in the inbox, one shipped, and one concept; `origin/main` is it. */
function repoWithConcept() {
  const repo = makeRepo({
    git: true,
    files: {
      [`${INBOX}/0042-topic/spec.md`]: '# spec\n',
      [`${CONCEPT}/concept.md`]: '# concept\n',
      [`${CONCEPT}/vision.html`]: '<!doctype html>\n',
      '.omni-loop/delivery/shipped/0007-old/spec.md': '# spec\n',
    },
  });
  git(repo.root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return repo;
}

describe('omni status facts — a concept in the inbox (PRD 686)', () => {
  it('counts no concept among the inbox, the shipped or the touched PRD folders', () => {
    const { ctx } = repoWithConcept();
    const facts = readFacts({ ctx });
    assertDefined(facts, 'facts');
    expect(facts.inbox).toEqual([{ prd: 42, topic: 'topic', name: '0042-topic' }]);
    expect(facts.shipped.map((folder) => folder.prd)).toEqual([7]);
    expect(facts.touched.map((touch) => touch.prd).sort((a, b) => a - b)).toEqual([7, 42]);
  });

  it('reads a phase-0 branch that also fills a concept cell as touching its PRD only', () => {
    const { root, ctx, write } = repoWithConcept();
    git(root, 'switch', '-q', '-c', 'docs/phase-0-topic');
    write(`${INBOX}/0042-topic/plan.md`, '# plan\n');
    write(`${CONCEPT}/concept.md`, '# concept, its area filled\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'docs(prd): topic');
    git(root, 'update-ref', 'refs/remotes/origin/docs/phase-0-topic', 'HEAD');

    const read = readFacts({ ctx });
    assertDefined(read, 'the facts');
    const [phase0] = read.phase0;
    assertDefined(phase0, 'phase0');
    expect(phase0.topic).toBe('topic');
    assertDefined(phase0, 'phase0');
    expect(phase0.inbox.map((folder) => folder.prd)).toEqual([42]);
    assertDefined(phase0, 'phase0');
    expect(phase0.touched.map((touch) => touch.prd)).toEqual([42]);
  });
});

describe('omni status facts — a PRD of several landings', () => {
  it('reads each landing branch of an inbox PRD as one of its feature branches, with where it sits', () => {
    const { root, ctx, write } = repoWithConcept();
    git(root, 'switch', '-q', '-c', 'feat/topic-1of2-expand');
    write('db/migrations/0001.sql', 'create table t ();\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'feat: expand');
    git(root, 'update-ref', 'refs/remotes/origin/feat/topic-1of2-expand', 'HEAD');
    git(root, 'update-ref', 'refs/remotes/origin/feat/topic-2of2-code', 'HEAD');
    git(root, 'update-ref', 'refs/remotes/origin/feat/other-1of2-expand', 'HEAD');

    const read = readFacts({ ctx });
    assertDefined(read, 'the facts');
    expect(read.features.map(({ branch, landing, forked }) => ({ branch, landing, forked }))).toEqual([
      { branch: 'feat/topic-1of2-expand', landing: { landing: 1, landings: 2, name: 'expand' }, forked: ['db/migrations/0001.sql'] },
      { branch: 'feat/topic-2of2-code', landing: { landing: 2, landings: 2, name: 'code' }, forked: ['db/migrations/0001.sql'] },
    ]);
  });
});

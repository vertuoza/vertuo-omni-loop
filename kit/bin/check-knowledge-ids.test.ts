// `omni check knowledge` refuses an id new on this branch that the base gave to another entry (PRD 3015,
// s3), through `main()` on a temporary git repository whose `origin/main` is a local ref.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRepo, type Repo } from '../test/fixture.ts';
import { main } from './omni.ts';

const K = '.omni-loop/knowledge';
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\nlaws:\n  source: knowledge\n';
const RULES = `${K}/product/rules.md`;
const PRINCIPLES = ['# Product principles', '', '## P-PRODUCT-1', '', 'Widgets are simple.', '', 'Why: people use them.', 'Decided: @ada, 2026-09-01', 'Source: PRD #3', ''].join('\n');
const INVARIANTS = ['# Product invariants', '', '## N-PRODUCT-1', '', 'A widget has an owner.', '', 'Source: PRD #3', 'Stated: 2026-09-01', 'Enforced by: kit/lib/widgets.test.ts', ''].join('\n');

const repos: Repo[] = [];
afterEach(() => {
  for (const r of repos.splice(0)) rmSync(r.root, { recursive: true, force: true });
});

type Rule = [id: string, words: string];

/** A rules file whose every entry is well-formed, so that only the ids can turn the check red. */
function rules(entries: readonly Rule[]): string {
  return [
    '# Product rules',
    '',
    ...entries.flatMap(([id, words]) => [`## ${id}`, '', words, '', 'Serves: P-PRODUCT-1', 'Source: PRD #3', 'Stated: 2026-09-01', 'Enforced by: kit/lib/widgets.test.ts', '']),
  ].join('\n');
}

function git(root: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root, stdio: 'ignore' });
}

/**
 * A repository cut from `start` on `main`, whose branch `work` commits `ours`, while `origin/main` moved
 * on to `theirs` (a commit `work` does not hold). No `theirs`: `origin/main` is never made.
 */
function repoWith({ start, ours, theirs }: { start: readonly Rule[]; ours: readonly Rule[]; theirs?: readonly Rule[] }): Repo {
  const repo = makeRepo({
    git: true,
    files: {
      '.omni-loop/config.yml': CONFIG,
      [`${K}/README.md`]: '# Knowledge\n',
      [`${K}/product/principles.md`]: PRINCIPLES,
      [RULES]: rules(start),
      [`${K}/product/invariants.md`]: INVARIANTS,
      'kit/lib/widgets.test.ts': 'test\n',
    },
  });
  repos.push(repo);
  if (theirs) {
    repo.write(RULES, rules(theirs));
    git(repo.root, 'commit', '-q', '--allow-empty', '-am', 'theirs');
    git(repo.root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    git(repo.root, 'checkout', '-q', 'HEAD~1');
  }
  git(repo.root, 'checkout', '-q', '-b', 'work');
  repo.write(RULES, rules(ours));
  git(repo.root, 'commit', '-q', '--allow-empty', '-am', 'ours');
  return repo;
}

async function check(root: string, args: string[] = ['knowledge']) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['check', ...args], {
    cwd: root,
    stdout: { write: (s: string) => out.push(s) },
    stderr: { write: (s: string) => err.push(s) },
    fetch: () => Promise.reject(new TypeError('a test never reaches the network')),
  });
  return { code, out: out.join(''), err: err.join('') };
}

const R1: Rule = ['BR-PRODUCT-1', 'A widget is blue.'];

describe('omni check knowledge — an id the base gave to another entry (PRD 3015)', () => {
  it('is red on an id new on this branch that the base holds with other words, naming the id to renumber to (AC-3)', async () => {
    const { root } = repoWith({
      start: [R1],
      theirs: [R1, ['BR-PRODUCT-2', 'A quote is signed once.']],
      ours: [R1, ['BR-PRODUCT-2', 'An order backlog is counted in months.']],
    });
    const result = await check(root, ['knowledge', '--base', 'origin/main']);
    expect(result.code).toBe(1);
    expect(result.out).toContain(
      `  ${RULES}: BR-PRODUCT-2 is taken on origin/main by another entry ("A quote is signed once.").\n` +
        "    Renumber this one to BR-PRODUCT-3, and its ledger's Became: line with it.",
    );
  });

  it('compares with the default base when no --base is given', async () => {
    const { root } = repoWith({
      start: [R1],
      theirs: [R1, ['BR-PRODUCT-2', 'A quote is signed once.']],
      ours: [R1, ['BR-PRODUCT-2', 'An order backlog is counted in months.']],
    });
    const result = await check(root);
    expect(result.code).toBe(1);
    expect(result.out).toContain('BR-PRODUCT-2 is taken on origin/main by another entry');
  });

  it('keeps green an entry this branch reworded in place (AC-4)', async () => {
    const start: Rule[] = [R1, ['BR-PRODUCT-2', 'A quote is signed once.']];
    const { root } = repoWith({ start, theirs: start, ours: [R1, ['BR-PRODUCT-2', 'A quote is signed once, by its customer.']] });
    const result = await check(root, ['knowledge', '--base', 'origin/main']);
    expect(result.out).not.toContain('is taken on');
    expect(result.code).toBe(0);
  });

  it('keeps green one entry that reached both sides with the same words', async () => {
    const both: Rule[] = [R1, ['BR-PRODUCT-2', 'A quote is signed once.']];
    const { root } = repoWith({ start: [R1], theirs: both, ours: both });
    const result = await check(root, ['knowledge', '--base', 'origin/main']);
    expect(result.code).toBe(0);
    expect(result.out).not.toContain('ids not compared');
  });

  it('says ids were not compared with no base, and grades the rest as before (AC-6)', async () => {
    const { root } = repoWith({ start: [R1], ours: [R1, ['BR-PRODUCT-2', 'An order backlog is counted in months.']] });
    const result = await check(root);
    expect(result.code).toBe(0);
    expect(result.out).toContain('ids not compared — no origin/main');
    expect(result.out).toMatch(/^check knowledge — 1 principle\(s\), 2 rule\(s\)/m);
  });

  it('runs under omni check all, against the base it is given', async () => {
    const { root } = repoWith({
      start: [R1],
      theirs: [R1, ['BR-PRODUCT-2', 'A quote is signed once.']],
      ours: [R1, ['BR-PRODUCT-2', 'An order backlog is counted in months.']],
    });
    const result = await check(root, ['all', '--base', 'origin/main']);
    expect(result.code).toBe(1);
    expect(result.out).toContain('BR-PRODUCT-2 is taken on origin/main by another entry ("A quote is signed once.")');
  });
});

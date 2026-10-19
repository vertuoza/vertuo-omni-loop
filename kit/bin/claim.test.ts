// PRD 2175, s3: `omni claim check <prd> <slice>`, through `main()` on a fixture repository with real
// git: the remote's feature and slice branches are refs under `refs/remotes/origin/`, as a fetch
// leaves them.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main, prdNamedBy } from './omni.ts';

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const PLAN_PATH = '.omni-loop/delivery/inbox/0007-widgets/plan.md';

/** A plan of two slices; `s1Territory` is s1's territory cell. */
function plan(s1Territory = '`a/`', s1Title = 'Alpha'): string {
  return [
    '# A plan',
    '',
    '| id | slice | territory | blocked by | wave |',
    '| --- | --- | --- | --- | --- |',
    `| s1 | ${s1Title} | ${s1Territory} | — | 1 |`,
    '| s2 | Beta | `b/` | — | 1 |',
    '',
  ].join('\n');
}

/** A repository whose remote feature branch `feat/widgets` holds the plan, and a helper to work it. */
function fixture() {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG, [PLAN_PATH]: plan() } });
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: repo.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const commit = (message: string, files: Record<string, string> = {}) => {
    for (const [path, text] of Object.entries(files)) repo.write(path, text);
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', message);
  };
  /** Publishes the current HEAD as the remote's `branch`. */
  const publish = (branch: string) => git('update-ref', `refs/remotes/origin/${branch}`, 'HEAD');
  publish('feat/widgets');
  const claim = () => {
    git('switch', '-q', '-c', 'feat/widgets--s1', 'origin/feat/widgets');
    commit('chore(s1): claim');
  };
  return { ...repo, git, commit, publish, claim };
}

async function run(root: string, ...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['claim', ...args], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni claim check (PRD 2175)', () => {
  it('prints reuse and exits 0 when the row is the same and the branch stayed inside its territory', async () => {
    const repo = fixture();
    repo.claim();
    repo.commit('feat(a): one', { 'a/one.ts': 'one\n', '.omni-loop/delivery/outbox/0007-widgets/s1-01-x.md': 'item\n' });
    repo.publish('feat/widgets--s1');
    expect(await run(repo.root, 'check', '7', 's1')).toEqual({ code: 0, out: 'reuse\n', err: '' });
  });

  it('never counts what a merge of the feature branch brought in', async () => {
    const repo = fixture();
    repo.claim();
    repo.commit('feat(a): one', { 'a/one.ts': 'one\n' });
    repo.publish('feat/widgets--s1');
    repo.git('switch', '-q', '--detach', 'origin/feat/widgets');
    repo.commit('s2: beta (#2)', { 'b/two.ts': 'two\n' });
    repo.publish('feat/widgets');
    repo.git('switch', '-q', 'feat/widgets--s1');
    repo.git('merge', '-q', '--no-edit', 'origin/feat/widgets');
    repo.publish('feat/widgets--s1');
    expect(await run(repo.root, 'check', '7', 's1')).toMatchObject({ code: 0, out: 'reuse\n' });
  });

  it('prints the first file outside the territory and exits 1', async () => {
    const repo = fixture();
    repo.claim();
    repo.commit('feat(a): one', { 'a/one.ts': 'one\n', 'c/three.ts': 'three\n' });
    repo.publish('feat/widgets--s1');
    expect(await run(repo.root, 'check', '7', 's1')).toEqual({ code: 1, out: 'rebuild: outside territory: c/three.ts\n', err: '' });
  });

  it('reads the plan row on the remote feature branch now, against the one at the claim', async () => {
    const repo = fixture();
    repo.claim();
    repo.publish('feat/widgets--s1');
    repo.git('switch', '-q', '--detach', 'origin/feat/widgets');
    repo.commit('docs(plan): widen s1', { [PLAN_PATH]: plan('`a/` `c/`') });
    repo.publish('feat/widgets');
    expect(await run(repo.root, 'check', '7', 's1')).toMatchObject({ code: 1, out: 'rebuild: plan row changed: territory\n' });
    repo.commit('docs(plan): rename s1', { [PLAN_PATH]: plan('`a/`', 'Alpha, renamed') });
    repo.publish('feat/widgets');
    expect(await run(repo.root, 'check', '7', 's1')).toMatchObject({ code: 1, out: 'rebuild: plan row changed: title\n' });
  });

  it('prints no claim commit when the slice branch is not on the remote', async () => {
    const repo = fixture();
    expect(await run(repo.root, 'check', '7', 's1')).toEqual({ code: 1, out: 'rebuild: no claim commit\n', err: '' });
  });

  it('prints slice not in the plan for a slice the plan does not hold', async () => {
    const repo = fixture();
    expect(await run(repo.root, 'check', '7', 's9')).toEqual({ code: 1, out: 'rebuild: slice not in the plan\n', err: '' });
  });

  it('exits 2 when the feature branch has not been fetched, naming it', async () => {
    const repo = fixture();
    repo.git('update-ref', '-d', 'refs/remotes/origin/feat/widgets');
    const result = await run(repo.root, 'check', '7', 's1');
    expect(result.code).toBe(2);
    expect(result.err).toContain('origin/feat/widgets');
    expect(result.out).toBe('');
  });

  it('exits 2 on a malformed call or a PRD it cannot find', async () => {
    const repo = fixture();
    for (const args of [['check', '7'], ['check', '7', 'S1'], ['check', 'x', 's1'], ['look', '7', 's1'], []]) {
      const result = await run(repo.root, ...args);
      expect(result.code, args.join(' ')).toBe(2);
      expect(result.err).toMatch(/omni claim/);
    }
    const missing = await run(repo.root, 'check', '8', 's1');
    expect(missing.code).toBe(2);
    expect(missing.err).toContain('PRD 8');
  });

  it('names its PRD by position, for the session record', () => {
    expect(prdNamedBy(['claim', 'check', '7', 's1'])).toBe(7);
  });
});

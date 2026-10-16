// The knowledge check's facts (PRD 1990), on fixture repositories with a real `git` and the targets'
// reader replaced by a fake: no test calls GitHub.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formText, makeRepo, realExec } from '../../test/fixture.ts';
import type { Overrides } from '../../test/fixture.ts';
import type { TargetRow } from '../plan-repo/targets.ts';
import { gatherKnowledge, knowledgeFacts } from './knowledge.ts';
import type { ReadTargets } from './knowledge.ts';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const PLAYBOOK = '.omni-loop/knowledge/playbook';

/** A filled form citing `path` at its `hash`. */
const form = (formId: string, path: string, hash: string): string => formText({ frontMatter: { form: formId, state: 'filled', evidence: [`${path}@${hash}`] } });

const hashOf = (root: string, path: string): string => execFileSync('git', ['hash-object', '--', path], { cwd: root, encoding: 'utf8' }).trim().slice(0, 10);

/** A repository with a source file and a form citing it at `cited` (the file's own when left out). */
function repoWith({ config = {}, cited }: { config?: Overrides; cited?: string } = {}) {
  const repo = makeRepo({ git: true, config, files: { 'src/a.txt': 'one\n', '.omni-loop/knowledge/product/note.md': 'a note\n' } });
  repo.write(`${PLAYBOOK}/testing.md`, form('testing', 'src/a.txt', cited ?? hashOf(repo.root, 'src/a.txt')));
  return repo;
}

const io = (repo: ReturnType<typeof makeRepo>, cwd = repo.root) => ({ cwd, root: repo.root, config: repo.ctx.config, exec: realExec, now: NOW });

const row = (repo: string, state: TargetRow['state']): TargetRow => ({ repo, role: 'backend', knowledge: 'imported', loop: '0.0.1', state, detail: null });

describe('the knowledge check\'s facts', () => {
  it('reads a clean checkout: no stale evidence, no changed knowledge, and no targets outside a plan repository', async () => {
    const repo = repoWith();
    await expect(gatherKnowledge(io(repo))).resolves.toEqual({ staleEvidence: 0, targets: null, changed: 0 });
  });

  it('counts the playbook entries whose evidence file changed or is gone', async () => {
    const repo = repoWith({ cited: 'deadbeef00' });
    repo.write(`${PLAYBOOK}/setup.md`, form('setup', 'src/gone.txt', 'abc1234567'));
    await expect(gatherKnowledge(io(repo))).resolves.toMatchObject({ staleEvidence: 2 });
  });

  it('counts the tracked files changed under paths.knowledge, and no others', async () => {
    const repo = repoWith();
    writeFileSync(join(repo.root, '.omni-loop/knowledge/product/note.md'), 'edited\n');
    writeFileSync(join(repo.root, 'src/a.txt'), 'edited too\n');
    writeFileSync(join(repo.root, '.omni-loop/knowledge/product/new.md'), 'untracked\n');
    await expect(gatherKnowledge(io(repo))).resolves.toMatchObject({ changed: 1 });
  });

  it('does not judge the knowledge a linked worktree changed', async () => {
    const repo = repoWith();
    const linked = `${repo.root}-linked`;
    execFileSync('git', ['worktree', 'add', '-q', '--detach', linked], { cwd: repo.root, stdio: 'ignore' });
    writeFileSync(join(linked, '.omni-loop/knowledge/product/note.md'), 'edited in the worktree\n');
    await expect(gatherKnowledge(io(repo, linked))).resolves.toMatchObject({ changed: 0 });
  });

  it('is not checked outside a git checkout', async () => {
    const repo = makeRepo();
    await expect(gatherKnowledge(io(repo))).resolves.toEqual({ notChecked: 'not a git checkout' });
  });

  it('reads each target copy of a plan repository through the targets reader, with a budget on every gh call', async () => {
    const repo = repoWith({ config: { plan: { targets: [{ repo: 'acme/api', role: 'backend', knowledge: 'imported', readAt: 'a'.repeat(40) }, { repo: 'acme/web', role: 'web', knowledge: 'own' }, { repo: 'acme/ios', role: 'ios', knowledge: 'own' }] } } });
    const budgets: (number | undefined)[] = [];
    const read: ReadTargets = (targets, { exec }) => {
      exec('gh', ['api', 'x'], { encoding: 'utf8' });
      return targets.map(({ repo: name }) => row(name, name === 'acme/api' ? 'drifted' : name === 'acme/web' ? 'stale' : 'ok'));
    };
    const spy = {
      ...io(repo),
      exec: ((file, args, options) => {
        if (file === 'gh') {
          budgets.push(options?.timeout);
          return '';
        }
        return realExec(file, args, options);
      }) as typeof realExec,
    };
    const facts = await gatherKnowledge(spy, read);
    expect(facts).toMatchObject({ targets: [{ repo: 'acme/api', state: 'drifted' }, { repo: 'acme/web', state: 'stale' }, { repo: 'acme/ios', state: 'ok' }] });
    expect(budgets).toEqual([10_000]);
  });

  it('leaves a product\'s targets unread, since their list lives on the page', async () => {
    const repo = repoWith({ config: { plan: { product: 'mobile' } } });
    const read: ReadTargets = () => {
      throw new Error('never read');
    };
    await expect(gatherKnowledge(io(repo), read)).resolves.toMatchObject({ targets: null });
  });

  it('reads a targets reader that fails as not checked, never a throw', async () => {
    const repo = repoWith({ config: { plan: { targets: [{ repo: 'acme/api', role: 'backend', knowledge: 'own' }] } } });
    const read: ReadTargets = () => {
      throw new Error('spawnSync gh ENOENT');
    };
    await expect(gatherKnowledge(io(repo), read)).resolves.toMatchObject({ targets: { notChecked: 'no gh' } });
  });

  it('is the gatherer the run uses', async () => {
    const repo = repoWith();
    await expect(knowledgeFacts(io(repo))).resolves.toEqual({ staleEvidence: 0, targets: null, changed: 0 });
  });
});

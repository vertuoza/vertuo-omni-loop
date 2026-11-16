// Issue 2968: how `omni next` reads the Omni page — each distinct read once a run, and the PRDs side by
// side, printed in plan order. Kept out of `next.test.ts`, which proves laws (testing › Where tests live).
import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptions } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo, realExec } from '../test/fixture.ts';
import { parsePr } from '../lib/ids.ts';
import { aChange, fakeLoopReads } from '../lib/loop-reads/fake.ts';
import type { LoopReads } from '../lib/loop-reads/port.ts';
import { main } from './omni.ts';

const ME = 'me@example.com';
const planOf = (path: string) => ['# A plan', '', '| id | slice | territory | blocked by | wave |', '| --- | --- | --- | --- | --- |', `| s1 | s1 | \`${path}\` | — | 1 |`, ''].join('\n');

/** PRDs 7, 8 and 9, all yours, sharing no ground. */
function three(): string {
  const { root, write } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' } });
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  for (const [folder, path] of [['0007-widgets', 'a/'], ['0008-gadgets', 'q/'], ['0009-gizmos', 'z/']] as const) {
    write(`.omni-loop/delivery/inbox/${folder}/plan.md`, planOf(path));
    git('add', '-A');
    git('-c', `user.email=${ME}`, '-c', 'user.name=x', 'commit', '-q', '-m', folder);
  }
  git('config', 'user.email', ME);
  return root;
}

/** Each PRD's draft feature PR, and no sub-PR: every PRD can take its wave. */
const fake = () =>
  fakeLoopReads({
    changes: {
      'acme/widgets': ['widgets', 'gadgets', 'gizmos'].map((topic, i) =>
        aChange({ number: parsePr(9 + i), head: `feat/${topic}`, state: 'draft', body: `Closes #${7 + i}`, author: 'pm' }),
      ),
    },
  });

/** git for real, its fetch a no-op; anything else refused. */
function gitOnly(file: string, args: readonly string[], options: ExecFileSyncOptions = {}): string {
  if (file !== 'git') throw new Error(`unexpected call ${file}`);
  return args[0] === 'fetch' ? '' : realExec(file, args, options);
}

/** `reads`, each read answered after `delay(what it was given)` ms, counting how many wait at once. */
function slowed(reads: LoopReads, delay: (what: string) => number) {
  const seen = { now: 0, most: 0 };
  const slow = async <R,>(args: unknown[], read: () => Promise<R>): Promise<R> => {
    seen.now += 1;
    seen.most = Math.max(seen.most, seen.now);
    try {
      await new Promise((done) => setTimeout(done, delay(JSON.stringify(args))));
      return await read();
    } finally {
      seen.now -= 1;
    }
  };
  const wrapped: LoopReads = {
    changes: (query) => slow([query], () => reads.changes(query)),
    change: (repo, number) => slow([repo, number], () => reads.change(repo, number)),
    comments: (repo, on) => slow([repo, on], () => reads.comments(repo, on)),
    issues: (query) => slow([query], () => reads.issues(query)),
    issue: (repo, number) => slow([repo, number], () => reads.issue(repo, number)),
  };
  return { reads: wrapped, seen };
}

async function tick(root: string, reads: LoopReads) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['next', '--json'], { cwd: root, exec: gitOnly, reads, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, err: err.join(''), steps: (JSON.parse(out.join('')) as { steps: { prd: number }[] }).steps.map((one) => one.prd) };
}

describe('omni next — reading the Omni page (issue 2968)', () => {
  it('one tick asks for the open phase-0 PRs once, and never sends the same read twice', async () => {
    const reads = fake();
    const { code, err, steps } = await tick(three(), reads);
    expect(err).toBe('');
    expect(code).toBe(0);
    expect(steps).toEqual([7, 8, 9]);
    const sent = reads.reads.map((read) => JSON.stringify(read));
    expect(sent.filter((read) => read.includes('omni:phase-0'))).toHaveLength(1);
    expect(new Set(sent).size).toBe(sent.length);
  });

  it('reads the PRDs side by side and still prints them in plan order, the first PRD answered last', async () => {
    const { reads, seen } = slowed(fake(), (what) => (what.includes('widgets') ? 60 : 5));
    const { code, steps } = await tick(three(), reads);
    expect(code).toBe(0);
    expect(seen.most).toBeGreaterThan(1);
    expect(steps).toEqual([7, 8, 9]);
  });
});

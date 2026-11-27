// Bug #3371: `omni prd <key>-<n> --landed-in <ref>`, what /omni:ultra-yolo asks of each PRD the spec says it is blocked by, on
// omni-loop-27's shape: its target pull request merged into an earlier mission's branch, then that mission's pull request
// squash-merged into the default branch, which the base was cut from. It reads merged pull requests and git, never the page.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: demo-org/widgets\n' };
const BASE = 'origin/mission/19-settings';
const TARGET = { number: 83, body: 'Part of demo-27 · https://example.test/prd/27', baseRefName: 'mission/70-settings', headRefName: 'feat/demo-27', mergeCommit: { oid: 'a'.repeat(40) } };
const OTHER = { number: 84, body: 'Part of demo-270', baseRefName: 'main', headRefName: 'feat/demo-270', mergeCommit: { oid: 'c'.repeat(40) } };
const MISSION = { number: 118, body: 'Mission #70', baseRefName: 'main', headRefName: 'mission/70-settings', mergeCommit: { oid: 'b'.repeat(40) } };

/** What `gh pr list` answers: the merged pull requests a search finds, or those whose head is the earlier mission's branch. */
const ghAnswer = (args: readonly string[]): string => {
  if (args.includes('--search')) return JSON.stringify([TARGET, OTHER]);
  return JSON.stringify(args.includes('mission/70-settings') ? [MISSION] : []);
};

/** `git merge-base --is-ancestor <sha> <ref>`: exits 0 only for a commit of `inBase` in the base. */
const ancestor = (args: readonly string[], inBase: readonly string[]): string => {
  if (inBase.includes(args[2] ?? '') && args[3] === BASE) return '';
  throw new Error('exit 1');
};

/** A fake `execFileSync`: `gh pr list` answers the merged pull requests, `git merge-base --is-ancestor` exits 0 for `inBase`. */
function fakeExec(root: string, inBase: readonly string[], gh: 'ok' | 'down' = 'ok') {
  const calls: string[] = [];
  const exec = (file: string, args: readonly string[]) => {
    calls.push(`${file} ${args.join(' ')}`);
    if (file === 'git') return args[0] === 'rev-parse' ? `${root}\n` : ancestor(args, inBase);
    if (gh === 'down') throw Object.assign(new Error('gh'), { stderr: 'HTTP 502: Bad Gateway\n' });
    return ghAnswer(args);
  };
  return { exec, calls };
}

async function landed(inBase: readonly string[], gh: 'ok' | 'down' = 'ok', extra: string[] = []) {
  const { root } = makeRepo({ git: true, files: CONFIG });
  const out: string[] = [];
  const fake = fakeExec(root, inBase, gh);
  const code = await main(['prd', 'demo-27', '--landed-in', BASE, ...extra], { cwd: root, exec: fake.exec, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => undefined } });
  return { code, text: out.join(''), calls: fake.calls };
}

describe('omni prd <key>-<n> --landed-in (bug #3371)', () => {
  it('is landed when the mission pull request that merged its target pull request base is in the base', async () => {
    const { code, text, calls } = await landed([MISSION.mergeCommit.oid]);
    expect(text).toBe(`landed: yes · ${BASE} holds #83 into mission/70-settings, then #118 into main\n`);
    expect(code).toBe(0);
    expect(calls.some((one) => one.startsWith('gh pr list --repo demo-org/widgets --state merged --search "Part of demo-27" in:body'))).toBe(true);
  });

  it('is not landed while neither is in the base, and counts no pull request of another PRD', async () => {
    const { code, text } = await landed([OTHER.mergeCommit.oid]);
    expect(text).toBe(`landed: no · #83 into mission/70-settings, not in the base yet (${BASE})\n`);
    expect(code).toBe(1);
  });

  it('says gh failed, exit 1, when GitHub cannot say', async () => {
    const { code, text } = await landed([], 'down');
    expect(text).toBe('landed: unknown · gh failed: HTTP 502: Bad Gateway\n');
    expect(code).toBe(1);
  });

  it('reads another repository with --repo', async () => {
    const { calls } = await landed([MISSION.mergeCommit.oid], 'ok', ['--repo', 'demo-org/api']);
    expect(calls.some((one) => one.startsWith('gh pr list --repo demo-org/api'))).toBe(true);
  });

  it('is refused for a repository PRD, or beside --show or --json', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const quiet = { cwd: root, exec: fakeExec(root, []).exec, stdout: { write: () => undefined }, stderr: { write: () => undefined } };
    await expect(main(['prd', '7', '--landed-in', BASE], quiet)).resolves.toBe(2);
    await expect(main(['prd', 'demo-27', '--landed-in', BASE, '--json'], quiet)).resolves.toBe(2);
    await expect(main(['prd', 'demo-27', '--repo', 'demo-org/api'], quiet)).resolves.toBe(2);
  });
});

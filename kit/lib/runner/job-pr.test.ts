// Bug 2365: a runner job's pull request is one the job opened or handed off on, never a link it only
// read. Job 93914438 (`/omni:yolo 2338`) read old pull requests from files and test output, and its
// `PR:` milestones and its `prUrl` named #2205, a merged PR of another PRD, instead of #2339.
import { describe, expect, it } from 'vitest';
import { lastPullRequest } from './log.ts';
import { stepLine } from './steps.ts';

const REPO = 'vertuoza/vertuo-omni-loop';
const pr = (n: number): string => `https://github.com/${REPO}/pull/${String(n)}`;
const NOW = new Date(2026, 9, 22, 9, 0, 0);

const call = (id: string, name: string, input: Record<string, unknown>): string =>
  JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
const output = (id: string, content: string): string =>
  JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, is_error: false }] } });
const said = (words: string): string => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: words }] } });
const handOff = (words: string): string =>
  JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: 40, total_cost_usd: 3, duration_ms: 600_000, result: words });

/** The readable log a job writes for `events`, one shared context across the run, as `job.ts` writes it. */
function logOf(events: readonly string[]): string {
  const context = { now: NOW, seen: new Set<string>() };
  return events.flatMap((event) => stepLine(event, context)).join('\n');
}

const prLines = (log: string): string[] => log.split('\n').filter((line) => / PR: /.test(line));

describe('a runner job names the pull request it worked on, never one it only read (bug 2365)', () => {
  it('reads no PR from a file, a search or test output, and keeps the one the job opened', () => {
    const log = logOf([
      call('t1', 'Bash', { command: 'gh pr create --draft --base main --title "feat: PRD 2338" --body-file /tmp/b' }),
      output('t1', `${pr(2339)}\n`),
      call('t2', 'Read', { file_path: '.omni-loop/delivery/shipped/2176-old/retro.md' }),
      output('t2', `Shipped in ${pr(2176)}, then ${pr(2205)}.`),
      call('t3', 'Bash', { command: 'pnpm vitest run kit/lib/runner' }),
      output('t3', 'expected https://github.com/acme/widgets/pull/42\nall green'),
      said(`Looked at ${pr(2205)} for the shape of a retro.`),
      handOff('Waiting on the outbox.'),
    ]);
    expect(prLines(log)).toEqual([`09:00:00 PR: ${pr(2339)}`]);
    expect(lastPullRequest(log, REPO)).toBe(pr(2339));
  });

  it('takes the PR the hand-off names over the sub-PRs opened before it', () => {
    const log = logOf([
      call('t1', 'Bash', { command: 'gh pr create --draft --base main --title "feat: PRD 2338"' }),
      output('t1', `${pr(2339)}\n`),
      call('t2', 'Bash', { command: 'gh pr create --base feat/2338 --title "s1"' }),
      output('t2', `${pr(2340)}\n`),
      handOff(`The feature PR is ready.\n\n1. Review the change: ${pr(2339)}`),
    ]);
    expect(lastPullRequest(log, REPO)).toBe(pr(2339));
  });

  it('names no PR when the job opened none and its hand-off names none', () => {
    const log = logOf([call('t1', 'Grep', { pattern: 'pull/' }), output('t1', `${pr(2205)}\n${pr(2176)}`), handOff('Nothing to build.')]);
    expect(prLines(log)).toEqual([]);
    expect(lastPullRequest(log, REPO)).toBeNull();
  });
});

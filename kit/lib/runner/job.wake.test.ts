// A job whose session ends while its own work still runs in the background (bug 3288): `claude -p`
// exits 0 once its turn ends, even when that turn ended waiting on a background command (a test run
// moved to the background past its timeout) and said it would carry on when notified. The job must not
// end there as done: the runner resumes the same session, a bounded number of times, until it ends for
// real. A fake `claude` on the PATH stands in for the real one; each of its runs is recorded.
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runJobProcess } from './job.ts';
import { partsPath } from './turnover.ts';

const SESSION = 'b6f1c2d4-3288-4000-8000-000000000001';

/** The stream of a run whose last turn ends waiting on a background lint and test run, as job 3270's did. */
const WAITING = [
  { type: 'system', subtype: 'init', session_id: SESSION, model: 'claude-opus-5-5' },
  { type: 'assistant', session_id: SESSION, message: { content: [{ type: 'tool_use', id: 'tu1', name: 'Bash', input: { command: 'pnpm lint && pnpm test', description: 'Run lint and test' } }] } },
  { type: 'user', session_id: SESSION, message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'Command did not complete within its 600s timeout and was moved to the background (ID: b7k2x9). Output is being written to: /tmp/tasks/b7k2x9.output. You will be notified when it completes.' }] } },
  { type: 'system', subtype: 'task_started', session_id: SESSION, task_id: 'b7k2x9', is_backgrounded: true, description: 'Run lint and test' },
  { type: 'assistant', session_id: SESSION, message: { content: [{ type: 'text', text: "Waiting on the background lint and test run; I'll continue when it notifies." }] } },
  { type: 'result', subtype: 'success', is_error: false, session_id: SESSION, num_turns: 11, total_cost_usd: 1.05, duration_ms: 129_000, result: "The s1 agent is still waiting on its own background lint and test run, so its result is interim. I'm not starting wave 2 yet. I'll continue when it notifies again." },
];

/** The stream of a run that ends for real, on its hand-off. */
const FINISHED = [
  { type: 'system', subtype: 'init', session_id: SESSION, model: 'claude-opus-5-5' },
  { type: 'result', subtype: 'success', is_error: false, session_id: SESSION, num_turns: 4, total_cost_usd: 0.4, duration_ms: 60_000, result: 'Lint and test are green; wave 2 merged.\n\nOutcome: ready' },
];

/** The stream of a run that ends on a question for a person: it waits on a person, never on background work. */
const ASKED = [
  { type: 'system', subtype: 'init', session_id: SESSION, model: 'claude-opus-5-5' },
  { type: 'result', subtype: 'success', is_error: false, session_id: SESSION, num_turns: 9, total_cost_usd: 0.9, duration_ms: 90_000, result: 'This is more than a bug fix.\n\nWaiting for an answer on Omni: https://omni.example/runners?answer=7\n\nOutcome: need-human' },
];

const jsonl = (events: readonly object[]): string => `${events.map((event) => JSON.stringify(event)).join('\n')}\n`;

/**
 * A job's folder and a fake `claude` that prints `first` on its first run and `then` on every resume,
 * recording each run's arguments and standard input as `run-<n>.args` and `run-<n>.stdin`.
 */
function fixture(first: readonly object[], then: readonly object[]) {
  const root = mkdtempSync(join(tmpdir(), 'omni-job-wake-'));
  const bin = join(root, 'bin');
  const cwd = join(root, 'wt');
  mkdirSync(bin);
  mkdirSync(cwd);
  writeFileSync(join(root, 'first.jsonl'), jsonl(first));
  writeFileSync(join(root, 'then.jsonl'), jsonl(then));
  writeFileSync(
    join(bin, 'claude'),
    [
      '#!/bin/sh',
      `n=$(ls "${root}" | grep -c '^run-.*\\.args$')`,
      'n=$((n + 1))',
      `printf '%s\\n' "$@" > "${root}/run-$n.args"`,
      `cat > "${root}/run-$n.stdin"`,
      `if [ "$n" -eq 1 ]; then cat "${root}/first.jsonl"; else cat "${root}/then.jsonl"; fi`,
      'exit 0',
      '',
    ].join('\n'),
  );
  chmodSync(join(bin, 'claude'), 0o755);
  const files = { line: join(root, 'job-3288.line'), log: join(root, 'job-3288.log'), exit: join(root, 'job-3288.exit') };
  writeFileSync(files.line, '/omni:ultra-yolo omni-loop-27\n');
  writeFileSync(files.log, '');
  const out = { write: () => undefined };
  const env = { PATH: `${bin}:${String(process.env.PATH)}` };
  const runs = (): string[][] => {
    const found: string[][] = [];
    for (let n = 1; existsSync(join(root, `run-${String(n)}.args`)); n += 1) found.push(readFileSync(join(root, `run-${String(n)}.args`), 'utf8').trim().split('\n'));
    return found;
  };
  const stdin = (n: number): string => readFileSync(join(root, `run-${String(n)}.stdin`), 'utf8');
  return { cwd, files, out, env, runs, stdin };
}

describe('runJobProcess, a session that ends waiting on its background work (bug 3288)', () => {
  it('resumes the same session instead of ending done, until it ends for real', async () => {
    const f = fixture(WAITING, FINISHED);
    expect(await runJobProcess({ cwd: f.cwd, files: f.files, out: f.out, env: f.env })).toBe(0);
    const runs = f.runs();
    expect(runs).toHaveLength(2);
    expect(runs[1]).toEqual(expect.arrayContaining(['--resume', SESSION]));
    expect(f.stdin(2)).toMatch(/background/i);
    const log = readFileSync(f.files.log, 'utf8');
    expect(log).toMatch(/^↻ the session ended waiting on its background work: resumed, 1 of 3$/m);
    expect(log).toContain('Outcome: ready');
  });

  it('resumes it at most three times, then fails the job naming why', async () => {
    const f = fixture(WAITING, WAITING);
    expect(await runJobProcess({ cwd: f.cwd, files: f.files, out: f.out, env: f.env })).toBe(1);
    expect(f.runs()).toHaveLength(4);
    const log = readFileSync(f.files.log, 'utf8');
    expect(log).toMatch(/^↻ the session ended waiting on its background work: resumed, 3 of 3$/m);
    const parts = JSON.parse(readFileSync(partsPath(f.files.log), 'utf8')) as { reason: string | null };
    expect(parts.reason).toBe('the session still waited on its background work after 3 resumes');
  });

  it('ends a session that waits on a person as it ended, never resumed', async () => {
    const f = fixture(ASKED, FINISHED);
    expect(await runJobProcess({ cwd: f.cwd, files: f.files, out: f.out, env: f.env })).toBe(0);
    expect(f.runs()).toHaveLength(1);
    expect(readFileSync(f.files.log, 'utf8')).not.toContain('↻');
  });
});

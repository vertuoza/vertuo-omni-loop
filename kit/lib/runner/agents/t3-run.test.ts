// What a T3 run's process does (PRD 2537, s4), against a fake `t3` on the PATH replaying T3 0.1.3's
// outputs from `../fixtures/t3/`: it registers the job's worktree as a T3 project, starts the thread on
// the account's instance and model with the message on its standard input (`thread start <worktree> -
// --provider --model --wait --json`, or `thread send <thread> -` to resume), finds the thread
// (`thread list`), follows it with `thread show` every tick, prints the Claude instance's new
// transcript lines, stops it through T3's MCP endpoint when asked, prints the run's end
// (`{status, reply, error}`), and removes the project unless the run was stopped to be resumed.
// The recordings of the laptop trial are `thread-start.json`, `thread-show-running.json`,
// `thread-show-done.json` and `wait-pong.json`; the others are built from T3 0.1.3's source
// (`apps/server/src/cli/thread.ts`, `cli/project.ts`).
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { projectFolder } from '../tokens.ts';
import { followT3, t3Cli } from './t3-run.ts';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures', 't3');
const THREAD = 'mcp:fabd03d6-4537-4cfb-9d39-cc065784f406';
const RUN = 'run:thread:mcp%3Afabd03d6-4537-4cfb-9d39-cc065784f406:ordinal:1';
const NOW = Date.parse('2026-10-27T13:02:16.583Z');

/**
 * A fake `t3` on a PATH of its own, playing `wait` (a `wait-*.json` fixture) as the run's end with
 * `exit`, after `seconds`; `thread show` answers `shows` in turn, then the last again.
 */
function fakeT3({ wait = 'wait-done', exit = 0, seconds = 1, shows = ['thread-show-running', 'thread-show-done'], waitErr, projectErr, transcript }: {
  wait?: string; exit?: number; seconds?: number; shows?: string[]; waitErr?: string; projectErr?: string; transcript?: string;
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'omni-t3-run-'));
  const bin = join(root, 'bin');
  const dir = join(root, 'play');
  const cwd = join(root, 'wt', 'widgets-job-7');
  mkdirSync(bin);
  mkdirSync(dir);
  mkdirSync(cwd, { recursive: true });
  cpSync(join(FIXTURES, `${wait}.json`), join(dir, 'wait.json'));
  cpSync(join(FIXTURES, 'thread-list.json'), join(dir, 'thread-list.json'));
  shows.forEach((show, index) => {
    cpSync(join(FIXTURES, `${show}.json`), join(dir, `show-${String(index + 1)}.json`));
  });
  cpSync(join(FIXTURES, `${shows.at(-1) ?? 'thread-show-done'}.json`), join(dir, 'show-last.json'));
  if (waitErr !== undefined) writeFileSync(join(dir, 'wait.err'), `${waitErr}\n`);
  if (projectErr !== undefined) writeFileSync(join(dir, 'project.err'), `${projectErr}\n`);
  if (transcript !== undefined) writeFileSync(join(dir, 'transcript-to'), transcript);
  writeFileSync(join(bin, 't3'), [
    '#!/bin/sh',
    `dir="${dir}"`,
    'printf "%s\\n" "$*" >> "$dir/calls"',
    'case "$1 $2" in',
    '  "project add") if [ -f "$dir/project.err" ]; then cat "$dir/project.err" >&2; exit 1; fi; echo "Added project c138995a (widgets-job-7) at $3." ;;',
    '  "project remove") echo "Removed project c138995a (widgets-job-7)." ;;',
    '  "thread start"|"thread send")',
    '    cat > "$dir/stdin"',
    `    if [ -f "$dir/transcript-to" ]; then cat "${join(FIXTURES, 'transcript.jsonl')}" >> "$(cat "$dir/transcript-to")"; fi`,
    `    sleep ${String(seconds)}`,
    '    cat "$dir/wait.json"',
    '    if [ -f "$dir/wait.err" ]; then cat "$dir/wait.err" >&2; fi',
    `    exit ${String(exit)} ;;`,
    '  "thread list") cat "$dir/thread-list.json" ;;',
    '  "thread show")',
    '    n=$(cat "$dir/shows" 2>/dev/null || echo 0); n=$((n + 1)); echo "$n" > "$dir/shows"',
    '    f="$dir/show-$n.json"; [ -f "$f" ] || f="$dir/show-last.json"; cat "$f" ;;',
    '  *) echo "fake t3: $*" >&2; exit 64 ;;',
    'esac',
    '',
  ].join('\n'));
  chmodSync(join(bin, 't3'), 0o755);
  const printed: string[] = [];
  return {
    root,
    cwd,
    dir,
    cli: t3Cli({ PATH: `${bin}:${String(process.env.PATH)}` }),
    print: (line: string) => {
      printed.push(line);
    },
    printed,
    calls: () => (existsSync(join(dir, 'calls')) ? readFileSync(join(dir, 'calls'), 'utf8').trim().split('\n') : []),
    stdin: () => readFileSync(join(dir, 'stdin'), 'utf8'),
  };
}

const parsed = (lines: readonly string[]): unknown[] => lines.flatMap((line) => {
  try {
    const value: unknown = JSON.parse(line);
    return [value];
  } catch {
    return [];
  }
});
const ofType = (lines: readonly string[], type: string): unknown[] => parsed(lines).filter((value) => typeof value === 'object' && value !== null && 'type' in value && value.type === type);

const base = { instance: 'claude-b', model: 'claude-opus-5-5', thread: null, message: '/omni:yolo 7\n', transcripts: null, messages: false, tickMs: 40, now: () => NOW };

describe('a T3 run', () => {
  it('adds the worktree as a project, starts the thread on the instance and model, follows it, prints its end, and removes the project', async () => {
    const f = fakeT3();
    expect(await followT3({ ...base, cwd: f.cwd, cli: f.cli, print: f.print })).toBe(0);
    const calls = f.calls();
    expect(calls[0]).toBe(`project add ${f.cwd}`);
    expect(calls[1]).toBe(`thread start ${f.cwd} - --provider claude-b --model claude-opus-5-5 --wait --json`);
    expect(calls).toContain(`thread list --project ${f.cwd} --json`);
    expect(calls).toContain(`thread show ${THREAD} --json`);
    expect(calls.at(-1)).toBe(`project remove ${f.cwd} --force`);
    expect(f.stdin()).toBe('/omni:yolo 7\n');
    expect(ofType(f.printed, 't3.thread')).toEqual([{ type: 't3.thread', threadId: THREAD, instance: 'claude-b', model: 'claude-opus-5-5' }]);
    expect(ofType(f.printed, 't3.show')[0]).toEqual({ type: 't3.show', status: 'running', activeRunId: RUN, pendingRequestCount: 0, itemCount: 2, messages: [] });
    expect(ofType(f.printed, 't3.end')).toEqual([{
      type: 't3.end', threadId: THREAD, runId: RUN, status: 'completed',
      reply: 'PRD 7 shipped: the feature PR is ready.\nhttps://github.com/acme/widgets/pull/42', error: null, at: '2026-10-27T13:02:16.583Z', ms: 0,
    }]);
  });

  it("prints a state only when it changed, and the assistant's new messages for an instance whose own files are not read", async () => {
    const f = fakeT3({ seconds: 1.5, shows: ['thread-show-running', 'thread-show-running', 'thread-show-done'] });
    expect(await followT3({ ...base, instance: 'opencode', model: 'opencode/beam-free', messages: true, cwd: f.cwd, cli: f.cli, print: f.print })).toBe(0);
    const shows = ofType(f.printed, 't3.show');
    expect(shows.length).toBeLessThanOrEqual(2);
    expect(shows.at(-1)).toMatchObject({ status: 'completed', itemCount: 23, messages: [expect.stringContaining('I created `notes/fruits.md`')] });
  });

  it("prints the Claude instance's transcript lines written during the run, never the ones before it", async () => {
    const projects = mkdtempSync(join(tmpdir(), 'omni-t3-projects-'));
    const f = fakeT3();
    const folder = join(projects, projectFolder(f.cwd));
    mkdirSync(folder, { recursive: true });
    const file = join(folder, 'session.jsonl');
    writeFileSync(file, `${JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'an earlier run' }] } })}\n`);
    writeFileSync(join(f.dir, 'transcript-to'), file);
    expect(await followT3({ ...base, transcripts: projects, cwd: f.cwd, cli: f.cli, print: f.print })).toBe(0);
    const transcript = readFileSync(join(FIXTURES, 'transcript.jsonl'), 'utf8').trim().split('\n');
    expect(f.printed.filter((line) => line.includes('"sessionId"'))).toEqual(transcript);
    expect(f.printed.join('\n')).not.toContain('an earlier run');
  });

  it('keeps a transcript line written in two parts whole', async () => {
    const projects = mkdtempSync(join(tmpdir(), 'omni-t3-projects-'));
    const f = fakeT3({ seconds: 1 });
    const folder = join(projects, projectFolder(f.cwd));
    mkdirSync(folder, { recursive: true });
    const file = join(folder, 'session.jsonl');
    const line = JSON.stringify({ type: 'assistant', sessionId: 's', message: { content: [{ type: 'text', text: 'whole' }] } });
    writeFileSync(file, '');
    const run = followT3({ ...base, transcripts: projects, cwd: f.cwd, cli: f.cli, print: f.print });
    await new Promise((resolve) => setTimeout(resolve, 60));
    appendFileSync(file, line.slice(0, 20));
    await new Promise((resolve) => setTimeout(resolve, 120));
    appendFileSync(file, `${line.slice(20)}\n`);
    expect(await run).toBe(0);
    expect(f.printed.filter((printed) => printed.includes('"sessionId":"s"') || printed === line.slice(0, 20))).toEqual([line]);
  });

  it('resumes a thread with the message, adding no project', async () => {
    const f = fakeT3();
    expect(await followT3({ ...base, thread: THREAD, message: 'Write the handoff note.\n', cwd: f.cwd, cli: f.cli, print: f.print })).toBe(0);
    const calls = f.calls();
    expect(calls).toContain(`thread send ${THREAD} - --wait --json`);
    expect(calls).not.toContain(`project add ${f.cwd}`);
    expect(calls).not.toContain(`thread list --project ${f.cwd} --json`);
    expect(f.stdin()).toBe('Write the handoff note.\n');
    expect(ofType(f.printed, 't3.thread')).toEqual([{ type: 't3.thread', threadId: THREAD, instance: 'claude-b', model: 'claude-opus-5-5' }]);
  });

  it('carries on when the worktree is already a project', async () => {
    const f = fakeT3({ projectErr: `An active project already exists for '/home/runner/wt/widgets-job-7'.` });
    expect(await followT3({ ...base, cwd: f.cwd, cli: f.cli, print: f.print })).toBe(0);
    expect(f.calls()[1]).toContain('thread start');
  });

  it('ends on a project T3 refuses, starting nothing', async () => {
    const f = fakeT3({ projectErr: 'Failed to acquire server ownership.' });
    expect(await followT3({ ...base, cwd: f.cwd, cli: f.cli, print: f.print })).toBe(1);
    expect(f.calls()).toEqual([`project add ${f.cwd}`]);
    expect(f.printed).toEqual(['Failed to acquire server ownership.']);
  });

  it("ends on T3's exit and words when its server is not running", async () => {
    const f = fakeT3({ wait: 'wait-failed', exit: 1, seconds: 0, waitErr: 'No running T3 Code server uses /home/runner/.t3. Start T3 Code, then retry.' });
    writeFileSync(join(f.dir, 'wait.json'), '');
    expect(await followT3({ ...base, cwd: f.cwd, cli: f.cli, print: f.print })).toBe(1);
    expect(f.printed).toContain('No running T3 Code server uses /home/runner/.t3. Start T3 Code, then retry.');
    expect(ofType(f.printed, 't3.end')).toEqual([]);
  });

  it('ends a run that waits for an answer with exit 2 and its words', async () => {
    const f = fakeT3({ wait: 'wait-waiting', exit: 2, waitErr: `Thread ${THREAD} is waiting for an answer. Open it in T3 Code to respond.`, shows: ['thread-show-waiting'] });
    expect(await followT3({ ...base, cwd: f.cwd, cli: f.cli, print: f.print })).toBe(2);
    expect(ofType(f.printed, 't3.end')).toMatchObject([{ status: 'waiting' }]);
    expect(f.printed.at(-1)).toBe(`Thread ${THREAD} is waiting for an answer. Open it in T3 Code to respond.`);
  });

  it('ends a failed run with its error, a limit included', async () => {
    const f = fakeT3({ wait: 'wait-limit', exit: 1 });
    expect(await followT3({ ...base, cwd: f.cwd, cli: f.cli, print: f.print })).toBe(1);
    expect(ofType(f.printed, 't3.end')).toMatchObject([{ status: 'failed', error: 'Claude usage limit reached. This turn is paused until the 5-hour limit resets in 2h 30m.' }]);
    expect(f.calls().at(-1)).toBe(`project remove ${f.cwd} --force`);
  });

  it('stops the thread through T3 once asked, and keeps the project for the resume', async () => {
    const f = fakeT3({ wait: 'wait-interrupted', exit: 1, seconds: 1.5 });
    const controller = new AbortController();
    const stopped: string[] = [];
    const run = followT3({
      ...base, tickMs: 400, cwd: f.cwd, cli: f.cli, print: f.print,
      stop: { signal: controller.signal, interrupt: (thread) => { stopped.push(thread); return Promise.resolve({ status: 'interrupt_requested' }); } },
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    controller.abort();
    expect(await run).toBe(1);
    expect(stopped).toEqual([THREAD]);
    expect(f.calls().filter((call) => call.startsWith('thread show')).length).toBeLessThanOrEqual(6);
    expect(ofType(f.printed, 't3.interrupt')).toEqual([{ type: 't3.interrupt', threadId: THREAD, status: 'interrupt_requested' }]);
    expect(ofType(f.printed, 't3.end')).toMatchObject([{ status: 'interrupted' }]);
    expect(f.calls()).not.toContain(`project remove ${f.cwd} --force`);
  });

  it('says so when T3 refuses the stop, and lets the run go on to its end', async () => {
    const f = fakeT3({ seconds: 1.5 });
    const controller = new AbortController();
    controller.abort();
    expect(await followT3({
      ...base, cwd: f.cwd, cli: f.cli, print: f.print,
      stop: { signal: controller.signal, interrupt: () => Promise.resolve({ refused: 'T3 refused the credential (401): run omni runner t3-signin again' }) },
    })).toBe(0);
    expect(ofType(f.printed, 't3.interrupt')).toEqual([{ type: 't3.interrupt', threadId: THREAD, refused: 'T3 refused the credential (401): run omni runner t3-signin again' }]);
  });

  it('is exit 127 when t3 cannot be started', async () => {
    const printed: string[] = [];
    const cwd = mkdtempSync(join(tmpdir(), 'omni-t3-none-'));
    expect(await followT3({ ...base, cwd, cli: t3Cli({ PATH: join(cwd, 'no-bin') }), print: (line) => printed.push(line) })).toBe(127);
    expect(printed).toEqual(['t3: could not be started']);
  });
});

// Whether a `claude -p` run ended with its own work unfinished (bug 3288): its last turn says it waits on
// background work, or says it waits while a command it sent to the background never reported its end.
// The events follow Claude Code's stream-json: a tool result naming the command it moved to the
// background, `system`/`task_started` and `system`/`task_notification` events, and the `result`.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Run } from './agent.ts';
import { claudeAgent } from './claude.ts';

const agent = claudeAgent({ projects: join(tmpdir(), 'omni-claude-no-projects') });

const result = (text: string, isError = false): object => ({ type: 'result', subtype: isError ? 'error_during_execution' : 'success', is_error: isError, num_turns: 3, result: text });
const toolResult = (text: string): object => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', content: [{ type: 'text', text }] }] } });
const movedBack = (id: string): object => toolResult(`Command did not complete within its 600s timeout and was moved to the background (ID: ${id}). You will be notified when it completes.`);
const startedBack = (id: string): object => toolResult(`Command running in background with ID: ${id}. Output is being written to: /tmp/tasks/${id}.output.`);
const taskStarted = (id: string, backgrounded: boolean): object => ({ type: 'system', subtype: 'task_started', task_id: id, is_backgrounded: backgrounded });
const taskEnded = (id: string): object => ({ type: 'system', subtype: 'task_notification', task_id: id, status: 'completed' });
const notified = (id: string): object => ({ type: 'user', message: { content: `<task-notification>\n<task-id>${id}</task-id>\n<status>completed</status>\n</task-notification>` } });
const said = (text: string): object => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } });

const run = (events: readonly object[], exit: number | null = 0): Run => ({ cwd: '/home/runner/wt/widgets-job-7', lines: events.map((event) => JSON.stringify(event)), exit });
const waiting = (events: readonly object[], exit: number | null = 0): boolean => agent.waiting?.(run(events, exit)) ?? false;

describe('the claude adapter: waiting (bug 3288)', () => {
  it('reads a last turn that waits on its background work as unfinished', () => {
    expect(waiting([result("Waiting on the background lint and test run; I'll continue when it notifies.")])).toBe(true);
    expect(waiting([result('The s1 agent is still waiting on its notification, so its result is interim.')])).toBe(true);
  });

  it('reads a last turn that waits while a command it sent to the background never ended as unfinished', () => {
    expect(waiting([movedBack('b7k2x9'), result("I'll wait for its result before starting wave 2.")])).toBe(true);
    expect(waiting([startedBack('c1d2'), result('I will continue when it finishes.')])).toBe(true);
    expect(waiting([taskStarted('e3f4', true), result('I am waiting for it.')])).toBe(true);
  });

  it('reads a last turn that waits once every background command ended as finished', () => {
    expect(waiting([movedBack('b7k2x9'), taskEnded('b7k2x9'), result("I'll wait for its result before starting wave 2.")])).toBe(false);
    expect(waiting([startedBack('c1d2'), notified('c1d2'), result('I will continue when it finishes.')])).toBe(false);
    expect(waiting([taskStarted('e3f4', false), result('I am waiting for it.')])).toBe(false);
  });

  it('reads a turn that waits on a person, or ends on its hand-off, as finished', () => {
    expect(waiting([result('Waiting for an answer on Omni: https://omni.example/runners?answer=7\n\nOutcome: need-human')])).toBe(false);
    expect(waiting([movedBack('b7k2x9'), result('Wave 2 merged.\n\nOutcome: ready')])).toBe(false);
  });

  it('reads the last thing said when the run printed no result', () => {
    expect(waiting([said("Lint still running in the background. I'll wait.")])).toBe(true);
    expect(waiting([said("Lint still running in the background. I'll wait."), said('Done: the wave is merged.')])).toBe(false);
  });

  it('never reads a run that failed, or still goes, as waiting', () => {
    expect(waiting([result("Waiting on the background run; I'll continue when it notifies.")], 1)).toBe(false);
    expect(waiting([result("Waiting on the background run; I'll continue when it notifies.")], null)).toBe(false);
    expect(waiting([result("Waiting on the background run; I'll continue when it notifies.", true)])).toBe(false);
    expect(waiting([])).toBe(false);
  });
});

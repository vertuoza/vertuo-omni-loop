// A runner job's readable lines (PRD 1904, "One readable line per step"): `stepLine` over a recorded
// `claude -p --output-format stream-json --verbose` run, one case per row of the spec's table.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LINE_CUT, stepLine, STEP_OUTPUT_LINES } from './steps.ts';

const STREAM = readFileSync(join(import.meta.dirname, 'fixtures', 'stream.jsonl'), 'utf8').split('\n').filter(Boolean);
/** 12:04:31, the runner's local time. */
const NOW = new Date(2026, 9, 14, 12, 4, 31);
const T = '12:04:31 ';

/** Every readable line of the fixture run, one shared `seen` across it, as a job's run reads them. */
function readable(): string[] {
  const seen = new Set<string>();
  return STREAM.flatMap((line) => stepLine(line, { now: NOW, seen }));
}

/** The lines of one event of the fixture, picked by what its JSON holds. */
function linesOf(needle: string): string[] {
  const line = STREAM.find((each) => each.includes(needle));
  if (line === undefined) throw new Error(`no fixture event holds ${needle}`);
  return stepLine(line, { now: NOW });
}

describe('stepLine, a tool call', () => {
  it('reads a Bash call as its command, first line only', () => {
    expect(linesOf('"name":"Bash"')).toEqual([`${T}Bash: pnpm test`]);
  });

  it('reads an edit as Edit, a write as Write, each with its file path', () => {
    expect(linesOf('"name":"Edit"')).toEqual([`${T}Edit: /w/src/a.ts`]);
    expect(linesOf('"name":"MultiEdit"')).toEqual([`${T}Edit: /w/src/b.ts`]);
    expect(linesOf('"name":"NotebookEdit"')).toEqual([`${T}Edit: /w/n.ipynb`]);
    expect(linesOf('"name":"Write"')).toEqual([`${T}Write: /w/src/c.ts`]);
  });

  it('reads Read, Grep and Glob with their path or pattern', () => {
    expect(linesOf('"name":"Read"')).toEqual([`${T}Read: /w/README.md`]);
    expect(linesOf('"name":"Grep"')).toEqual([`${T}Grep: stepLine`]);
    expect(linesOf('"name":"Glob"')).toEqual([`${T}Glob: **/*.ts`]);
  });

  it('reads Task and Agent as Agent with its description', () => {
    expect(linesOf('"name":"Task"')).toEqual([`${T}Agent: Explore the runner`]);
    expect(linesOf('"name":"Agent"')).toEqual([`${T}Agent: Review the slice`]);
  });

  it('reads any other tool by its name alone', () => {
    expect(linesOf('"name":"TodoWrite"')).toEqual([`${T}TodoWrite`]);
  });
});

describe('stepLine, text, errors and links', () => {
  it('reads assistant text as its first non-empty line', () => {
    expect(linesOf('I will start')).toEqual([`${T}› I will start with the plan.`]);
  });

  it('reads a failed tool result as ✗ and its first line, then at most 20 more lines, indented', () => {
    const lines = linesOf('"is_error":true');
    expect(lines[0]).toBe(`${T}✗ Error: 3 tests failed`);
    expect(lines.slice(1)).toHaveLength(STEP_OUTPUT_LINES);
    expect(lines[1]).toBe(`${T}    FAIL test 1`);
    expect(lines.at(-1)).toBe(`${T}    FAIL test 20`);
  });

  it('names a pull request link once, from a tool result or assistant text', () => {
    const all = readable();
    expect(all.filter((line) => line === `${T}PR: https://github.com/acme/widgets/pull/42`)).toHaveLength(1);
    expect(all).toContain(`${T}› Opened https://github.com/acme/widgets/pull/42 for review.`);
    const fresh = stepLine(STREAM.find((each) => each.includes('Opened https')) ?? '', { now: NOW });
    expect(fresh).toEqual([`${T}› Opened https://github.com/acme/widgets/pull/42 for review.`, `${T}PR: https://github.com/acme/widgets/pull/42`]);
  });

  it('reads the result as Done with its turns, cost and duration, then every line of its text', () => {
    expect(linesOf('"type":"result"')).toEqual([`${T}Done: ok · 12 turns · $1.23 · 12m 34s`, `${T}Built the slice.`, `${T}Opened https://github.com/acme/widgets/pull/42`]);
    const failed = JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true, num_turns: 3, total_cost_usd: 0.05, duration_ms: 4200 });
    expect(stepLine(failed, { now: NOW })).toEqual([`${T}Done: error · 3 turns · $0.05 · 4s`]);
    const long = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: 1, total_cost_usd: 0, duration_ms: 3_725_000, result: '' });
    expect(stepLine(long, { now: NOW })).toEqual([`${T}Done: ok · 1 turns · $0.00 · 1h 2m`]);
  });
});

describe('stepLine, what it leaves out and passes through', () => {
  it('gives nothing for system, thinking, a tool result that succeeded and an unknown event', () => {
    expect(linesOf('"subtype":"init"')).toEqual([]);
    expect(linesOf('"type":"thinking"')).toEqual([]);
    expect(linesOf('all green')).toEqual([]);
    expect(linesOf('rate_limit_event')).toEqual([]);
    expect(stepLine('{"type":"assistant"}', { now: NOW })).toEqual([]);
    expect(stepLine('42', { now: NOW })).toEqual([]);
    expect(stepLine('', { now: NOW })).toEqual([]);
  });

  it('passes a line that is not JSON through as it is', () => {
    expect(stepLine('claude read: /omni:yolo 1717', { now: NOW })).toEqual(['claude read: /omni:yolo 1717']);
    expect(stepLine('{ not json', { now: NOW })).toEqual(['{ not json']);
  });

  it(`cuts every line to ${String(LINE_CUT)} characters`, () => {
    const bash = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'x'.repeat(900) } }] } });
    const [line] = stepLine(bash, { now: NOW });
    expect(line).toHaveLength(LINE_CUT);
    expect(line?.startsWith(`${T}Bash: xxx`)).toBe(true);
    expect(stepLine('y'.repeat(900), { now: NOW })[0]).toHaveLength(LINE_CUT);
  });

  it('reads the whole fixture run in order', () => {
    const all = readable();
    expect(all[0]).toBe(`${T}› I will start with the plan.`);
    expect(all.at(-3)).toBe(`${T}Done: ok · 12 turns · $1.23 · 12m 34s`);
  });
});

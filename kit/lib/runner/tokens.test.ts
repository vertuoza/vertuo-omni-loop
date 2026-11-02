// A runner's token counts (PRD 2102, s4), on fixture transcripts in a temporary projects folder: a
// message id counted once, a sub-agent's worktree below the job's counted, `job-12` not `job-123`,
// the 5-hour and midnight-UTC windows, a file not read again until it changes, and an unreadable tree.
import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { projectFolder, tokenSource } from './tokens.ts';

const NOW = Date.parse('2026-10-16T14:00:00.000Z');
const HOME = '/home/dev/wt';
const JOB = `${HOME}/widgets-job-12`;

type Message = { id?: string; at: string; input?: number; output?: number; cacheRead?: number; cacheWrite?: number };

/** One assistant line of a transcript. */
const assistant = ({ id, at, input = 0, output = 0, cacheRead = 0, cacheWrite = 0 }: Message): string =>
  JSON.stringify({
    type: 'assistant', timestamp: at,
    message: { ...(id === undefined ? {} : { id }), usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheWrite } },
  });

function projects() {
  const root = mkdtempSync(join(tmpdir(), 'omni-tokens-'));
  /** Writes a transcript for a session run in `cwd`, modified at `modified`. */
  const transcript = (cwd: string, name: string, lines: string[], modified = NOW): void => {
    const path = join(root, projectFolder(cwd), name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${lines.join('\n')}\n`);
    utimesSync(path, modified / 1000, modified / 1000);
  };
  return { root, transcript };
}

const counts = (input: number, output = 0, cacheRead = 0, cacheWrite = 0) => ({ input, output, cacheRead, cacheWrite });

describe('a job\'s tokens', () => {
  it('names a project folder after its directory, every character but a letter or a digit a dash', () => {
    expect(projectFolder('/Users/dev/wt/widgets-job-12/.claude/worktrees/agent-a1')).toBe('-Users-dev-wt-widgets-job-12--claude-worktrees-agent-a1');
  });

  it('counts a message id once, the last entry of a streamed message counting', () => {
    const { root, transcript } = projects();
    transcript(JOB, 's.jsonl', [
      assistant({ id: 'm1', at: '2026-10-16T13:00:00Z', input: 5, output: 1 }),
      assistant({ id: 'm1', at: '2026-10-16T13:00:01Z', input: 5, output: 40 }),
      assistant({ id: 'm2', at: '2026-10-16T13:01:00Z', input: 7, cacheRead: 100, cacheWrite: 9 }),
      'not json',
      JSON.stringify({ type: 'user', message: { content: 'hello' } }),
    ]);
    expect(tokenSource({ projects: root, now: () => NOW }).job(JOB)).toEqual(counts(12, 40, 100, 9));
  });

  it('counts a message id once across the job\'s files', () => {
    const { root, transcript } = projects();
    transcript(JOB, 'a.jsonl', [assistant({ id: 'shared', at: '2026-10-16T13:00:00Z', input: 3 })]);
    transcript(JOB, 'b.jsonl', [assistant({ id: 'shared', at: '2026-10-16T13:00:00Z', input: 3 }), assistant({ id: 'own', at: '2026-10-16T13:00:00Z', input: 4 })]);
    expect(tokenSource({ projects: root, now: () => NOW }).job(JOB)).toEqual(counts(7));
  });

  it('counts the worktrees a sub-agent runs in below the job\'s, and the transcripts it keeps in folders', () => {
    const { root, transcript } = projects();
    transcript(JOB, 'lead.jsonl', [assistant({ id: 'm1', at: '2026-10-16T13:00:00Z', input: 10 })]);
    transcript(`${JOB}/.claude/worktrees/agent-a1`, 'sub.jsonl', [assistant({ id: 'm2', at: '2026-10-16T13:00:00Z', input: 20, output: 2 })]);
    transcript(JOB, 'lead/subagents/agent-9.jsonl', [assistant({ id: 'm3', at: '2026-10-16T13:00:00Z', input: 30 })]);
    expect(tokenSource({ projects: root, now: () => NOW }).job(JOB)).toEqual(counts(60, 2));
  });

  it('does not count a neighbouring job that shares a prefix: job-12 is not job-123', () => {
    const { root, transcript } = projects();
    transcript(JOB, 's.jsonl', [assistant({ id: 'm1', at: '2026-10-16T13:00:00Z', input: 1 })]);
    transcript(`${HOME}/widgets-job-123`, 's.jsonl', [assistant({ id: 'm2', at: '2026-10-16T13:00:00Z', input: 1000 })]);
    const source = tokenSource({ projects: root, now: () => NOW });
    expect(source.job(JOB)).toEqual(counts(1));
    expect(source.job(`${HOME}/widgets-job-123`)).toEqual(counts(1000));
  });

  it('counts a job that has no transcript yet as none, not as unreadable', () => {
    const { root } = projects();
    expect(tokenSource({ projects: root, now: () => NOW }).job(JOB)).toEqual(counts(0));
  });
});

describe('the machine\'s tokens', () => {
  it('holds the last 5 hours and the day since midnight UTC apart', () => {
    const { root, transcript } = projects();
    transcript('/work/a', 's.jsonl', [
      assistant({ id: 'old', at: '2026-10-15T23:59:59Z', input: 1000 }), // yesterday
      assistant({ id: 'morning', at: '2026-10-16T05:00:00Z', input: 100 }), // today, 9 h ago
      assistant({ id: 'edge', at: '2026-10-16T09:00:00Z', input: 10 }), // exactly 5 h ago
      assistant({ id: 'recent', at: '2026-10-16T13:30:00Z', input: 1, output: 2 }),
      assistant({ at: '2026-10-16T13:31:00Z', input: 1 }), // no id: counted
    ]);
    expect(tokenSource({ projects: root, now: () => NOW }).machine()).toEqual({ last5h: counts(12, 2), today: counts(112, 2) });
  });

  it('counts every folder of the machine, and opens only the files modified within the windows', () => {
    const { root, transcript } = projects();
    transcript('/work/a', 's.jsonl', [assistant({ id: 'a', at: '2026-10-16T13:00:00Z', input: 1 })]);
    transcript('/work/b', 's.jsonl', [assistant({ id: 'b', at: '2026-10-16T12:00:00Z', input: 2 })]);
    transcript('/work/c', 'stale.jsonl', [assistant({ id: 'c', at: '2026-10-14T12:00:00Z', input: 4 })], Date.parse('2026-10-14T12:00:00Z'));
    const opened: string[] = [];
    const source = tokenSource({ projects: root, now: () => NOW, readFile: (path) => { opened.push(path); return readFileSync(path, 'utf8'); } });
    expect(source.machine()).toEqual({ last5h: counts(3), today: counts(3) });
    expect(opened).toHaveLength(2);
    expect(opened.some((path) => path.includes(projectFolder('/work/c')))).toBe(false);
  });
});

describe('the cost of reading', () => {
  it('reads a file again only when its size or modification time changed', () => {
    const { root, transcript } = projects();
    transcript(JOB, 's.jsonl', [assistant({ id: 'm1', at: '2026-10-16T13:00:00Z', input: 1 })]);
    const opened: string[] = [];
    const source = tokenSource({ projects: root, now: () => NOW, readFile: (path) => { opened.push(path); return readFileSync(path, 'utf8'); } });
    expect(source.job(JOB)).toEqual(counts(1));
    expect(source.job(JOB)).toEqual(counts(1));
    expect(source.machine()?.today).toEqual(counts(1));
    expect(opened).toHaveLength(1);
    transcript(JOB, 's.jsonl', [assistant({ id: 'm1', at: '2026-10-16T13:00:00Z', input: 1 }), assistant({ id: 'm2', at: '2026-10-16T13:05:00Z', input: 5 })], NOW + 1000);
    expect(source.job(JOB)).toEqual(counts(6));
    expect(opened).toHaveLength(2);
  });
});

describe('an unreadable tree', () => {
  it('is null, never 0, with no projects folder', () => {
    const source = tokenSource({ projects: join(tmpdir(), 'omni-tokens-none', 'projects'), now: () => NOW });
    expect(source.job(JOB)).toBeNull();
    expect(source.machine()).toBeNull();
  });

  it('is null when a transcript is refused', () => {
    const { root, transcript } = projects();
    transcript(JOB, 's.jsonl', [assistant({ id: 'm1', at: '2026-10-16T13:00:00Z', input: 1 })]);
    const source = tokenSource({ projects: root, now: () => NOW, readFile: () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); } });
    expect(source.job(JOB)).toBeNull();
    expect(source.machine()).toBeNull();
  });
});

describe('several Claude folders (PRD 2537, s4)', () => {
  it("adds a job's transcripts kept in each folder: the machine's own Claude and a T3 instance's", () => {
    const own = projects();
    const instance = projects();
    own.transcript(JOB, 'a.jsonl', [assistant({ id: 'm1', at: '2026-10-16T13:00:00Z', input: 3, output: 1 })]);
    instance.transcript(JOB, 'b.jsonl', [assistant({ id: 'm2', at: '2026-10-16T13:30:00Z', input: 4, cacheRead: 50 })]);
    const source = tokenSource({ projects: [own.root, instance.root], now: () => NOW });
    expect(source.job(JOB)).toEqual(counts(7, 1, 50));
    expect(source.machine()?.last5h).toEqual(counts(7, 1, 50));
  });

  it('skips a folder that does not exist yet, and is null only when none exists', () => {
    const own = projects();
    own.transcript(JOB, 'a.jsonl', [assistant({ id: 'm1', at: '2026-10-16T13:00:00Z', input: 3 })]);
    const missing = join(tmpdir(), 'omni-tokens-none', 'instance', 'projects');
    expect(tokenSource({ projects: [own.root, missing], now: () => NOW }).job(JOB)).toEqual(counts(3));
    expect(tokenSource({ projects: [missing, `${missing}-2`], now: () => NOW }).job(JOB)).toBeNull();
    expect(tokenSource({ projects: [], now: () => NOW }).machine()).toBeNull();
  });

  it('reads a folder named twice once', () => {
    const own = projects();
    own.transcript(JOB, 'a.jsonl', [assistant({ at: '2026-10-16T13:00:00Z', input: 3 })]);
    expect(tokenSource({ projects: [own.root, own.root], now: () => NOW }).job(JOB)).toEqual(counts(3));
  });
});

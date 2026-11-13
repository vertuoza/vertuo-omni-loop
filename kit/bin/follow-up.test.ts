// PRD 2739, s1: `omni follow-up add` and `list`, through `main()` on a fixture repository. The injected
// `exec` records every process; the commands call none.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const DIR = '.omni-loop/delivery/follow-ups';

function setup() {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\n' } });
  const calls: string[] = [];
  // `git` resolves the repository for every command; anything else (gh, curl) is recorded and refused.
  const exec = ((file: string, args: readonly string[], options?: unknown) => {
    if (file === 'git') return execFileSync(file, args, options as never);
    calls.push(file);
    throw new Error(`no process may run: ${file}`);
  }) as never;
  async function omni(argv: readonly string[]) {
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(argv, { cwd: root, exec, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
    return { code, out: out.join(''), err: err.join('') };
  }
  return { root, calls, omni };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('omni follow-up add', () => {
  it('writes one file with source, date and text, prints its path, and refuses a duplicate', async () => {
    const { root, omni, calls } = setup();
    const argv = ['follow-up', 'add', '--source', 'bug #12', '--text', 'The retry loop never stops.'];
    const first = await omni(argv);
    const path = `${DIR}/2026-11-12-the-retry-loop-never-stops.md`;
    expect(first).toEqual({ code: 0, out: `${path}\n`, err: '' });
    expect(readFileSync(join(root, path), 'utf8')).toBe(
      '---\nsource: bug #12\ndate: 2026-11-12\n---\n\nThe retry loop never stops.\n',
    );
    const again = await omni(['follow-up', 'add', '--source', 'bug #12', '--text', 'The  retry loop\nnever stops.']);
    expect(again.code).toBe(1);
    expect(again.err).toContain('2026-11-12-the-retry-loop-never-stops.md');
    expect(again.err.trim().split('\n')).toHaveLength(1);
    expect(calls).toEqual([]);
  });

  it('files the same text under another source, and keeps --repos', async () => {
    const { root, omni } = setup();
    await omni(['follow-up', 'add', '--source', 'bug #12', '--text', 'Same point.']);
    const other = await omni(['follow-up', 'add', '--source', 'mobile-B3', '--text', 'Same point.', '--repos', 'demo-org/nimbus-api']);
    expect(other.code).toBe(0);
    expect(other.out).toBe(`${DIR}/2026-11-12-same-point-2.md\n`);
    expect(readFileSync(join(root, DIR, '2026-11-12-same-point-2.md'), 'utf8')).toContain('repos: [demo-org/nimbus-api]\n');
  });

  it('exits 2 with one line for an empty text, a text over 300 characters or a bad source', async () => {
    const { root, omni } = setup();
    for (const argv of [
      ['--source', 'bug #1', '--text', '   '],
      ['--source', 'bug #1', '--text', 'x'.repeat(301)],
      ['--source', 'issue 1', '--text', 'A point.'],
      ['--source', 'PRD #7', '--text', 'A point.'],
      ['--source', 'bug #1', '--text', 'A point.', '--repos', 'not a repo'],
    ]) {
      const result = await omni(['follow-up', 'add', ...argv]);
      expect(result.code).toBe(2);
      expect(result.out).toBe('');
      expect(result.err.trim().split('\n')).toHaveLength(1);
    }
    expect(existsSync(join(root, DIR))).toBe(false);
  });

  it('takes the three source shapes and a text of exactly 300 characters', async () => {
    const { omni } = setup();
    expect((await omni(['follow-up', 'add', '--source', 'PRD #7 · https://github.com/demo-org/app/pull/9#discussion_r1', '--text', 'a'.repeat(300)])).code).toBe(0);
    expect((await omni(['follow-up', 'add', '--source', 'demo-app-B12', '--text', 'Another one.'])).code).toBe(0);
  });

  it('exits 2 with a missing flag or an unknown verb', async () => {
    const { omni } = setup();
    expect((await omni(['follow-up', 'add', '--source', 'bug #1'])).code).toBe(2);
    expect((await omni(['follow-up'])).code).toBe(2);
    expect((await omni(['follow-up', 'close'])).code).toBe(2);
  });
});

describe('omni follow-up list', () => {
  it('prints none when the folder is missing or empty', async () => {
    const { omni } = setup();
    expect(await omni(['follow-up', 'list'])).toEqual({ code: 0, out: 'none\n', err: '' });
    expect((await omni(['follow-up', 'list', '--json'])).out).toBe('[]\n');
  });

  it('prints date, source and first line oldest first, and the same as JSON', async () => {
    const { root, omni, calls } = setup();
    await omni(['follow-up', 'add', '--source', 'bug #2', '--text', 'Newer point.\nWith a second line.']);
    writeFileSync(join(root, DIR, '2026-10-02-older.md'), '---\nsource: bug #1\ndate: 2026-10-02\n---\n\nOlder point.\n');
    const listed = await omni(['follow-up', 'list']);
    expect(listed.out).toBe('2026-10-02  bug #1  Older point.\n2026-11-12  bug #2  Newer point.\n');
    const json: unknown = JSON.parse((await omni(['follow-up', 'list', '--json'])).out);
    expect(json).toMatchObject([
      { source: 'bug #1', date: '2026-10-02', text: 'Older point.' },
      { source: 'bug #2', date: '2026-11-12' },
    ]);
    expect(calls).toEqual([]);
  });
});

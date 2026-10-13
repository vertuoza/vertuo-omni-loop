// A job's log as the runner reads it (PRD 1830): the tail it sends, the pull request it links, and
// the `--timeout` it is held to.
import { describe, expect, it } from 'vitest';
import { lastPullRequest, logTail, parseDuration, TAIL_BYTES, TAIL_LINES } from './log.ts';

describe('logTail', () => {
  it('keeps the last 200 lines', () => {
    const log = Array.from({ length: 250 }, (_, index) => `line ${String(index + 1)}`).join('\n') + '\n';
    const tail = logTail(log).split('\n');
    expect(tail).toHaveLength(TAIL_LINES);
    expect(tail[0]).toBe('line 51');
    expect(tail.at(-1)).toBe('line 250');
  });

  it('cuts long lines to 16 KB from the front, on a whole line', () => {
    const log = Array.from({ length: 100 }, (_, index) => `${String(index)} ${'x'.repeat(500)}`).join('\n');
    const tail = logTail(log);
    expect(Buffer.byteLength(tail)).toBeLessThanOrEqual(TAIL_BYTES);
    expect(tail.split('\n')[0]).toMatch(/^\d+ x+$/);
    expect(tail.endsWith(`99 ${'x'.repeat(500)}`)).toBe(true);
  });

  it('keeps a short log whole', () => {
    expect(logTail('a\nb\n')).toBe('a\nb');
    expect(logTail('')).toBe('');
  });
});

describe('lastPullRequest', () => {
  it("reads the last pull request of the job's repository, and no other repository's", () => {
    const log = [
      'opened https://github.com/acme/widgets/pull/12',
      'see https://github.com/acme/other/pull/99',
      'then https://github.com/acme/widgets/pull/14.',
      'https://github.com/acme/widgets-two/pull/7',
    ].join('\n');
    expect(lastPullRequest(log, 'acme/widgets')).toBe('https://github.com/acme/widgets/pull/14');
    expect(lastPullRequest('nothing here', 'acme/widgets')).toBeNull();
  });
});

describe('parseDuration', () => {
  it('reads seconds, minutes and hours, and refuses anything else', () => {
    expect(parseDuration('3h')).toBe(3 * 3_600_000);
    expect(parseDuration('45m')).toBe(45 * 60_000);
    expect(parseDuration('90s')).toBe(90_000);
    for (const text of ['0h', '3', 'h', '1.5h', '3d', '-1h', ' 3h']) expect(parseDuration(text)).toBeNull();
  });
});

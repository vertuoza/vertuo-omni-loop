import { afterEach, describe, expect, it, vi } from 'vitest';
import { capture, throwing } from './capture.ts';
import { loggedHandler, loggedRun, noteTo, outcomeOfStatus } from './run-log.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('outcomeOfStatus', () => {
  it('reads 2xx and 3xx as ok, 4xx as refused, 5xx as failed', () => {
    expect([200, 202, 302, 400, 401, 405, 499, 500, 502].map(outcomeOfStatus)).toEqual([
      'ok', 'ok', 'ok', 'refused', 'refused', 'refused', 'refused', 'failed', 'failed',
    ]);
  });
});

describe('loggedRun', () => {
  it('writes exactly one line at the end, with the outcome, the ms and the noted ids', async () => {
    const { logger, advance, lines } = capture();
    const value = await loggedRun(logger, 'webhook', async (note) => {
      note({ deliveryId: 'd-1' });
      advance(30);
      note({ repo: 'o/r' });
      return Promise.resolve(7);
    }, () => 'ok');
    expect(value).toBe(7);
    expect(lines()).toEqual([{ level: 'info', event: 'webhook', outcome: 'ok', ms: 30, deliveryId: 'd-1', repo: 'o/r' }]);
  });

  it('writes refused at warn and failed at error', async () => {
    const { logger, lines } = capture();
    await loggedRun(logger, 'a', () => Promise.resolve(1), () => 'refused');
    await loggedRun(logger, 'b', () => Promise.resolve(1), () => 'failed');
    expect(lines().map(({ level, outcome }) => [level, outcome])).toEqual([['warn', 'refused'], ['error', 'failed']]);
  });

  it('writes failed with the error on a throw, and rethrows the very error', async () => {
    const { logger, lines } = capture();
    const thrown = new TypeError('boom');
    await expect(loggedRun(logger, 'webhook', () => Promise.reject(thrown), () => 'ok')).rejects.toBe(thrown);
    expect(lines()).toEqual([{ level: 'error', event: 'webhook', outcome: 'failed', ms: 0, error: { name: 'TypeError', message: 'boom' } }]);
  });

  it('changes nothing when the logger throws: the value comes back, the error is the same', async () => {
    await expect(loggedRun(throwing, 'webhook', () => Promise.resolve('v'), () => 'ok')).resolves.toBe('v');
    const thrown = new Error('x');
    await expect(loggedRun(throwing, 'webhook', () => Promise.reject(thrown), () => 'ok')).rejects.toBe(thrown);
  });
});

describe('loggedHandler', () => {
  it('logs the status the handler answered, and answers it unchanged', async () => {
    const { logger, lines } = capture();
    const answer = new Response('no', { status: 405 });
    const handler = loggedHandler(logger, 'server-event', () => answer);
    expect(await handler(new Request('https://x.example/'))).toBe(answer);
    expect(lines()).toEqual([{ level: 'warn', event: 'server-event', outcome: 'refused', ms: 0, status: 405 }]);
  });
});

describe('noteTo', () => {
  it('writes the sentence as message, at warn, in a note line naming the module', () => {
    const { logger, lines } = capture();
    noteTo('outbox-check', logger)('outbox: waiting on the budget');
    expect(lines()).toEqual([{ level: 'warn', event: 'note', fn: 'outbox-check', message: 'outbox: waiting on the budget' }]);
  });

  it('writes to stdout by default, as one JSON line', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    noteTo('webhook')('a sentence');
    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(write.mock.calls[0]?.[0]))).toEqual({ level: 'warn', event: 'note', fn: 'webhook', message: 'a sentence' });
  });

  it('never throws', () => {
    expect(() => {
      noteTo('webhook', throwing)('x');
    }).not.toThrow();
  });
});

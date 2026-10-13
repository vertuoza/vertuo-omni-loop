import { InngestTestEngine } from '@inngest/test';
import { Inngest } from 'inngest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { capture, throwing } from './capture.ts';
import { loggedClient, loggedHandler, loggedRun, noteTo, outcomeOfStatus } from './run-log.ts';

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

describe('loggedClient', () => {
  const inngest = new Inngest({ id: 'run-log-test' });
  const event = { name: 'test/run', data: {} };

  it('logs one inngest line per run, ok, with the function id and the run id, through every step', async () => {
    const { logger, lines } = capture();
    const fn = loggedClient(inngest, logger).createFunction({ id: 'two-steps', triggers: [{ event: 'test/run' }] }, async ({ step }) => {
      const a = await step.run('a', () => 1);
      const b = await step.run('b', () => 2);
      return a + b;
    });
    const { result } = await new InngestTestEngine({ function: fn, events: [event] }).execute();
    expect(result).toBe(3);
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toMatchObject({ level: 'info', event: 'inngest', outcome: 'ok', fn: 'two-steps' });
    expect(typeof lines()[0]?.runId).toBe('string');
    expect(typeof lines()[0]?.ms).toBe('number');
  });

  it('logs failed on a thrown error, which still fails the run', async () => {
    const { logger, lines } = capture();
    const fn = loggedClient(inngest, logger).createFunction({ id: 'throws', triggers: [{ event: 'test/run' }] }, () => {
      throw new Error('nope');
    });
    const { error } = await new InngestTestEngine({ function: fn, events: [event] }).execute();
    expect(error).toBeDefined();
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toMatchObject({ level: 'error', event: 'inngest', outcome: 'failed', fn: 'throws', error: { name: 'Error', message: 'nope' } });
  });

  it('keeps every option as given, retries and the failure handler included, and logs the failure handler’s run', async () => {
    const { logger, lines } = capture();
    const failed: unknown[] = [];
    const fn = loggedClient(inngest, logger).createFunction(
      {
        id: 'with-failure',
        triggers: [{ event: 'test/run' }],
        retries: 2,
        onFailure: ({ error }) => {
          failed.push(error.message);
          return 'handled';
        },
      },
      () => 'done',
    );
    expect(fn.opts.retries).toBe(2);
    expect(fn.opts.id).toBe('with-failure');
    const onFailure = fn.opts.onFailure as unknown as (ctx: object) => Promise<unknown>;
    await expect(onFailure({ runId: 'run-9', error: new Error('final') })).resolves.toBe('handled');
    expect(failed).toEqual(['final']);
    expect(lines()).toEqual([expect.objectContaining({ event: 'inngest', outcome: 'ok', fn: 'with-failure-failure', runId: 'run-9' })]);
  });

  it('a failure handler that throws logs failed and throws the same error', async () => {
    const { logger, lines } = capture();
    const thrown = new Error('handler down');
    const fn = loggedClient(inngest, logger).createFunction(
      { id: 'bad-failure', triggers: [{ event: 'test/run' }], onFailure: () => { throw thrown; } },
      () => 'done',
    );
    const onFailure = fn.opts.onFailure as unknown as (ctx: object) => Promise<unknown>;
    await expect(onFailure({ runId: 'r' })).rejects.toBe(thrown);
    expect(lines()[0]).toMatchObject({ outcome: 'failed', fn: 'bad-failure-failure' });
  });

  it('a logger that throws changes no result and no error', async () => {
    const ok = loggedClient(inngest, throwing).createFunction({ id: 'ok-quiet', triggers: [{ event: 'test/run' }] }, () => 'fine');
    expect((await new InngestTestEngine({ function: ok, events: [event] }).execute()).result).toBe('fine');
    const bad = loggedClient(inngest, throwing).createFunction({ id: 'bad-quiet', triggers: [{ event: 'test/run' }] }, () => {
      throw new Error('still thrown');
    });
    expect((await new InngestTestEngine({ function: bad, events: [event] }).execute()).error).toMatchObject({ message: 'still thrown' });
  });

  it('hands anything but createFunction to the client itself', () => {
    expect(loggedClient(inngest, throwing).id).toBe('run-log-test');
  });
});

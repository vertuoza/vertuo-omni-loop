import { describe, expect, it, vi } from 'vitest';
import { createLogger, log, LOG_FIELDS, type LogSink } from './log.ts';
import { parsePrd } from '../ids.ts';

/** A logger writing into an array, on a clock the test moves. */
function harness() {
  const lines: string[] = [];
  let now = 1_000;
  const sink: LogSink = (line) => {
    lines.push(line);
  };
  const logger = createLogger({ sink, clock: () => now });
  return {
    logger,
    lines,
    advance: (ms: number) => {
      now += ms;
    },
    parsed: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

describe('a log call', () => {
  it('writes exactly one line that JSON.parse reads, with level, event, outcome and ms', () => {
    const { logger, lines, parsed } = harness();
    logger.info({ event: 'webhook', outcome: 'ok', ms: 12 });
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('\n');
    expect(parsed()[0]).toEqual({ level: 'info', event: 'webhook', outcome: 'ok', ms: 12 });
  });

  it('writes its level from the method called', () => {
    const { logger, parsed } = harness();
    logger.info({ event: 'a', outcome: 'ok', ms: 1 });
    logger.warn({ event: 'b', outcome: 'refused', ms: 2 });
    logger.error({ event: 'c', outcome: 'failed', ms: 3 });
    expect(parsed().map((line) => line.level)).toEqual(['info', 'warn', 'error']);
  });

  it('keeps every allow-listed field', () => {
    const { logger, parsed } = harness();
    logger.info({
      event: 'inngest',
      outcome: 'ok',
      ms: 40,
      repo: 'acme/widgets',
      prd: parsePrd(7),
      deliveryId: 'd-1',
      runId: 'r-1',
      fn: 'stage-forward',
      status: 200,
      message: 'stage moved',
      repos: 3,
    });
    expect(parsed()[0]).toEqual({
      level: 'info',
      event: 'inngest',
      outcome: 'ok',
      ms: 40,
      repo: 'acme/widgets',
      prd: 7,
      deliveryId: 'd-1',
      runId: 'r-1',
      fn: 'stage-forward',
      status: 200,
      message: 'stage moved',
      repos: 3,
    });
    expect(Object.keys(parsed()[0] ?? {}).every((key) => (LOG_FIELDS as readonly string[]).includes(key))).toBe(true);
  });

  it('measures ms on the injected clock', () => {
    const { logger, advance, parsed } = harness();
    const elapsed = logger.timer();
    advance(250);
    logger.info({ event: 'stages-sync', outcome: 'ok', ms: elapsed() });
    expect(parsed()[0]?.ms).toBe(250);
  });
});

describe('the allow-list', () => {
  it('drops a field outside it, its name and value absent, and counts it in dropped', () => {
    const { logger, lines, parsed } = harness();
    logger.info({ event: 'webhook', outcome: 'ok', ms: 1, ...({ password: 'hunter2', payload: { a: 1 } } as object) });
    expect(lines[0]).not.toContain('password');
    expect(lines[0]).not.toContain('hunter2');
    expect(lines[0]).not.toContain('payload');
    expect(parsed()[0]?.dropped).toBe(2);
  });

  it('writes no dropped when nothing was dropped', () => {
    const { logger, parsed } = harness();
    logger.info({ event: 'webhook', outcome: 'ok', ms: 1 });
    expect(parsed()[0]).not.toHaveProperty('dropped');
  });

  it('drops and counts an allowed field whose value is not a plain scalar', () => {
    const { logger, parsed } = harness();
    logger.info({ event: 'webhook', outcome: 'ok', ms: 1, ...({ repo: { owner: 'acme' } } as object) });
    expect(parsed()[0]).not.toHaveProperty('repo');
    expect(parsed()[0]?.dropped).toBe(1);
  });

  it('never lets a caller override the level', () => {
    const { logger, parsed } = harness();
    logger.info({ event: 'webhook', outcome: 'ok', ms: 1, ...({ level: 'error' } as object) });
    expect(parsed()[0]?.level).toBe('info');
  });
});

describe('an error', () => {
  it('comes out as { name, message } with no stack', () => {
    const { logger, lines, parsed } = harness();
    const error = new TypeError('boom');
    logger.error({ event: 'webhook', outcome: 'failed', ms: 5, error });
    expect(parsed()[0]?.error).toEqual({ name: 'TypeError', message: 'boom' });
    expect(lines[0]).not.toContain('stack');
    expect(lines[0]).not.toContain('at ');
  });

  it('cuts a message over 500 characters to 500', () => {
    const { logger, parsed } = harness();
    logger.error({ event: 'webhook', outcome: 'failed', ms: 5, error: new Error('x'.repeat(900)) });
    expect((parsed()[0]?.error as { message: string }).message).toBe('x'.repeat(500));
  });

  it('keeps a message of 500 characters whole', () => {
    const { logger, parsed } = harness();
    logger.error({ event: 'webhook', outcome: 'failed', ms: 5, error: new Error('y'.repeat(500)) });
    expect((parsed()[0]?.error as { message: string }).message).toBe('y'.repeat(500));
  });

  it('writes a thrown value that is not an Error by its text', () => {
    const { logger, parsed } = harness();
    logger.error({ event: 'webhook', outcome: 'failed', ms: 5, error: 'plain text' });
    expect(parsed()[0]?.error).toEqual({ name: 'Error', message: 'plain text' });
  });

  it('cuts the message field to 500 characters too', () => {
    const { logger, parsed } = harness();
    logger.warn({ event: 'webhook', outcome: 'failed', ms: 5, message: 'z'.repeat(800) });
    expect(parsed()[0]?.message).toBe('z'.repeat(500));
  });
});

describe('credential masking', () => {
  const shapes: [string, string][] = [
    ['ghp_', 'gh' + 'p_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'],
    ['gho_', 'gh' + 'o_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'],
    ['ghs_', 'gh' + 's_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'],
    ['ghu_', 'gh' + 'u_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'],
    ['github_pat_', 'github' + '_pat_11ABCDEFG0_abcdefGHIJKLmnopQRSTuv0123456789'],
    ['omk_', 'omk_live-9f8e7d6c5b4a'],
    ['sk-', 'sk-or-v1-0123456789abcdef'],
  ];

  for (const [shape, token] of shapes) {
    it(`masks a ${shape} token in an error's message`, () => {
      const { logger, lines, parsed } = harness();
      logger.error({ event: 'webhook', outcome: 'failed', ms: 1, error: new Error(`request failed with ${token}, retry`) });
      expect(lines[0]).not.toContain(token);
      expect((parsed()[0]?.error as { message: string }).message).toBe('request failed with ***, retry');
    });
  }

  it('masks a Bearer value', () => {
    const { logger, lines, parsed } = harness();
    logger.error({ event: 'webhook', outcome: 'failed', ms: 1, error: new Error('Authorization: Bearer abc.def-ghi refused') });
    expect(lines[0]).not.toContain('abc.def-ghi');
    expect((parsed()[0]?.error as { message: string }).message).toBe('Authorization: Bearer *** refused');
  });

  it('masks a bearer value whatever its case', () => {
    const { logger, lines } = harness();
    logger.error({ event: 'webhook', outcome: 'failed', ms: 1, error: new Error('bearer s3cr3tvalue') });
    expect(lines[0]).not.toContain('s3cr3tvalue');
  });

  for (const name of ['api_key', 'access_token', 'client_secret', 'code', 'X-Amz-Signature', 'KEY']) {
    it(`masks the ${name} query parameter of a URL`, () => {
      const { logger, lines, parsed } = harness();
      logger.error({
        event: 'webhook',
        outcome: 'failed',
        ms: 1,
        error: new Error(`fetch https://api.example.com/x?page=2&${name}=Zq9Vw8Ux7&sort=asc failed`),
      });
      expect(lines[0]).not.toContain('Zq9Vw8Ux7');
      expect((parsed()[0]?.error as { message: string }).message).toBe(
        `fetch https://api.example.com/x?page=2&${name}=***&sort=asc failed`,
      );
    });
  }

  it('leaves a query parameter named otherwise alone', () => {
    const { logger, parsed } = harness();
    logger.error({ event: 'webhook', outcome: 'failed', ms: 1, error: new Error('GET /x?page=2&sort=asc') });
    expect((parsed()[0]?.error as { message: string }).message).toBe('GET /x?page=2&sort=asc');
  });

  it('leaves words that only contain a prefix alone', () => {
    const { logger, parsed } = harness();
    logger.warn({ event: 'webhook', outcome: 'ok', ms: 1, message: 'task-force and desk-top' });
    expect(parsed()[0]?.message).toBe('task-force and desk-top');
  });

  it('masks a token in the message field and in a URL kept in any string field', () => {
    const { logger, lines } = harness();
    logger.warn({
      event: 'webhook',
      outcome: 'failed',
      ms: 1,
      message: 'push with gh' + 'p_A1b2C3d4E5f6G7h8I9j0 failed',
      repo: 'https://x.test/?token=Zq9Vw8Ux7',
    });
    expect(lines[0]).not.toContain('gh' + 'p_A1b2C3d4E5f6G7h8I9j0');
    expect(lines[0]).not.toContain('Zq9Vw8Ux7');
  });

  it('masks before it cuts, so no token survives across the cut', () => {
    const { logger, lines } = harness();
    const token = 'gh' + 'p_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
    logger.error({ event: 'webhook', outcome: 'failed', ms: 1, error: new Error(`${'x'.repeat(490)}${token}`) });
    expect(lines[0]).not.toContain('ghp_A1');
  });
});

describe('it never throws', () => {
  it('swallows a circular value', () => {
    const { logger, parsed } = harness();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => {
      logger.info({ event: 'webhook', outcome: 'ok', ms: 1, ...({ repo: circular } as object) });
    }).not.toThrow();
    expect(parsed()[0]?.event).toBe('webhook');
  });

  it('swallows an error whose message getter throws', () => {
    const { logger } = harness();
    const error = new Error('x');
    Object.defineProperty(error, 'message', {
      get() {
        throw new Error('no');
      },
    });
    expect(() => {
      logger.error({ event: 'webhook', outcome: 'failed', ms: 1, error });
    }).not.toThrow();
  });

  it('swallows a throwing sink', () => {
    const logger = createLogger({
      sink: () => {
        throw new Error('stdout closed');
      },
    });
    expect(() => {
      logger.info({ event: 'webhook', outcome: 'ok', ms: 1 });
    }).not.toThrow();
  });

  it('swallows a throwing clock', () => {
    const logger = createLogger({
      sink: () => undefined,
      clock: () => {
        throw new Error('no clock');
      },
    });
    expect(() => logger.timer()()).not.toThrow();
  });

  it('swallows fields that are not an object', () => {
    const { logger } = harness();
    expect(() => {
      logger.info(null as never);
    }).not.toThrow();
  });
});

describe('the default logger', () => {
  it('writes one line and its newline to stdout', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      log.warn({ event: 'webhook', outcome: 'refused', ms: 3, status: 401 });
      expect(write).toHaveBeenCalledTimes(1);
      expect(write.mock.calls[0]?.[0]).toBe('{"level":"warn","event":"webhook","outcome":"refused","ms":3,"status":401}\n');
    } finally {
      write.mockRestore();
    }
  });

  it('times on the real clock', () => {
    expect(log.timer()()).toBeGreaterThanOrEqual(0);
  });
});

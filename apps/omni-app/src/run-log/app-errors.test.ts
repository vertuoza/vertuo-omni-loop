// The App keeps its own 5xx, masked (PRD omni-loop-34 s2, spec "3. The error table", AC-9, the omni-app's half).
import { describe, expect, it } from 'vitest';
import { capture } from './capture.ts';
import { appErrorRow, installedAppErrors, recordAppError, recordAppErrorsTo, type AppError } from './app-errors.ts';
import { loggedHandler } from './run-log.ts';

const token = () => `ghp_${'a'.repeat(36)}`;

function sink() {
  const rows: ReturnType<typeof appErrorRow>[] = [];
  return { rows, write: (error: AppError) => { rows.push(appErrorRow(error)); return Promise.resolve(); } };
}

describe('loggedHandler — a 5xx writes one masked app_errors row', () => {
  it('AC-9: a route answering 500 with a message holding a token writes one row with the route and status, the token masked', async () => {
    const { logger } = capture();
    const { rows, write } = sink();
    const secret = token();
    const handler = loggedHandler(logger, 'jobs-sweep', () => Response.json({ error: `GitHub refused ${secret}` }, { status: 500 }), () => write);
    const answer = await handler(new Request('https://app.example/api/jobs-sweep?gaps=1'));
    expect(answer.status).toBe(500);
    expect(await answer.json()).toEqual({ error: `GitHub refused ${secret}` });
    expect(rows).toEqual([{ service: 'omni-app', route: '/api/jobs-sweep', status: 500, message: '{"error":"GitHub refused [masked]"}', workspace_id: null }]);
  });

  it('a throw writes one 500 row, masked, and is rethrown unchanged', async () => {
    const { logger } = capture();
    const { rows, write } = sink();
    const thrown = new Error(`Bearer ${'x'.repeat(30)} expired`);
    const handler = loggedHandler(logger, 'github', () => Promise.reject(thrown), () => write);
    await expect(handler(new Request('https://app.example/api/github'))).rejects.toBe(thrown);
    expect(rows).toEqual([{ service: 'omni-app', route: '/api/github', status: 500, message: 'Bearer [masked] expired', workspace_id: null }]);
  });

  it('a 2xx or a 4xx writes nothing, and a sink that throws changes no answer', async () => {
    const { logger } = capture();
    const { rows, write } = sink();
    expect((await loggedHandler(logger, 'e', () => new Response('ok'), () => write)(new Request('https://app.example/a'))).status).toBe(200);
    expect((await loggedHandler(logger, 'e', () => new Response('no', { status: 401 }), () => write)(new Request('https://app.example/a'))).status).toBe(401);
    expect(rows).toEqual([]);
    const broken = () => Promise.reject(new Error('the database refused'));
    expect((await loggedHandler(logger, 'e', () => new Response('down', { status: 503 }), () => broken)(new Request('https://app.example/a'))).status).toBe(503);
  });

  it('writes through the installed sink when none is given, and nothing when none is installed', async () => {
    const { logger } = capture();
    const { rows, write } = sink();
    const handler = loggedHandler(logger, 'e', () => new Response('down', { status: 502 }));
    await handler(new Request('https://app.example/b'));
    expect(rows).toEqual([]);
    recordAppErrorsTo(write);
    try {
      expect(installedAppErrors()).toBe(write);
      await handler(new Request('https://app.example/b'));
    } finally {
      recordAppErrorsTo(null);
    }
    expect(rows.map((row) => [row.route, row.status, row.message])).toEqual([['/b', 502, 'down']]);
  });
});

describe('appErrorRow — the row as written', () => {
  it('keeps the message on one line, at most 500 characters, and the route at most 200, the status within 5xx', () => {
    const row = appErrorRow({ route: `/a\n${'r'.repeat(300)}`, status: 600, message: `line one\nline two ${'m'.repeat(600)}`, workspace: '11111111-1111-4111-8111-111111111111' });
    expect(row.route).toHaveLength(200);
    expect(row.route).not.toMatch(/\n/);
    expect(row.message).toHaveLength(500);
    expect(row.message.startsWith('line one line two')).toBe(true);
    expect(row.status).toBe(599);
    expect(row.workspace_id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('recordAppError with no sink does nothing', async () => {
    await expect(recordAppError({ route: '/a', status: 500, message: '' }, null)).resolves.toBeUndefined();
  });
});

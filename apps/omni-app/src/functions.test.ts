import { InngestTestEngine } from '@inngest/test';
import { internalEvents } from 'inngest';
import { describe, expect, it } from 'vitest';
import { readEnv } from './env.ts';
import { appFunctions } from './functions.ts';
import { capture, throwing } from './run-log/capture.ts';

/** A GitHub that is never reached: every installation call throws. */
const octokitFor = () => {
  throw new Error('no GitHub here');
};

const ids = {
  outboxCheck: 'outbox-check',
  inboxCheck: 'inbox-check',
  approvedCheck: 'approved-check',
  approvedRerun: 'approved-rerun',
  retro: 'retro',
  knowledgeHarvest: 'knowledge-harvest',
  prStats: 'pr-stats',
  canonAction: 'canon-action',
  serverEvent: 'server-event',
  budgetsCheck: 'budgets-check',
  escalation: 'escalation',
  fixRowStamp: 'fix-row-stamp',
  knowledgePack: 'knowledge-pack',
  mainWatch: 'main-watch',
  fleetBoard: 'fleet-board',
};

type Fn = ReturnType<typeof appFunctions>[keyof ReturnType<typeof appFunctions>];

/** The event that starts `fn`: its first trigger's, with data none of them accepts, or the cron's tick. */
function startOf(fn: Fn) {
  const [trigger] = fn.opts.triggers ?? [];
  if (trigger && 'event' in trigger) return { name: trigger.event, data: {} };
  return { name: internalEvents.ScheduledTimer, data: { cron: trigger && 'cron' in trigger ? trigger.cron : '' } };
}

describe('appFunctions — one inngest line per run (PRD 1723 s6)', () => {
  it('serves the fifteen functions by these ids', () => {
    const functions = appFunctions(readEnv({}), { octokitFor });
    expect(Object.fromEntries(Object.entries(functions).map(([name, fn]) => [name, fn.opts.id]))).toEqual(ids);
  });

  for (const [name, id] of Object.entries(ids)) {
    it(`${name}: a run logs exactly one inngest line, its id in fn, the run id, ok or failed as it ended`, async () => {
      const log = capture();
      const fn = appFunctions(readEnv({}), { octokitFor, logger: log.logger })[name as keyof typeof ids];
      const { error } = await new InngestTestEngine({ function: fn, events: [startOf(fn) as never] }).execute();
      const lines = log.lines().filter((line) => line.event === 'inngest');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ event: 'inngest', fn: id, outcome: error === undefined ? 'ok' : 'failed' });
      expect(typeof lines[0]?.runId).toBe('string');
      expect(typeof lines[0]?.ms).toBe('number');
    });
  }

  it('a failure handler’s run logs its own line, and fails or ends exactly as it did', async () => {
    const functions = appFunctions(readEnv({}), { octokitFor });
    const withFailure = Object.entries(functions).filter(([, fn]) => typeof fn.opts.onFailure === 'function');
    expect(withFailure.map(([name]) => name).sort()).toEqual(['budgetsCheck', 'inboxCheck', 'knowledgeHarvest', 'outboxCheck', 'retro']);
    for (const [name] of withFailure) {
      const log = capture();
      const fn = appFunctions(readEnv({}), { octokitFor, logger: log.logger })[name as keyof typeof ids];
      const onFailure = fn.opts.onFailure as unknown as (ctx: object) => Promise<unknown>;
      const ctx = { runId: 'run-1', event: { data: { event: { data: {} }, error: { message: 'final' } } }, error: new Error('final'), step: { run: (_: string, work: () => unknown) => work() } };
      const ended = await onFailure(ctx).then(() => 'ok', () => 'failed');
      expect(log.lines()).toEqual([expect.objectContaining({ event: 'inngest', fn: `${ids[name as keyof typeof ids]}-failure`, runId: 'run-1', outcome: ended })]);
    }
  });

  it('keeps every function’s retries and failure handler as created', () => {
    const plain = appFunctions(readEnv({}), { octokitFor });
    const logged = appFunctions(readEnv({}), { octokitFor, logger: throwing });
    for (const name of Object.keys(ids) as (keyof typeof ids)[]) {
      const { retries, triggers } = plain[name].opts;
      expect(logged[name].opts).toMatchObject({ retries, triggers });
      expect(typeof logged[name].opts.onFailure).toBe(typeof plain[name].opts.onFailure);
    }
  });

  it('a logger that throws changes no run’s result or error', async () => {
    for (const name of Object.keys(ids) as (keyof typeof ids)[]) {
      const plain = appFunctions(readEnv({}), { octokitFor })[name];
      const logged = appFunctions(readEnv({}), { octokitFor, logger: throwing })[name];
      const a = await new InngestTestEngine({ function: plain, events: [startOf(plain) as never] }).execute();
      const b = await new InngestTestEngine({ function: logged, events: [startOf(logged) as never] }).execute();
      expect([b.result, (b.error as Error | undefined)?.message]).toEqual([a.result, (a.error as Error | undefined)?.message]);
    }
  });
});

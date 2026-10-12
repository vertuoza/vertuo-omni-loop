// A stubbed Supabase client for the loops' tests: the loops, loop_ticks and loop_plans tables in
// memory, the Auth server's token check, and loop_push() of
// supabase/migrations/20261108090000_loops.sql written here as the migration writes it:
//
// - start: refused 42501 for a caller with no workspace (the fake's repo_workspace(): the member
//   workspace whose GitHub org owns the repository, else the one joined first); refused 55000 while
//   the caller runs a loop on the repository, naming it, unless it is silent and `takeOver` is sent,
//   which stops it; plan version 1 comes with it;
// - tick, park, stop: refused P0002 for no such loop, 42501 for another account's, 55000 for one that
//   stopped. A tick appends to the ledger, with the repositories it touched in lower case (PRD 1162),
//   moves the next wake, takes its PRD out of the parked ones and, with `replan`, adds the next plan
//   version; park records a PRD, replacing one of the same number; stop ends the loop parked when
//   PRDs still wait, else stopped.
//
// The body is trusted: the route validated it, and the database's own checks are proved by
// supabase/checks/loops.sql, not here. Reading runs under the migration's policies: a member of the
// loop's workspace reads it, its ticks and its plans.
import { parsePr, parsePrd, parseOutboxItemId, type OutboxItemId, type PrdNumber, type PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { fakeClient, fakeRecorder, listOf, objectOf, placeRepo, refused, tableQuery, textOf, type FakeAccount, type FakeResult as Result } from '../data/repo-tables.fake';
import { loopState } from './state';

export type { FakeAccount } from '../data/repo-tables.fake';

type Row = Record<string, unknown>;

type Parked = { prd: PrdNumber; who: string; what: string; link: string | null; at: string };

type FakeLoop = {
  id: string; user_id: string; workspace_id: string; repo: string; prds: PrdNumber[]; state: 'running' | 'parked' | 'stopped';
  parked: Parked[]; started_at: string; seen_at: string; last_tick_at: string | null; next_wake_at: string | null; stopped_at: string | null;
};
type FakeTick = {
  id: number; loop_id: string; at: string; step: number; steps: number; prd: PrdNumber; action: string; result: string;
  link: string | null; merged: PrNumber[]; items: OutboxItemId[]; next_wake_at: string | null; repos: string[];
};
type FakePlan = { loop_id: string; version: number; reason: string; plan: unknown; created_at: string };

const numberOf = (value: unknown) => (typeof value === 'number' ? value : 0);

/**
 * `accounts`: token → account. `orgs`: workspace id → the GitHub org it owns. `now`: the clock, in ms.
 */
export function fakeLoops(accounts: Record<string, FakeAccount>, orgs: Record<string, string>, now: () => number) {
  const tables: { loops: FakeLoop[]; loop_ticks: FakeTick[]; loop_plans: FakePlan[] } = { loops: [], loop_ticks: [], loop_plans: [] };
  const { calls, at, newId } = fakeRecorder(now);

  const latestVersion = (loopId: string) => Math.max(...tables.loop_plans.filter((p) => p.loop_id === loopId).map((p) => p.version));
  const answer = (loop: FakeLoop): Result => ({ data: { loopId: loop.id, state: loop.state, planVersion: latestVersion(loop.id) }, error: null });

  function start(me: FakeAccount, body: Row): Result {
    const placed = placeRepo(me, body.repo, Object.keys(orgs), (workspace) => orgs[workspace]);
    if ('refusal' in placed) return placed.refusal;
    const { repo, workspace } = placed;
    const running = tables.loops.find((l) => l.user_id === me.id && l.repo === repo && l.state === 'running');
    if (running) {
      if (loopState(running, now()) !== 'silent') return refused('55000', `A loop already runs on ${repo}: ${running.id}. Stop it first.`);
      if (body.takeOver !== true) return refused('55000', `A silent loop is still open on ${repo}: ${running.id}. Take it over to start another.`);
      Object.assign(running, { state: 'stopped', stopped_at: at(), seen_at: at() });
    }
    const loop: FakeLoop = {
      id: newId(), user_id: me.id, workspace_id: workspace, repo, prds: listOf(body.prds).map((n) => parsePrd(numberOf(n))), state: 'running', parked: [],
      started_at: at(), seen_at: at(), last_tick_at: null, next_wake_at: null, stopped_at: null,
    };
    tables.loops.push(loop);
    tables.loop_plans.push({ loop_id: loop.id, version: 1, reason: textOf(body.reason)?.trim() || 'the first plan', plan: body.plan, created_at: at() });
    return answer(loop);
  }

  function tick(loop: FakeLoop, body: Row) {
    const replan = objectOf(body.replan);
    if (body.replan) {
      tables.loop_plans.push({ loop_id: loop.id, version: latestVersion(loop.id) + 1, reason: String(replan.reason).trim(), plan: replan.plan, created_at: at() });
    }
    const prd = parsePrd(numberOf(body.prd));
    const nextWakeAt = textOf(body.nextWakeAt);
    const nextWake = nextWakeAt === null ? null : new Date(nextWakeAt).toISOString();
    tables.loop_ticks.push({
      id: tables.loop_ticks.length + 1, loop_id: loop.id, at: at(), step: numberOf(body.step), steps: numberOf(body.steps), prd,
      action: String(body.action), result: String(body.result), link: textOf(body.link), merged: listOf(body.merged).map((n) => parsePr(numberOf(n))),
      items: listOf(body.items).map((id) => parseOutboxItemId(String(id))), next_wake_at: nextWake,
      repos: listOf(body.repos).map((r) => String(r).toLowerCase()),
    });
    Object.assign(loop, { last_tick_at: at(), seen_at: at(), next_wake_at: nextWake, parked: loop.parked.filter((p) => p.prd !== prd) });
  }

  function park(loop: FakeLoop, body: Row) {
    const prd = parsePrd(numberOf(body.prd));
    const parked = { prd, who: String(body.who).trim(), what: String(body.what).trim(), link: textOf(body.link), at: at() };
    Object.assign(loop, { seen_at: at(), parked: [...loop.parked.filter((p) => p.prd !== prd), parked] });
  }

  function loopPush(me: FakeAccount | null, args: Row): Result {
    calls.push({ fn: 'loop_push', args });
    if (!me) return refused('42501', 'Sign in first.');
    const body = objectOf(args.p_body);
    if (args.p_event === 'start') return start(me, body);
    const loop = tables.loops.find((l) => l.id === args.p_loop);
    if (!loop) return refused('P0002', `No loop ${String(args.p_loop)}.`);
    if (loop.user_id !== me.id) return refused('42501', 'This loop is another account\'s.');
    if (loop.state !== 'running') return refused('55000', 'This loop has stopped: start a new one.');
    if (args.p_event === 'tick') tick(loop, body);
    else if (args.p_event === 'park') park(loop, body);
    else Object.assign(loop, { state: loop.parked.length > 0 ? 'parked' : 'stopped', stopped_at: at(), seen_at: at(), next_wake_at: null });
    return answer(loop);
  }

  /** The reads of a caller, under the policies: only rows of their workspaces' loops. */
  const reads = (mine: (workspace: string) => boolean) => {
    const loopIsMine = (loopId: string) => tables.loops.some((l) => l.id === loopId && mine(l.workspace_id));
    return (table: string) => {
      if (table === 'loops') return tableQuery(tables.loops, (l) => mine(l.workspace_id));
      if (table === 'loop_ticks') return tableQuery(tables.loop_ticks, (t) => loopIsMine(t.loop_id));
      if (table === 'loop_plans') return tableQuery(tables.loop_plans, (p) => loopIsMine(p.loop_id));
      throw new Error(`the fake reads no ${table}`);
    };
  };
  const client = (token: string) => fakeClient(accounts, token, { fn: 'loop_push', call: loopPush, reads });

  return { tables, calls, client };
}

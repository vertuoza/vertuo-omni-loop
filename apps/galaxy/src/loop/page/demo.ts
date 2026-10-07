// The demo's loops (PRD 1139 s5), for development and OMNI_LOOP_DEMO=1: one loop in each state, the
// first sleeping between ticks with two plan versions (PRD 1017 waits on PRD 1030, both touching the
// sidebar, and a stuck slice moved it up), its ledger and a parked PRD on the second. Every time is
// counted back from `now`, so the same `now` draws the same page.
import { parseOutboxItemId, parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { RosterRow } from '../../people/load';
import { detailOf, runnersOf, summaryOf, type LoopPageView } from './model';
import type { LoopRow, PlanRow, TickRow } from './rows';

const MIN = 60_000;
const DEMO_NAME = 'Acme';

const ROSTER: RosterRow[] = [
  { user_id: 'demo-ada', name: 'Ada', github_login: 'ada', avatar_url: null, fleet: 'comets', hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } },
  { user_id: 'demo-dora', name: 'Dora', github_login: 'dora', avatar_url: null, fleet: null, hero: { v: 1, body: 'boy', skin: 2, hair: 1, suit: 1, cape: 0 } },
  { user_id: 'demo-bob', name: 'Bob', github_login: 'bob', avatar_url: null, fleet: null },
  { user_id: 'demo-carl', name: 'Carl', github_login: 'carl', avatar_url: null, fleet: null },
  { user_id: 'demo-eli', name: 'Eli', github_login: 'eli', avatar_url: null, fleet: null },
];

/** The demo loop that is opened by default: sleeping, with two plan versions and a ledger. */
export const DEMO_LOOP = '0b7c6a2e-1f00-4d6a-9c55-2f1f3e4a5b6c';

const prd = parsePrd;

function rowsAt(now: number) {
  const at = (minutes: number) => new Date(now + minutes * MIN).toISOString();
  const loop = (over: Partial<LoopRow> & Pick<LoopRow, 'id' | 'user_id' | 'repo' | 'prds'>): LoopRow => ({
    workspace_id: 'demo', state: 'running', parked: [], started_at: at(-90), seen_at: at(-4), last_tick_at: at(-4), next_wake_at: null, stopped_at: null, ...over,
  });
  const loops: LoopRow[] = [
    loop({ id: DEMO_LOOP, user_id: 'demo-ada', repo: 'acme/widgets', prds: [prd(1030), prd(1017), prd(971)], next_wake_at: at(7) }),
    loop({
      id: '5d1e0c3a-7b2f-4e8a-b1c9-0a2b3c4d5e6f', user_id: 'demo-dora', repo: 'acme/mobile', prds: [prd(1101)], state: 'parked', stopped_at: at(-12),
      parked: [{ prd: prd(1101), who: 'the PM', what: 'answers to 2 outbox questions', link: 'https://github.com/acme/mobile/pull/1102', at: at(-12) }],
    }),
    loop({ id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', user_id: 'demo-bob', repo: 'acme/api', prds: [prd(880)], seen_at: at(-37), last_tick_at: at(-37), next_wake_at: at(-35) }),
    loop({ id: '1f2e3d4c-5b6a-4978-8a6b-5c4d3e2f1a0b', user_id: 'demo-carl', repo: 'acme/gears', prds: [prd(990)], next_wake_at: at(-1) }),
    loop({ id: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f', user_id: 'demo-eli', repo: 'acme/gears', prds: [prd(940)], state: 'stopped', stopped_at: at(-300), seen_at: at(-300), last_tick_at: at(-300) }),
  ];
  // The shape `omni next --plan` writes (kit/lib/next/plan.ts' Step).
  const step = (n: number, p: number, kind: string, over: Record<string, unknown> = {}) => ({ step: n, prd: p, kind, wave: null, slices: [], after: [], waitsFor: [], why: [], beside: [], ...over });
  const NAV = '1017 s2 after 1030 s3: both touch apps/galaxy/src/nav/';
  // Both versions share their first three steps; v2 moves PRD 1017 ahead of PRD 1030's s4.
  const head = [
    step(1, 971, 'finish'),
    step(2, 1030, 'wave', { wave: 1, slices: ['s1'], beside: [1] }),
    step(3, 1030, 'wave', { wave: 2, slices: ['s3'], after: [2] }),
  ];
  const s4of1030 = (n: number) => step(n, 1030, 'wave', { wave: 3, slices: ['s4'], after: [3] });
  const s2of1017 = (n: number) => step(n, 1017, 'wave', { wave: 1, slices: ['s2'], after: [3], why: [NAV] });
  const s3of1017 = (n: number) => step(n, 1017, 'wave', { wave: 2, slices: ['s3'], after: [n - 1] });
  const v1 = { version: 1, reason: null, prds: [971, 1030, 1017], steps: [...head, s4of1030(4), s2of1017(5), s3of1017(6)] };
  const v2 = { version: 2, reason: 's4 of PRD 1030 stuck → PRD 1017 moves up', prds: [971, 1030, 1017], steps: [...head, s2of1017(4), s3of1017(5), s4of1030(6)] };
  const plans: PlanRow[] = [
    { loop_id: DEMO_LOOP, version: 1, reason: 'first plan', plan: v1, created_at: at(-90) },
    { loop_id: DEMO_LOOP, version: 2, reason: 's4 of PRD 1030 stuck → PRD 1017 moves up', plan: v2, created_at: at(-20) },
  ];
  const tick = (id: number, minutes: number, n: number, p: number, action: string, result: string, over: Partial<TickRow> = {}): TickRow => ({
    id, loop_id: DEMO_LOOP, at: at(minutes), step: n, steps: 6, prd: prd(p), action, result, link: `https://github.com/acme/widgets/pull/${p + 1}`,
    merged: [], items: [], next_wake_at: at(minutes + 2), ...over,
  });
  const ticks: TickRow[] = [
    tick(1, -88, 1, 971, 'pr-care', '2 threads fixed'),
    tick(2, -60, 2, 1030, 'wave', '3 sub-PRs merged, 2 outbox items', { merged: [parsePr(1041), parsePr(1042), parsePr(1043)], items: [parseOutboxItemId('s1-01-sort-order'), parseOutboxItemId('s1-02-empty-state')] }),
    tick(3, -4, 3, 1030, 'wait', 'CI running on #1031', { next_wake_at: at(7) }),
  ];
  return { loops, plans, ticks };
}

/** The demo's Loop page: the list, or the loop `id` opened; null for an id it does not hold. */
export function demoLoopPage(now: Date, id: string | null = null): LoopPageView | null {
  const { loops, plans, ticks } = rowsAt(now.getTime());
  const runners = runnersOf(ROSTER);
  if (id === null) return { kind: 'list', name: DEMO_NAME, loops: loops.map((l) => summaryOf(l, runners, now.getTime())) };
  const row = loops.find((l) => l.id === id);
  if (!row) return null;
  const mine = (r: { loop_id: string }) => r.loop_id === row.id;
  return { kind: 'loop', name: DEMO_NAME, loop: detailOf(row, ticks.filter(mine), plans.filter(mine), runners, now.getTime()) };
}

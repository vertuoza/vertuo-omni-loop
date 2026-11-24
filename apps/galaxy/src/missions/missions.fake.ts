import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
import type { MissionStatus, RetroRead } from './missions.contract';
import type { MissionJob, MissionRecord, MissionsReader, MissionsWriter } from './missions.repository';

// The missions' database in memory (PRD 2842 s5), for the service's and the controller's tests: the rows
// of `missions` and `mission_events`, the App's job ledger as far as a refresh goes, and who may see what.
// Northwind's members Ada and Ben see its missions; Dan, of another workspace, sees none.

const NORTHWIND = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
export const DRAFT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const RUNNING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const PAUSED = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const DELIVERED = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export const STOP = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
export const STUCK = '99999999-9999-4999-8999-999999999999';
export const ITEM = '88888888-8888-4888-8888-888888888888';
export const ELSEWHERE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

export const ADA = { id: '00000000-0000-4000-8000-00000000ada0', login: 'ada' };
export const BEN = { id: '00000000-0000-4000-8000-0000000000be', login: 'ben' };
export const DAN = { id: '00000000-0000-4000-8000-0000000000da', login: 'dan' };

type Event = { mission: string; kind: string; actor: string; sentence: string; at: string; prd?: PrdNumber; job?: string };

/** The database's refusal of an answer to a stop (supabase/checks/token_budget.sql), or null: answered once, tomorrow for a fleet's cap, a raise an owner's and above the cap reached. */
function answerRefusal(stop: { cap: string; capTokens: number; answer: string | null }, answer: string, tokens: number | null, owner: boolean): { code: string; error: string } | null {
  if (stop.answer !== null) return { code: '22023', error: `Answer: this stop was answered already (${stop.answer}).` };
  if (answer === 'tomorrow' && stop.cap !== 'fleet') return { code: '22023', error: 'Answer: Resume tomorrow is for a fleet\'s daily cap.' };
  if (answer !== 'raised') return null;
  if (!owner) return { code: '42501', error: 'Only an owner of the workspace raises a cap.' };
  return tokens === null || tokens <= stop.capTokens ? { code: '22023', error: `Tokens: a whole number above the cap reached (${String(stop.capTokens)}).` } : null;
}

export function fakeMissionsDb(options: { refusesRefresh?: boolean; owners?: readonly string[]; fleetLevel?: MissionLevel; territories?: Record<number, string[]>; planRepos?: readonly string[]; stuck?: boolean } = {}) {
  const missions = new Map<string, MissionRecord & { startedBy: string | null; nextWakeAt: string | null; waitingOn: string | null }>();
  let numbered = 40;
  const add = (id: string, status: MissionStatus, workspace = NORTHWIND, repo = 'acme/shop', pausedBy: 'stuck' | null = null) => missions.set(id, { id, workspace, repo, status, number: (numbered += 1), title: 'Pay online', level: 'with-you', pausedBy, startedBy: null, nextWakeAt: null, waitingOn: null });
  add(DRAFT, 'draft');
  add(RUNNING, 'running');
  add(PAUSED, 'paused');
  add(DELIVERED, 'delivered');
  add(ELSEWHERE, 'running', OTHER, 'other/repo');
  // A mission the supervisor paused by stuck, with one open question of its own outbox (PRD 3065): only when asked, so the other tests keep their missions.
  if (options.stuck) add(STUCK, 'paused', NORTHWIND, 'acme/stuck', 'stuck');
  const events: Event[] = [];
  // The budget stops, as mission_budget_stops holds them: one fleet stop that paused PAUSED and RUNNING, waiting for its answer.
  const stops = new Map<string, { id: string; workspace: string; cap: 'mission' | 'fleet'; capTokens: number; mission: string | null; missions: string[]; answer: string | null }>([
    [STOP, { id: STOP, workspace: NORTHWIND, cap: 'fleet', capTokens: 1000, mission: null, missions: [PAUSED, RUNNING], answer: null }],
  ]);
  // The mission items, as mission_items holds them: one question of the stuck mission, open.
  const items = new Map<string, { id: string; mission: string; target: string; answer: 'adopted' | 'declined' | null; note: string | null }>([
    [ITEM, { id: ITEM, mission: STUCK, target: 'the Roadmap form: Prerequisites', answer: null, note: null }],
  ]);
  const jobs: MissionJob[] = [];
  // What each mission's page holds (PRD 3194): its latest mission.md and mission.html, its retros with their items, and the PRDs its brief names.
  const pages = new Map<string, { record: string; brief: string }>();
  const retros = new Map<string, RetroRead[]>();
  const scopes = new Map<string, number[]>();
  const onBranchOf = (id: string): Promise<PrdNumber[]> => {
    const on = new Set<PrdNumber>();
    for (const event of events) {
      if (event.mission !== id || event.prd === undefined) continue;
      if (event.kind === 'prd-joined') on.add(event.prd);
      else if (event.kind === 'prd-dropped' || event.kind === 'landed' || event.kind === 'prd-merged') on.delete(event.prd);
    }
    return Promise.resolve([...on]);
  };
  const members = new Map([[ADA.id, [NORTHWIND]], [BEN.id, [NORTHWIND]], [DAN.id, [OTHER]]]);

  const record = (row: (typeof missions extends Map<string, infer R> ? R : never) | undefined): MissionRecord | null =>
    (row ? { id: row.id, workspace: row.workspace, repo: row.repo, status: row.status, number: row.number, title: row.title, level: row.level, pausedBy: row.status === 'paused' ? row.pausedBy : null, waitingOn: row.waitingOn } : null);
  const writer: MissionsWriter = {
    mission: (id) => Promise.resolve(record(missions.get(id))),
    watching: (repo) => Promise.resolve([...missions.values()].filter((m) => m.repo === repo && ['running', 'waiting', 'paused'].includes(m.status)).map((m) => record(m)).filter((m): m is MissionRecord => m !== null)),
    move: (id, from, to, change) => {
      const row = missions.get(id);
      if (!row || !from.includes(row.status)) return Promise.resolve(false);
      missions.set(id, { ...row, status: to, nextWakeAt: change.at, startedBy: change.startedBy ?? row.startedBy, waitingOn: change.waitingOn ?? row.waitingOn });
      return Promise.resolve(true);
    },
    event: (id, event) => {
      events.push({ mission: id, ...event });
      return Promise.resolve();
    },
    refresh: (job) => {
      if (options.refusesRefresh) return Promise.reject(new Error('Supabase: could not refresh the mission\'s job (boom)'));
      jobs.push(job);
      return Promise.resolve();
    },
  };
  return {
    missions,
    stops,
    items,
    events,
    jobs,
    pages,
    retros,
    scopes,
    writer,
    /** The missions as `person` reads them: their workspaces' alone (row-level security). */
    reader(person: { id: string }): MissionsReader {
      const sees = (id: string) => members.get(person.id)?.includes(missions.get(id)?.workspace ?? '') === true;
      const rank = (level: MissionLevel) => ['with-you', 'own-branch', 'alone'].indexOf(level);
      return {
        mission: (id) => Promise.resolve(sees(id) ? record(missions.get(id)) : null),
        inPlan: (mission) => Promise.resolve((options.planRepos ?? []).includes(mission.repo)),
        onBranch: onBranchOf,
        decisionEvents: (id) => Promise.resolve(events.filter((event) => event.mission === id && (event.kind === 'decided' || event.kind === 'overturned')).map(({ kind, prd, sentence, actor }) => ({ kind, prd: prd ?? null, sentence, link: null, actor }))),
        bugsToDecide: (id, prd) => {
          const rows = events.filter((event) => event.mission === id && event.prd === prd && event.job !== undefined && ['checked', 'resumed', 'stopped'].includes(event.kind));
          const checked = rows.findLast((row) => row.kind === 'checked');
          if (checked?.job === undefined || !/Round 2 of 2/.test(checked.sentence) || /^pass/.test(checked.sentence)) return Promise.resolve(null);
          const pick = rows.find((row) => row.job === checked.job && row.kind !== 'checked');
          return Promise.resolve({ job: checked.job, picked: pick === undefined ? null : { pick: pick.kind === 'resumed' ? 'review' : 'stop', actor: pick.actor } });
        },
        joined: async (id) => (await onBranchOf(id)).length,
        byNumber: (repo, number) => {
          const row = [...missions.values()].find((one) => one.repo === repo.toLowerCase() && one.number === number);
          return Promise.resolve(row && sees(row.id) ? record(row) : null);
        },
        page: (mission) => Promise.resolve(sees(mission.id) ? pages.get(mission.id) ?? null : null),
        retros: (id) => Promise.resolve(sees(id) ? retros.get(id) ?? [] : []),
        ofPrd: (repo, prd) => Promise.resolve([...missions.values()].filter((row) => sees(row.id) && row.repo === repo.toLowerCase() && (scopes.get(row.id) ?? []).includes(prd)).map((row) => row.number).sort((a, b) => a - b)),
        territories: (_mission, prds) => Promise.resolve(new Map(prds.map((prd) => [prd, options.territories?.[prd] ?? null]))),
        // The database's rules, as supabase/checks/token_budget.sql proves them: any member sets a draft's budget, an owner alone one that
        // started; a stop is answered once, and an owner alone raises its cap, above the one reached.
        setTokens: (id, tokens) => {
          const row = missions.get(id);
          if (!row || !sees(id)) return Promise.resolve({ ok: false, code: '42501', error: 'Only a member of the mission\'s workspace sets its token budget.' });
          if (tokens !== null && (tokens < 1 || tokens > 1_000_000_000)) return Promise.resolve({ ok: false, code: '22023', error: 'Token budget: a whole number from 1 to 1000000000, or none for no budget.' });
          if (row.status !== 'draft' && !(options.owners ?? []).includes(person.id)) return Promise.resolve({ ok: false, code: '42501', error: 'Only an owner of the workspace changes the token budget of a mission that started.' });
          return Promise.resolve({ ok: true, tokens });
        },
        answerStop: (id, answer, tokens) => {
          const stop = stops.get(id);
          if (!stop || members.get(person.id)?.includes(stop.workspace) !== true) return Promise.resolve({ ok: false, code: '42501', error: 'Only a member of the workspace answers its budget stops.' });
          const refusal = answerRefusal(stop, answer, tokens, (options.owners ?? []).includes(person.id));
          if (refusal !== null) return Promise.resolve({ ok: false, ...refusal });
          stops.set(id, { ...stop, answer });
          return Promise.resolve({ ok: true, stop: { id, answer, raisedTo: answer === 'raised' ? tokens : null, mission: stop.mission, missions: stop.missions } });
        },
        // The database's rules, as supabase/checks/mission_retros.sql proves them: a member of the workspace answers an item, once.
        answerItem: (id, answer, note) => {
          const item = items.get(id);
          if (!item || !sees(item.mission)) return Promise.resolve({ ok: false, code: '42501', error: 'Only a member of the mission\'s workspace answers its questions.' });
          if (item.answer !== null) return Promise.resolve({ ok: false, code: '22023', error: `Answer: this question was answered already (${item.answer}).` });
          items.set(id, { ...item, answer, note });
          return Promise.resolve({ ok: true, item: { id, mission: item.mission, target: item.target, answer } });
        },
        // The database's rule, as supabase/checks/missions.sql proves it: only an owner takes a mission above its fleet's level.
        setLevel: (id, level) => {
          const row = missions.get(id);
          if (!row || !sees(id)) return Promise.resolve({ ok: false, forbidden: true, error: 'Only a member of the mission\'s workspace changes its level.' });
          if (rank(level) > rank(options.fleetLevel ?? 'with-you') && !(options.owners ?? []).includes(person.id)) {
            return Promise.resolve({ ok: false, forbidden: true, error: 'Only an owner of the workspace starts a mission above its fleet\'s level.' });
          }
          missions.set(id, { ...row, level });
          return Promise.resolve({ ok: true, level });
        },
      };
    },
  };
}

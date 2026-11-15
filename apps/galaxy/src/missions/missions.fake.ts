import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
import type { MissionStatus } from './missions.contract';
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
export const ELSEWHERE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

export const ADA = { id: '00000000-0000-4000-8000-00000000ada0', login: 'ada' };
export const BEN = { id: '00000000-0000-4000-8000-0000000000be', login: 'ben' };
export const DAN = { id: '00000000-0000-4000-8000-0000000000da', login: 'dan' };

type Event = { mission: string; kind: string; actor: string; sentence: string; at: string; prd?: PrdNumber };

export function fakeMissionsDb(options: { refusesRefresh?: boolean; owners?: readonly string[]; fleetLevel?: MissionLevel; territories?: Record<number, string[]> } = {}) {
  const missions = new Map<string, MissionRecord & { startedBy: string | null; nextWakeAt: string | null }>();
  let numbered = 40;
  const add = (id: string, status: MissionStatus, workspace = NORTHWIND, repo = 'acme/shop') => missions.set(id, { id, workspace, repo, status, number: (numbered += 1), title: 'Pay online', level: 'with-you', startedBy: null, nextWakeAt: null });
  add(DRAFT, 'draft');
  add(RUNNING, 'running');
  add(PAUSED, 'paused');
  add(DELIVERED, 'delivered');
  add(ELSEWHERE, 'running', OTHER, 'other/repo');
  const events: Event[] = [];
  const jobs: MissionJob[] = [];
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
    (row ? { id: row.id, workspace: row.workspace, repo: row.repo, status: row.status, number: row.number, title: row.title, level: row.level } : null);
  const writer: MissionsWriter = {
    mission: (id) => Promise.resolve(record(missions.get(id))),
    watching: (repo) => Promise.resolve([...missions.values()].filter((m) => m.repo === repo && ['running', 'waiting', 'paused'].includes(m.status)).map((m) => record(m)).filter((m): m is MissionRecord => m !== null)),
    move: (id, from, to, change) => {
      const row = missions.get(id);
      if (!row || !from.includes(row.status)) return Promise.resolve(false);
      missions.set(id, { ...row, status: to, nextWakeAt: change.at, startedBy: change.startedBy ?? row.startedBy });
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
    events,
    jobs,
    writer,
    /** The missions as `person` reads them: their workspaces' alone (row-level security). */
    reader(person: { id: string }): MissionsReader {
      const sees = (id: string) => members.get(person.id)?.includes(missions.get(id)?.workspace ?? '') === true;
      const rank = (level: MissionLevel) => ['with-you', 'own-branch', 'alone'].indexOf(level);
      return {
        mission: (id) => Promise.resolve(sees(id) ? record(missions.get(id)) : null),
        onBranch: onBranchOf,
        joined: async (id) => (await onBranchOf(id)).length,
        byNumber: (repo, number) => {
          const row = [...missions.values()].find((one) => one.repo === repo.toLowerCase() && one.number === number);
          return Promise.resolve(row && sees(row.id) ? record(row) : null);
        },
        territories: (_mission, prds) => Promise.resolve(new Map(prds.map((prd) => [prd, options.territories?.[prd] ?? null]))),
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

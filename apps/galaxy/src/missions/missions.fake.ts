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

type Event = { mission: string; kind: string; actor: string; sentence: string; at: string };

export function fakeMissionsDb(options: { refusesRefresh?: boolean } = {}) {
  const missions = new Map<string, MissionRecord & { startedBy: string | null; nextWakeAt: string | null }>();
  const add = (id: string, status: MissionStatus, workspace = NORTHWIND, repo = 'acme/shop') => missions.set(id, { id, workspace, repo, status, startedBy: null, nextWakeAt: null });
  add(DRAFT, 'draft');
  add(RUNNING, 'running');
  add(PAUSED, 'paused');
  add(DELIVERED, 'delivered');
  add(ELSEWHERE, 'running', OTHER, 'other/repo');
  const events: Event[] = [];
  const jobs: MissionJob[] = [];
  const members = new Map([[ADA.id, [NORTHWIND]], [BEN.id, [NORTHWIND]], [DAN.id, [OTHER]]]);

  const record = (row: (typeof missions extends Map<string, infer R> ? R : never) | undefined): MissionRecord | null => (row ? { id: row.id, workspace: row.workspace, repo: row.repo, status: row.status } : null);
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
      return { mission: (id) => Promise.resolve(members.get(person.id)?.includes(missions.get(id)?.workspace ?? '') ? record(missions.get(id)) : null) };
    },
  };
}

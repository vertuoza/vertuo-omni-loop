import { parseIssue } from 'omni-loop/kit/lib/ids.ts';
import type { MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
import { requestLine, type MadeRequest, type MissionRequest, type RequestBody } from './missions.contract';
import type { MakeRefusal, RequestsRepository } from './request.repository';

// The mission requests' database in memory (PRD omni-loop-24 s3), for the New mission box's service and routes: the rules of
// mission_request_make() as supabase/checks/missions.sql proves them, the requests kept and the runner jobs queued. Northwind:
// Ada owns it, Ben is a member; its fleet night-shift works with you, day-shift alone. night-shift's runner holds acme/shop
// (phase 0 on the server), day-shift's acme/shop and acme/docs; acme/plan keeps phase 0 on a pull request. Dan is of another
// workspace.

export const NORTHWIND = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
export const ADA = { id: '00000000-0000-4000-8000-00000000ada0', login: 'ada' };
export const BEN = { id: '00000000-0000-4000-8000-0000000000be', login: 'ben' };
export const DAN = { id: '00000000-0000-4000-8000-0000000000da', login: 'dan' };

type Kept = MissionRequest['request'] & { workspace: string; by: string; job: string };

export function fakeRequestsDb(options: { failing?: boolean } = {}) {
  const members = new Map<string, { workspace: string; owner: boolean }>([
    [ADA.id, { workspace: NORTHWIND, owner: true }], [BEN.id, { workspace: NORTHWIND, owner: false }], [DAN.id, { workspace: OTHER, owner: true }],
  ]);
  const logins = new Map([[ADA.id, ADA.login], [BEN.id, BEN.login], [DAN.id, DAN.login]]);
  const fleets = new Map<string, { level: MissionLevel; repos: string[] }>([
    ['night-shift', { level: 'with-you', repos: ['acme/shop'] }], ['day-shift', { level: 'alone', repos: ['acme/shop', 'acme/docs'] }],
  ]);
  const phase0 = new Map([['acme/shop', 'server'], ['acme/docs', 'server'], ['acme/plan', 'pr']]);
  const requests: Kept[] = [];
  const jobs: { id: string; line: string; repo: string; toFleet: string; sentBy: string }[] = [];
  let made = 0;

  const no = (code: string, hint: string | null, error: string): MakeRefusal => ({ ok: false, code, hint, error });

  /** mission_request_make()'s rules on who presses Start: a member of the workspace, on a fleet that is one, an owner below alone. */
  function whoRefusal(person: string, body: RequestBody): MakeRefusal | { repos: string[] } {
    const member = members.get(person);
    if (member?.workspace !== body.workspace) return no('42501', null, 'Only a member of the workspace starts its fleet\'s missions.');
    const fleet = fleets.get(body.fleet);
    if (fleet === undefined) return no('P0002', 'fleet', `Fleet: ${body.fleet} is no Virtual Fleet of this workspace.`);
    if (fleet.level !== 'alone' && !member.owner) return no('42501', 'level', 'A goal-only mission works alone: an owner starts it, or raises the fleet to Works alone.');
    return { repos: fleet.repos };
  }

  /** The repository the mission is written in: the one named, else the one the fleet's runners hold, or why none is. */
  function repoOf(body: RequestBody, held: readonly string[]): MakeRefusal | { repo: string } {
    if (body.repo !== undefined) return { repo: body.repo.toLowerCase() };
    const [only, ...more] = held.toSorted();
    return only !== undefined && more.length === 0 ? { repo: only } : no('22023', 'repo', `Repository: name the one the mission is written in, ${held.toSorted().join(' or ')}.`);
  }

  /** Then on what is pressed: the goal, the repository and its phase 0. */
  function refusal(person: string, body: RequestBody): MakeRefusal | { repo: string } {
    const who = whoRefusal(person, body);
    if ('ok' in who) return who;
    if (body.goal.length > 300 || body.goal.trim() === '') return no('22023', 'goal', 'Goal: one line of 1 to 300 characters.');
    const where = repoOf(body, who.repos);
    if ('ok' in where) return where;
    const phase = phase0.get(where.repo);
    if (phase === undefined) return no('P0002', 'repo', `Repository: no repository ${where.repo} in this workspace.`);
    return phase === 'server' ? where : no('22023', 'phase0', 'A goal-only mission needs phase 0 on the server.');
  }

  const uuid = (n: number, tail: string) => `${String(n).padStart(8, '0')}-0000-4000-8000-${tail}`;

  return {
    requests,
    jobs,
    /** The requests as `person` reads and writes them: their workspace's alone (row-level security), made as them. */
    as(person: { id: string }): RequestsRepository {
      return {
        make: (body) => {
          if (options.failing) return Promise.resolve({ ok: false, code: null, hint: null, error: 'connection reset' });
          const checked = refusal(person.id, body);
          if ('ok' in checked) return Promise.resolve(checked);
          made += 1;
          const id = uuid(made, '00000000000a');
          const job = uuid(made, '00000000000b');
          requests.push({ id, repo: checked.repo, fleet: body.fleet, goal: body.goal, requestedBy: logins.get(person.id) ?? '', mission: null, createdAt: '2027-01-29T10:00:00.000Z', workspace: body.workspace, by: person.id, job });
          jobs.push({ id: job, line: requestLine(id), repo: checked.repo, toFleet: body.fleet, sentBy: person.id });
          const answer: MadeRequest['request'] = { id, repo: checked.repo, fleet: body.fleet, goal: body.goal, job };
          return Promise.resolve({ ok: true, made: answer });
        },
        read: (id) => {
          const kept = requests.find((one) => one.id === id && members.get(person.id)?.workspace === one.workspace);
          if (kept === undefined) return Promise.resolve(null);
          const { id: keptId, repo, fleet, goal, requestedBy, mission, createdAt } = kept;
          return Promise.resolve({ id: keptId, repo, fleet, goal, requestedBy, mission, createdAt });
        },
      };
    },
    /** Fills a request's mission number, as mission_push() does once its brief is pushed. */
    pushed(id: string, mission: number): void {
      const kept = requests.find((one) => one.id === id);
      if (kept) kept.mission = parseIssue(mission);
    },
  };
}

import { parseIssue, PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import type { RailReader } from './rail.repository';
import type { CardAnswerers } from './rail.service';
import type { ApprovalRow, JobQuestionsRow, MissionItemRow, OutboxRow, RailMission } from './rail';
import { GLOBEX, GUS, MIRA, NORTHWIND, NOW, PAUL } from './commander.fake';

// The rail's records in memory (PRD 3107 s2), for the rail's, the service's and the route's tests, under the rules of
// row-level security and of the answer routes it calls (runner_job_answer(), answer_mission_item()): a question is
// answered once, by whoever answers first, as themselves. Northwind's blue-fleet runs mission 3110 on PRDs 2817 and 2820
// of northwind/quotes: job 4f2a asks "Old quotes API or v2?" (Keep old API, Use v2), job 3e90's "Keep the retry?" was
// answered by Paul at 08:58, a retro proposes a mission item, PRD 2817's outbox waits on a person and PRD 2820 waits on
// Mira's approval. Globex's red-fleet has its own job asking a question nobody at Northwind may see.

const prd = (n: number) => PrdNumberSchema.parse(n);

export const ACCOUNTS: Readonly<Record<string, string>> = {
  [MIRA]: '0000aaaa-0000-4000-8000-00000000000a',
  [PAUL]: '0000bbbb-0000-4000-8000-00000000000b',
  [GUS]: '0000cccc-0000-4000-8000-00000000000c',
};
const account = (login: string): string => ACCOUNTS[login] ?? '0000dddd-0000-4000-8000-00000000000d';

const MISSION_3110 = 'aaaaaaaa-0000-4000-8000-000000003110';
const MISSION_9001 = 'bbbbbbbb-0000-4000-8000-000000009001';
export const JOB_4F2A = '4f2a1b2c-0000-4000-8000-000000000001';
export const JOB_3E90 = '3e90aaaa-0000-4000-8000-000000000002';
export const JOB_GLOBEX = 'bbbbbbbb-1111-4000-8000-000000000001';
export const ITEM_1 = 'dddddddd-0000-4000-8000-000000000001';
const APPROVAL_2820 = 'eeeeeeee-0000-4000-8000-000000002820';

type Owned<T> = T & { workspace: string };

export function fakeRailDb() {
  const missions: Owned<RailMission & { fleet: string }>[] = [
    { workspace: NORTHWIND, fleet: 'blue-fleet', id: MISSION_3110, number: 3110, repo: 'northwind/quotes', status: 'running', prds: [prd(2817), prd(2820)] },
    { workspace: GLOBEX, fleet: 'red-fleet', id: MISSION_9001, number: 9001, repo: 'globex/payroll', status: 'running', prds: [prd(77)] },
  ];
  const jobs: Owned<JobQuestionsRow>[] = [
    {
      workspace: NORTHWIND, job: JOB_4F2A, mission: MISSION_3110, issue: parseIssue(2817), answers: null, closedBy: null, closedAt: null, askedAt: '2026-11-21T08:40:00Z',
      questions: [{ question: 'Old quotes API or v2?', options: [{ label: 'Keep old API' }, { label: 'Use v2' }], multiSelect: false }],
    },
    {
      workspace: NORTHWIND, job: JOB_3E90, mission: MISSION_3110, issue: parseIssue(2809), answers: { 'Keep the retry?': 'Keep' }, closedBy: account(PAUL), closedAt: '2026-11-21T08:58:00Z', askedAt: '2026-11-21T08:00:00Z',
      questions: [{ question: 'Keep the retry?', options: [{ label: 'Keep' }, { label: 'Drop' }], multiSelect: false }],
    },
    {
      workspace: GLOBEX, job: JOB_GLOBEX, mission: MISSION_9001, issue: parseIssue(77), answers: null, closedBy: null, closedAt: null, askedAt: '2026-11-21T07:00:00Z',
      questions: [{ question: 'Globex secret payroll question?', options: [{ label: 'Yes' }, { label: 'No' }], multiSelect: false }],
    },
  ];
  const items: Owned<MissionItemRow>[] = [
    { workspace: NORTHWIND, id: ITEM_1, mission: MISSION_3110, target: 'testing › Timeouts', wording: 'The quotes e2e suite takes the long timeout.', answer: null, answeredBy: null, answeredAt: null, createdAt: '2026-11-21T08:50:00Z' },
  ];
  const outbox: Owned<OutboxRow>[] = [
    { workspace: NORTHWIND, repository: 'northwind/quotes', prd: prd(2817), waiting: [{ id: 's2-01-keep-the-export', question: 'Keep the CSV export?' }], syncedAt: '2026-11-21T08:45:00Z' },
    { workspace: NORTHWIND, repository: 'northwind/quotes', prd: prd(9999), waiting: [{ id: 's1-01-other-mission', question: 'A PRD no mission of this fleet runs?' }], syncedAt: '2026-11-21T08:45:00Z' },
  ];
  const approvals: (ApprovalRow & { asked: string })[] = [
    { asked: MIRA, id: APPROVAL_2820, repo: 'northwind/quotes', prd: prd(2820), title: 'Quotes export v2', askedAt: '2026-11-21T08:30:00Z' },
  ];
  /** Whether the answer routes refuse, as a route down would. */
  let refusing = false;
  const sees = (person: string, workspace: string) => (workspace === GLOBEX ? person === GUS : person === MIRA || person === PAUL);

  /** Answers job `id` as `person`, once, as runner_job_answer() does. */
  function answerJob(person: string, id: string, answers: Record<string, string>): boolean {
    const row = jobs.find((j) => j.job === id && sees(person, j.workspace));
    if (refusing || !row || row.closedAt !== null) return false;
    Object.assign(row, { answers, closedBy: account(person), closedAt: NOW.toISOString() });
    return true;
  }

  /** Answers item `id` as `person`, once, as answer_mission_item() does. */
  function answerItem(person: string, id: string, answer: 'adopted' | 'declined'): boolean {
    const row = items.find((i) => i.id === id && sees(person, i.workspace));
    if (refusing || !row || row.answer !== null) return false;
    Object.assign(row, { answer, answeredBy: account(person), answeredAt: NOW.toISOString() });
    return true;
  }

  return {
    jobs, items,
    refuse() { refusing = true; },
    /** Another member answers on the question's own page. */
    answerElsewhere: { job: answerJob, item: answerItem },
    /** The reader as `person` reads: their workspaces alone. */
    as(person: string): Pick<RailReader, 'missions' | 'jobQuestions' | 'items' | 'outbox' | 'approvals' | 'logins'> {
      const mine = (ids: readonly string[]) => (m: { mission: string; workspace: string }) => sees(person, m.workspace) && ids.includes(m.mission);
      return {
        missions: (workspace, fleet) => Promise.resolve(missions.filter((m) => sees(person, m.workspace) && m.workspace === workspace && m.fleet === fleet)),
        jobQuestions: (workspace, ids) => Promise.resolve(jobs.filter((j) => j.workspace === workspace && mine(ids)(j)).map((j) => ({ ...j }))),
        items: (ids) => Promise.resolve(items.filter(mine(ids)).map((i) => ({ ...i }))),
        outbox: (workspace, repos) => Promise.resolve(outbox.filter((o) => sees(person, o.workspace) && o.workspace === workspace && repos.includes(o.repository))),
        approvals: () => Promise.resolve(approvals.filter((a) => a.asked === person)),
        logins: (_workspace, people) => Promise.resolve(new Map(Object.entries(ACCOUNTS).filter(([, id]) => people.includes(id)).map(([login, id]) => [id, login]))),
      };
    },
    /** The answer routes as `person` calls them, recording what each was sent. */
    answerers(person: string): CardAnswerers & { sent: { route: string; id: string; body: unknown }[] } {
      const sent: { route: string; id: string; body: unknown }[] = [];
      return {
        sent,
        job: (id, answers) => { sent.push({ route: 'job', id, body: { answers } }); return Promise.resolve(answerJob(person, id, answers)); },
        item: (id, answer) => { sent.push({ route: 'item', id, body: { answer } }); return Promise.resolve(answerItem(person, id, answer)); },
      };
    },
  };
}

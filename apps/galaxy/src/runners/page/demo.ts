import { IssueNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import type { Board, Job, JobQuestions, Runner } from '../runners.contract';
import type { Fleet, RunnersPageView } from './model';

// The demo's runners (PRD 1830 s3), for development and OMNI_LOOP_DEMO=1: one runner in each state, a
// job in each status, the viewer a workspace owner, so every cell and every action shows. Every time is
// counted back from `now`, so the same `now` draws the same page.

const MIN = 60_000;
const DEMO_NAME = 'Acme';
const YOU = '00000000-0000-4000-8000-00000000d001';
const ADA = '00000000-0000-4000-8000-00000000d002';

const DEMO_RUNNERS = {
  agents: '00000000-0000-4000-8000-00000000d101',
  office: '00000000-0000-4000-8000-00000000d102',
  laptop: '00000000-0000-4000-8000-00000000d103',
} as const;

// The two jobs of the demo that asked questions (PRD 2255): one still open, one a person answered.
const ASKING = '00000000-0000-4000-8000-00000000d2a1';
const ANSWERED = '00000000-0000-4000-8000-00000000d2a2';
// And one an API key answered for someone (PRD 2425): its drawer says so, with whom the app said it acted for.
const KEY_ANSWERED = '00000000-0000-4000-8000-00000000d2a3';

const FLEETS: Fleet[] =[{ name: 'comets', label: 'Comets' }, { name: 'nebula', label: 'Nebula' }];

export function demoRunnersPage(now: Date): RunnersPageView {
  const at = (minutes: number) => new Date(now.getTime() + minutes * MIN).toISOString();
  const runner = (over: Partial<Runner> & Pick<Runner, 'id' | 'name' | 'state'>): Runner => ({
    owner: YOU, fleet: null, slots: 2, used: 0, repos: ['acme/widgets'], version: '0.0.388', lastSeenAt: at(0), ...over,
  });
  const GB = 1024 ** 3;
  const LIMITS = { maxMemory: 85, minDiskGb: 10, maxLoad: 1.5 };
  // A machine of 16 GB and 8 cores: its CPU share, memory used and disk free (in GB), and why it is paused, if it is.
  const report = (cpu: number, memGb: number, diskGb: number, paused: string | null): NonNullable<Runner['health']> => ({
    cpu, load1: cpu / 8, cores: 8, memUsed: Math.round(memGb * GB), memTotal: 16 * GB, diskFree: diskGb * GB, diskTotal: 233 * GB,
    paused, limits: LIMITS, at: at(0),
  });
  // The machine's tokens (PRD 2102 s4): 10.2M over the last 5 h and 15.7M today, almost all of it cache reads.
  const TOKENS = {
    last5h: { input: 81_234, output: 402_118, cacheRead: 9_120_443, cacheWrite: 611_002 },
    today: { input: 120_113, output: 655_001, cacheRead: 14_002_118, cacheWrite: 902_114 },
  };
  const samples = (cpu: number, memGb: number, diskGb: number, tokens5h: number | null = null): NonNullable<Runner['samples']> =>
    [0, 1, 2, 3, 4].map((i) => ({
      at: at(i - 5), cpu: cpu * (0.6 + i / 10), memUsed: Math.round(memGb * GB * (0.8 + i / 20)), memTotal: 16 * GB,
      diskFree: diskGb * GB, tokens5h: tokens5h === null ? null : Math.round(tokens5h * (0.5 + i / 8)),
    }));
  let seq = 0;
  const job = (over: Partial<Job> & Pick<Job, 'line' | 'status'>): Job => {
    seq += 1;
    return {
      id: `00000000-0000-4000-8000-00000000d2${String(seq).padStart(2, '0')}`, repo: 'acme/widgets', toRunner: null, toFleet: null,
      sentBy: YOU, sentByLogin: 'you', sentByKey: null, runner: null, cancelRequested: false, logTail: '', prUrl: null, exitCode: null, reason: null,
      queuedAt: at(-30), claimedAt: null, runningAt: null, endedAt: null, ...over,
    };
  };
  const board: Board = {
    runners: [
      runner({
        id: DEMO_RUNNERS.agents, name: 'acme-agents', state: 'busy', fleet: 'comets', slots: 1, used: 1,
        health: {
          ...report(63, 14.6, 41, 'memory 91%'), tokens: TOKENS,
          // Its accounts (PRD 2537): the first is out until its limit resets, the second carries the job on.
          accounts: [{ id: 'claude-1', agent: 'claude', state: 'out', resetsAt: at(240) }, { id: 'codex-1', agent: 't3', state: 'active' }, { id: 'claude-2', agent: 'claude', state: 'ready' }],
        }, samples: samples(63, 14.6, 41, 10_214_797),
      }),
      runner({
        id: DEMO_RUNNERS.office, name: 'mac-mini-office', state: 'online', repos: ['acme/widgets', 'acme/mobile'],
        health: { ...report(18, 7.1, 41, null), diskFree: null }, samples: samples(18, 7.1, 41),
      }),
      runner({
        id: DEMO_RUNNERS.laptop, name: 'ada-laptop', state: 'offline', owner: ADA, slots: 1, lastSeenAt: at(-180), version: '0.0.385',
        health: { ...report(4, 6, 120, null), at: at(-180) },
      }),
    ],
    jobs: [
      job({
        line: '/omni:yolo 1717', status: 'running', toRunner: DEMO_RUNNERS.agents, runner: DEMO_RUNNERS.agents, claimedAt: at(-12), runningAt: at(-12),
        logTail: 'wave 1 · slice s1 · tests green\nopened https://github.com/acme/widgets/pull/1841',
        tokens: { input: 31_002, output: 190_455, cacheRead: 1_150_330, cacheWrite: 84_012 },
        // It turned over (PRD 2537): its first account hit its usage limit, and the second carries it on.
        parts: [
          { agent: 'codex', model: 'gpt-5-codex', account: 'codex-1', from: at(-12), to: at(-5), ended: 'limit', resetsAt: at(180), guessed: false, note: 'runner' },
          { agent: 'opencode', model: 'mistral/devstral-medium-latest', account: 'open-1', from: at(-5), to: null, ended: null },
        ],
      }),
      job({ line: '/omni:pr-care 1801', status: 'queued', toFleet: 'comets', sentBy: ADA, sentByLogin: 'ada', queuedAt: at(-2) }),
      job({
        line: '/omni:bug-fix 1790', status: 'done', runner: DEMO_RUNNERS.office, prUrl: 'https://github.com/acme/widgets/pull/1838',
        logTail: 'fix pushed\nopened https://github.com/acme/widgets/pull/1838', exitCode: 0, endedAt: at(-20),
      }),
      job({
        line: '/omni:yolo 1702', status: 'failed', toRunner: DEMO_RUNNERS.laptop, runner: DEMO_RUNNERS.laptop, reason: 'runner lost', endedAt: at(-178),
        released: [1908, 1909],
      }),
      job({ line: '/omni:plan 1699', status: 'cancelled', cancelRequested: true, endedAt: at(-240) }),
      job({
        line: '/omni:yolo 1855', status: 'done', runner: DEMO_RUNNERS.office, prUrl: 'https://github.com/acme/widgets/pull/1861', exitCode: 0,
        outcome: 'answers', endedAt: at(-60),
      }),
      job({ line: '/omni:yolo 1856', status: 'done', runner: DEMO_RUNNERS.office, exitCode: 0, outcome: 'held', endedAt: at(-90) }),
      job({
        line: '/omni:yolo-fix 1857', status: 'done', runner: DEMO_RUNNERS.office, prUrl: 'https://github.com/acme/widgets/pull/1862', exitCode: 0,
        outcome: 'ready', endedAt: at(-120),
      }),
      job({
        line: '/omni:bug-fix Issue 548 totals', status: 'done', sentBy: ADA, sentByLogin: 'ada', sentByKey: 'QA dashboard', runner: DEMO_RUNNERS.office,
        prUrl: 'https://github.com/acme/widgets/pull/1850', exitCode: 0, endedAt: at(-300),
      }),
      // A bug-fix that stopped with two questions for a person (PRD 2255): it reads Need human, with the button.
      job({
        id: ASKING, line: '/omni:bug-fix 314', status: 'done', sentByLogin: 'ada', sentBy: ADA, sentByKey: 'cleaner', actingFor: 'Jane D.', runner: DEMO_RUNNERS.office, exitCode: 0,
        outcome: 'human', logTail: 'stopped: two questions for a person', endedAt: at(-15),
      }),
      // One that asked, and Ada answered: it reads Done again, and its drawer says who answered.
      job({ id: ANSWERED, line: '/omni:bug-fix 301', status: 'done', runner: DEMO_RUNNERS.office, exitCode: 0, endedAt: at(-200) }),
      // A retro the Omni app sent, which no person asked for (PRD 2338): its sender reads Omni app.
      job({ line: '/omni:retro-apply --retro 2340', status: 'queued', sentBy: null, sentByLogin: null, sentByApp: 'omni-app', queuedAt: at(-1) }),
      // A job no runner can take (PRD 2482): no runner without a fleet holds its repository, so it reads Cannot run and why.
      job({ line: '/omni:retro-apply --retro 2351', repo: 'acme/gadgets', status: 'queued', sentBy: null, sentByLogin: null, sentByApp: 'omni-app', queuedAt: at(-3) }),
      // A job an API key sent for someone and then cancelled (PRD 2425): it reads Cancelled, with the key under it.
      job({
        line: '/omni:bug-fix 318', status: 'cancelled', sentBy: ADA, sentByLogin: 'ada', sentByKey: 'cleaner', actingFor: 'Jane D.', cancelledByKey: 'cleaner',
        cancelRequested: true, endedAt: at(-40),
      }),
      // One that asked, and the key answered for someone: it reads Done again, and its drawer says which key and for whom.
      job({
        id: KEY_ANSWERED, line: '/omni:bug-fix 322', status: 'done', sentBy: ADA, sentByLogin: 'ada', sentByKey: 'cleaner', actingFor: 'Jane D.',
        runner: DEMO_RUNNERS.office, exitCode: 0, endedAt: at(-260),
      }),
    ],
    viewer: { id: YOU, owner: true, fleet: 'comets' },
  };
  const questions: JobQuestions[] = [
    {
      job: ASKING, issue: IssueNumberSchema.parse(314), state: 'open', answers: null, by: null, byLogin: null, at: null, resume: null,
      lead: 'The planning query fails for **31 tenants**: an assignment points at a project the user may not open.\n\nBoth fixes below pass the tests; they differ in what the user sees.',
      questions: [
        {
          question: 'How should the planning show an assignment whose project the user may not open?', header: 'Fix', multiSelect: false,
          options: [
            { label: 'Make the project nullable (Recommended)', description: 'The assignment shows with no project name.' },
            { label: 'Filter those assignments out', description: 'The user sees only what they may open.' },
          ],
        },
        {
          question: 'Which tenants first?', header: 'Rollout', multiSelect: true,
          options: [
            { label: 'The 31 failing', description: 'Fix what is broken today.' },
            { label: 'All of them', description: 'Roll the new shape out everywhere at once.' },
          ],
        },
      ],
    },
    {
      job: ANSWERED, issue: IssueNumberSchema.parse(301), state: 'answered', by: ADA, byLogin: 'ada', at: at(-190), resume: null,
      lead: 'The invoice total drops a cent when a line has a 3-decimal price.',
      answers: { 'Round each line, or the total?': 'Round each line' },
      questions: [
        {
          question: 'Round each line, or the total?', header: 'Rounding', multiSelect: false,
          options: [{ label: 'Round each line', description: 'What the supplier sheet does.' }, { label: 'Round the total', description: 'What the ledger does.' }],
        },
      ],
    },
    {
      job: KEY_ANSWERED, issue: IssueNumberSchema.parse(322), state: 'answered', by: null, byLogin: null, byKey: 'cleaner', actingFor: 'Jane D.', at: at(-250), resume: null,
      lead: 'The export drops the VAT column when a tenant has no VAT number.',
      answers: { 'Keep the column empty, or leave it out?': 'Keep it empty' },
      questions: [
        {
          question: 'Keep the column empty, or leave it out?', header: 'Export', multiSelect: false,
          options: [{ label: 'Keep it empty', description: 'The file has the same columns for every tenant.' }, { label: 'Leave it out', description: 'The file shows only what the tenant has.' }],
        },
      ],
    },
  ];
  return { kind: 'board', name: DEMO_NAME, board, fleets: FLEETS, prds: { 'acme/widgets#1717': 'Sync widgets across devices', 'acme/widgets#1855': 'Export the totals as CSV' }, retros: { 'acme/widgets#2340': 1717 }, now: now.toISOString(), answered: [], demoQuestions: questions };
}

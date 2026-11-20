import { PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import type { Message, Reply } from './commander.contract';
import type { CommanderReader, CommanderWriter, FleetOf, Written } from './commander.repository';
import type { EventRow, JobRow, MissionRow } from './commander';
import type { ModelAnswer, ModelTurn } from './model';
import type { RailService } from './rail.service';

// The Commander's database in memory (PRD 3107 s1), for the service's and the controller's tests: two workspaces as one
// person reads them, under the rules of row-level security and commander_ask()
// (supabase/migrations/20270128090000_fleet_commander.sql). Northwind's virtual fleet blue-fleet runs mission 3110,
// which waits on PRD 2817's review; Globex's red-fleet runs mission 9001. Mira and Paul are Northwind's members, Gus is
// Globex's. A fake model answers what the test gives it and keeps every turn it was handed.

export const NORTHWIND = '11111111-1111-4111-8111-111111111111';
export const GLOBEX = '99999999-9999-4999-8999-999999999999';
export const MIRA = 'mira-k';
export const PAUL = 'paul-n';
export const GUS = 'gus-g';
export const NOW = new Date('2026-11-21T09:30:00Z');

const MISSION_3110 = 'aaaaaaaa-0000-4000-8000-000000003110';
const MISSION_9001 = 'bbbbbbbb-0000-4000-8000-000000009001';
const EVENT_WAITS = 'aaaaaaaa-0000-4000-8000-0000000e0001';
const JOB_4F2A = '4f2a1b2c-0000-4000-8000-000000000001';

const prd = (n: number) => PrdNumberSchema.parse(n);

type Space = { members: Set<string>; fleets: Map<string, FleetOf> };

export function fakeCommanderDb() {
  const spaces = new Map<string, Space>([
    [NORTHWIND, { members: new Set([MIRA, PAUL]), fleets: new Map([['blue-fleet', { virtual: true, cap: 1_000_000 }], ['beaver', { virtual: false, cap: null }]]) }],
    [GLOBEX, { members: new Set([GUS]), fleets: new Map([['red-fleet', { virtual: true, cap: null }]]) }],
  ]);
  const missions: (MissionRow & { workspace: string; fleet: string })[] = [
    { workspace: NORTHWIND, fleet: 'blue-fleet', id: MISSION_3110, number: 3110, title: 'Quotes export', status: 'waiting', waitingOn: 'review of PRD 2817', repo: 'northwind/quotes', updatedAt: '2026-11-21T08:41:00Z' },
    { workspace: GLOBEX, fleet: 'red-fleet', id: MISSION_9001, number: 9001, title: 'Secret payroll rewrite', status: 'running', waitingOn: null, repo: 'globex/payroll', updatedAt: '2026-11-21T08:00:00Z' },
  ];
  const events: EventRow[] = [
    { id: EVENT_WAITS, mission: MISSION_3110, at: '2026-11-21T08:41:00Z', role: 'reviewer', kind: 'waits', prd: prd(2817), job: JOB_4F2A, link: 'https://github.com/northwind/quotes/pull/2817', sentence: 'PRD 2817 waits on a review.' },
    { id: 'aaaaaaaa-0000-4000-8000-0000000e0002', mission: MISSION_3110, at: '2026-11-21T07:10:00Z', role: 'engineer', kind: 'held', prd: prd(2809), job: null, link: null, sentence: 'QA sent PRD 2809 back.' },
    { id: 'bbbbbbbb-0000-4000-8000-0000000e0001', mission: MISSION_9001, at: '2026-11-21T08:00:00Z', role: 'engineer', kind: 'dispatched', prd: prd(77), job: null, link: null, sentence: 'Globex payroll secret sentence.' },
  ];
  const jobs: (JobRow & { workspace: string })[] = [
    { workspace: NORTHWIND, id: JOB_4F2A, mission: MISSION_3110, queuedAt: '2026-11-21T06:00:00Z', line: '/omni:yolo 2817', status: 'done', outcome: 'ready' },
    { workspace: GLOBEX, id: 'bbbbbbbb-1111-4000-8000-000000000001', mission: MISSION_9001, queuedAt: '2026-11-21T07:00:00Z', line: '/omni:yolo 77', status: 'running', outcome: null },
  ];
  const messages: (Message & { workspace: string; fleet: string; tokens: number })[] = [];
  // The messages to the fleet's agents (s3), as commander_send() stores them: `messaged` events are added to the running missions.
  const told: (Extract<Message, { kind: 'fleet' }> & { workspace: string; fleet: string })[] = [];
  let spentOther = 0;
  let made = 0;
  const id = () => {
    made += 1;
    return `cccccccc-0000-4000-8000-${String(made).padStart(12, '0')}`;
  };
  const missionOf = (mission: string) => missions.find((m) => m.id === mission);

  return {
    missions, events, jobs, messages, told,
    /** Tokens the fleets' jobs spent in the last 24 hours. */
    spendJobs(tokens: number) { spentOther = tokens; },
    /** The reader as `person` reads: their workspaces alone, as row-level security shows them. */
    as(person: string): Pick<CommanderReader, 'fleet' | 'missions' | 'events' | 'jobs' | 'thread' | 'fleetMessages' | 'spent' | 'ask' | 'send'> {
      const sees = (workspace: string) => spaces.get(workspace)?.members.has(person) === true;
      return {
        fleet: (workspace, fleet) => Promise.resolve(sees(workspace) ? spaces.get(workspace)?.fleets.get(fleet) ?? null : null),
        missions: (workspace, fleet) => Promise.resolve(missions.filter((m) => sees(m.workspace) && m.workspace === workspace && m.fleet === fleet && m.status !== 'draft')),
        events: (mission, limit, before) => Promise.resolve(events
          .filter((e) => e.mission === mission && sees(missionOf(e.mission)?.workspace ?? '') && e.at < (before ?? '9999'))
          .sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)),
        jobs: (workspace, ids, since) => Promise.resolve(jobs.filter((j) => sees(j.workspace) && j.workspace === workspace && j.mission !== null && ids.includes(j.mission) && j.queuedAt >= since.toISOString())),
        thread: (workspace, fleet, limit) => Promise.resolve(messages.filter((m) => sees(m.workspace) && m.workspace === workspace && m.fleet === fleet).slice(-limit)),
        fleetMessages: (workspace, fleet, limit) => Promise.resolve(told.filter((m) => sees(m.workspace) && m.workspace === workspace && m.fleet === fleet).slice(-limit)),
        send(workspace, fleet, text): Promise<Written<Message>> {
          if (!sees(workspace)) return Promise.resolve({ ok: false, code: '42501', hint: null, message: 'Only a member of the workspace messages its fleet.' });
          if (spaces.get(workspace)?.fleets.get(fleet)?.virtual !== true) return Promise.resolve({ ok: false, code: '22023', hint: 'fleet', message: 'Fleet: not a virtual fleet of this workspace.' });
          if (text.trim() === '' || text.trim().length > 2000) return Promise.resolve({ ok: false, code: '22023', hint: 'text', message: 'Message: 1 to 2000 characters.' });
          const message = { kind: 'fleet' as const, id: id(), at: NOW.toISOString(), login: person, text: text.trim(), reads: [] };
          told.push({ ...message, workspace, fleet });
          for (const m of missions.filter((x) => x.workspace === workspace && x.fleet === fleet && x.status === 'running')) {
            events.push({ id: id(), mission: m.id, at: NOW.toISOString(), role: 'supervisor', kind: 'messaged', prd: null, job: null, link: null, sentence: 'Sent a message to the fleet.' });
          }
          return Promise.resolve({ ok: true, value: message });
        },
        spent: (workspace, fleet) => {
          const commander = messages.filter((m) => m.workspace === workspace && m.fleet === fleet).reduce((n, m) => n + m.tokens, 0);
          return Promise.resolve(sees(workspace) ? { tokens: spentOther + commander, oldestEnd: '2026-11-20T23:00:00Z' } : { tokens: 0, oldestEnd: null });
        },
        ask(workspace, fleet, text): Promise<Written<Message>> {
          if (!sees(workspace)) return Promise.resolve({ ok: false, code: '42501', hint: null, message: 'Only a member of the workspace asks its fleet\'s Commander.' });
          if (spaces.get(workspace)?.fleets.get(fleet)?.virtual !== true) return Promise.resolve({ ok: false, code: '22023', hint: 'fleet', message: 'Fleet: not a virtual fleet of this workspace.' });
          const question: Message = { kind: 'question', id: id(), at: NOW.toISOString(), login: person, text };
          messages.push({ ...question, workspace, fleet, tokens: 0 });
          return Promise.resolve({ ok: true, value: question });
        },
      };
    },
    /** The service role's writer. */
    writer(): Pick<CommanderWriter, 'reply'> {
      return {
        reply(input: { workspace: string; fleet: string; question: string; reply: Reply; tokens: number }): Promise<Message> {
          const reply: Message = { kind: 'reply', id: id(), at: NOW.toISOString(), replyTo: input.question, reply: input.reply };
          messages.push({ ...reply, workspace: input.workspace, fleet: input.fleet, tokens: input.tokens });
          return Promise.resolve(reply);
        },
      };
    },
  };
}

/** A model that answers `answers` in turn, running each tool call it is told to first, and keeps every turn it was handed. */
export function fakeModel(answers: readonly (ModelAnswer | { tool: string; args: unknown })[]) {
  const turns: ModelTurn[] = [];
  const tools: string[] = [];
  return {
    turns,
    tools,
    model: async (turn: ModelTurn): Promise<ModelAnswer> => {
      turns.push(turn);
      for (const answer of answers) {
        if ('tool' in answer) {
          tools.push(await turn.runTool(answer.tool, answer.args));
          continue;
        }
        return answer;
      }
      return { ok: false, why: 'no answer given', tokens: 0 };
    },
  };
}

/** The model's reply in its fixed shape. */
export const replied = (reply: object, tokens = 900): ModelAnswer => ({ ok: true, content: JSON.stringify(reply), tokens });

/** A rail with no card, for the tests of the thread alone (the rail's own tests use rail.fake.ts). */
export const NO_RAIL: Pick<RailService, 'cards' | 'answer'> = {
  cards: () => Promise.resolve([]),
  answer: () => Promise.resolve({ ok: false, kind: 'missing', error: 'No card.' }),
};

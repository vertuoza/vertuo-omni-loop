// PRD 1218, slice s4: a roadmap's open prerequisites hold exactly the PRDs they block, after the park
// rules, in the words `waits on prerequisite <id> (<category>): <need>`, with the Prerequisites tab's link.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parsePrd } from '../ids.ts';
import type { PrdNumber } from '../ids.ts';
import type { Roadmap, RoadmapPrerequisite, RoadmapQuestion, RoadmapRow } from '../roadmap/parse.ts';
import type { PrdStanding, PrStanding } from '../roadmap/push.ts';
import type { PrerequisiteState } from '../roadmap/prereqs/run.ts';
import { roadmapGates } from './roadmap.ts';
import type { RoadmapRead } from './roadmap.ts';

const A = parsePrd(1201);
const B = parsePrd(1202);
const C = parsePrd(1203);
const ISSUE = 'https://github.com/acme/widgets/issues/1200';
const TAB = 'https://omni.example/roadmaps/1200?tab=prerequisites';
const PR_URL = 'https://github.com/acme/widgets/pull/31';

const row = (id: string, n: PrdNumber, title: string, blockedBy: string[] = []): RoadmapRow => ({ id, prd: n, title, repos: null, blockedBy, why: null, wave: 1 });
const prereq = (id: string, blocks: 'all' | string[], over: Partial<RoadmapPrerequisite> = {}): RoadmapPrerequisite => ({
  id, category: 'local', need: 'Docker is running, for the database tests', check: 'base:docker', fix: null, blocks, who: 'check', repos: null, card: null, ...over,
});
const roadmap = (prerequisites: RoadmapPrerequisite[] | undefined, questions: RoadmapQuestion[] = []): Roadmap => ({
  roadmap: parseIssue(1200), title: 'Crew', milestone: 'A mandate', product: null, target: null, source: null, repos: false,
  prds: [row('r1', A, 'Crew API'), row('r2', B, 'Think endpoint'), row('r3', C, 'Docs')],
  questions,
  ...(prerequisites ? { prerequisites } : {}),
});

type Over = { states?: Record<string, PrerequisiteState> | null; ticks?: string[]; questions?: RoadmapQuestion[]; standings?: Map<string, PrdStanding> };
const read = (prerequisites: RoadmapPrerequisite[] | undefined, { states = {}, ticks = [], questions = [], standings = new Map() }: Over = {}): RoadmapRead => ({
  roadmap: roadmap(prerequisites, questions),
  answers: new Map(),
  standings,
  live: new Map(),
  issueLink: ISSUE,
  prerequisites: states === null ? null : new Map(Object.entries(states)),
  ticks: new Set(ticks),
  prerequisitesLink: TAB,
});
const held = (gates: Map<PrdNumber, unknown>): number[] => [...gates.keys()].map(Number).sort((a, b) => a - b);
const line = 'waits on prerequisite p1 (local): Docker is running, for the database tests';

describe('roadmapGates — prerequisites', () => {
  it('a row that waits holds exactly the PRDs in its blocks, with the line and the tab\'s link', () => {
    const gates = roadmapGates(read([prereq('p1', ['r2', 'r3'])], { states: { p1: 'waits' } }));
    expect(held(gates)).toEqual([1202, 1203]);
    expect(gates.get(B)).toEqual({ kind: 'hold', why: line, link: TAB });
  });

  it('a row blocking all holds every PRD', () => {
    expect(held(roadmapGates(read([prereq('p1', 'all')], { states: { p1: 'waits' } })))).toEqual([1201, 1202, 1203]);
  });

  it('an ok, fixed or ticked row frees its PRDs', () => {
    for (const state of ['ok', 'fixed', 'ticked'] as const) {
      expect(roadmapGates(read([prereq('p1', 'all')], { states: { p1: state } })).size).toBe(0);
    }
  });

  it('a person row ticked on the issue since the last check frees its PRDs; a tick never frees a checked row', () => {
    const person = prereq('p3', ['r1'], { category: 'permissions', need: 'the preview has DATABASE_URL', check: null, who: 'person' });
    expect(roadmapGates(read([person], { states: { p3: 'waits' }, ticks: ['p3'] })).size).toBe(0);
    expect(held(roadmapGates(read([prereq('p1', ['r1'])], { states: { p1: 'waits' }, ticks: ['p1'] })))).toEqual([1201]);
  });

  it('the first open row in table order names the hold; a row of another category is named with its own', () => {
    const access = prereq('p2', ['r2'], { category: 'access', need: 'the @acme/ui package installs' });
    const gates = roadmapGates(read([access, prereq('p1', 'all')], { states: { p1: 'waits', p2: 'waits' } }));
    expect(gates.get(B)?.why).toBe('waits on prerequisite p2 (access): the @acme/ui package installs');
    expect(gates.get(A)?.why).toBe(line);
  });

  it('a row this machine has not checked yet holds, and says how to check it', () => {
    const why = `${line} — not checked on this machine yet: omni roadmap prereqs 1200 --fix`;
    expect(roadmapGates(read([prereq('p1', ['r1'])], { states: null })).get(A)).toEqual({ kind: 'hold', why, link: TAB });
    expect(roadmapGates(read([prereq('p1', ['r1'])], { states: {} })).get(A)?.why).toBe(why);
  });

  it('without the tab\'s link the hold carries the roadmap issue\'s', () => {
    const gates = roadmapGates({ ...read([prereq('p1', 'all')], { states: { p1: 'waits' } }), prerequisitesLink: null });
    expect(gates.get(A)?.link).toBe(ISSUE);
  });

  it('an unanswered person question still parks first, and an unmerged blocker\'s hold comes before', () => {
    const question: RoadmapQuestion = { id: 'Q5', question: 'Which bank?', recommendation: '–', blocks: ['r2'], kind: 'person' };
    const gates = roadmapGates(read([prereq('p1', 'all')], { states: { p1: 'waits' }, questions: [question] }));
    expect(gates.get(B)?.kind).toBe('park');
    expect(gates.get(A)).toEqual({ kind: 'hold', why: line, link: TAB });
    const pr: PrStanding = { repo: 'widgets', number: parsePr(31), url: PR_URL, state: 'OPEN', isDraft: true, createdAt: null, mergedAt: null, closedAt: null, questions: 0 };
    const blocked: RoadmapRead = { ...read([prereq('p1', 'all')], { states: { p1: 'waits' }, standings: new Map([['r1', { shipped: false, prs: [pr], expected: 1 }]]) }) };
    blocked.roadmap.prds[1] = row('r2', B, 'Think endpoint', ['r1']);
    expect(roadmapGates(blocked).get(B)?.why).toBe('waits on widgets#31 (r1 Crew API): building');
  });

  it('a roadmap without the section, or a read without prerequisites, gates as before', () => {
    expect(roadmapGates(read(undefined, { states: null })).size).toBe(0);
    const full = read([prereq('p1', 'all')]);
    const bare: RoadmapRead = { roadmap: full.roadmap, answers: full.answers, standings: full.standings, live: full.live, issueLink: ISSUE };
    expect(held(roadmapGates(bare))).toEqual([1201, 1202, 1203]);
    expect(roadmapGates(bare).get(A)?.link).toBe(ISSUE);
  });
});

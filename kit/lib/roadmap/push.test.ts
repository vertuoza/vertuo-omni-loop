// PRD 1162, slice s6: where each PRD of a roadmap stands, and the body `omni roadmap push` sends.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, parsePr } from '../ids.ts';
import type { Roadmap, RoadmapPrerequisite, RoadmapRow } from './parse.ts';
import { prdState, prdTimes, roadmapPushBody, waitsOn, WAITS_ON_MAX } from './push.ts';
import type { PrdStanding, PrStanding } from './push.ts';

function pr(over: Partial<PrStanding> = {}): PrStanding {
  return {
    repo: 'widgets', number: parsePr(21), url: 'https://github.com/acme/widgets/pull/21', state: 'OPEN', isDraft: true,
    createdAt: '2026-10-01T09:00:00Z', mergedAt: null, closedAt: null, questions: 0, ...over,
  };
}
const standing = (prs: PrStanding[], over: Partial<PrdStanding> = {}): PrdStanding => ({ shipped: false, prs, expected: 1, ...over });

describe('prdState', () => {
  it('reads waiting with no feature PR, merged once shipped without one', () => {
    expect(prdState(standing([]))).toBe('waiting');
    expect(prdState(standing([], { shipped: true }))).toBe('merged');
  });

  it('reads building on a draft, outbox on a draft with open questions, ready once ready', () => {
    expect(prdState(standing([pr()]))).toBe('building');
    expect(prdState(standing([pr({ questions: 2 })]))).toBe('outbox');
    expect(prdState(standing([pr({ isDraft: false })]))).toBe('ready');
  });

  it('reads merged once merged, closed when closed unmerged', () => {
    expect(prdState(standing([pr({ state: 'MERGED', mergedAt: '2026-10-03T09:00:00Z' })]))).toBe('merged');
    expect(prdState(standing([pr({ state: 'CLOSED' })]))).toBe('closed');
  });

  it('in a plan repository, is merged only once every feature PR merged, ready only once each is ready', () => {
    const merged = pr({ state: 'MERGED' });
    expect(prdState(standing([merged], { expected: 2 }))).toBe('building');
    expect(prdState(standing([merged, pr({ repo: 'crew', state: 'MERGED' })], { expected: 2 }))).toBe('merged');
    expect(prdState(standing([pr({ isDraft: false })], { expected: 2 }))).toBe('building');
    expect(prdState(standing([pr({ isDraft: false }), pr({ repo: 'crew', isDraft: false })], { expected: 2 }))).toBe('ready');
    expect(prdState(standing([merged, pr({ repo: 'crew', state: 'CLOSED' })], { expected: 2 }))).toBe('closed');
  });
});

describe('prdTimes', () => {
  it('starts with the first PR opened and ends with the last merge, or the close', () => {
    const prs = [pr({ state: 'MERGED', createdAt: '2026-10-02T00:00:00Z', mergedAt: '2026-10-05T00:00:00Z' }), pr({ repo: 'crew', state: 'MERGED', createdAt: '2026-10-01T00:00:00Z', mergedAt: '2026-10-04T00:00:00Z' })];
    expect(prdTimes(standing(prs, { expected: 2 }), 'merged')).toEqual({ startedAt: '2026-10-01T00:00:00Z', endedAt: '2026-10-05T00:00:00Z' });
    expect(prdTimes(standing([pr({ state: 'CLOSED', closedAt: '2026-10-06T00:00:00Z' })]), 'closed')).toEqual({ startedAt: '2026-10-01T09:00:00Z', endedAt: '2026-10-06T00:00:00Z' });
    expect(prdTimes(standing([pr()]), 'building')).toEqual({ startedAt: '2026-10-01T09:00:00Z', endedAt: null });
    expect(prdTimes(standing([]), 'waiting')).toEqual({ startedAt: null, endedAt: null });
  });
});

function row(id: string, prd: number, blockedBy: string[] = [], over: Partial<RoadmapRow> = {}): RoadmapRow {
  return { id, prd: parsePrd(prd), title: `PRD ${prd}`, repos: null, blockedBy, why: blockedBy.length ? 'because' : null, wave: blockedBy.length + 1, ...over };
}

describe('waitsOn', () => {
  const rows = (entries: Array<[RoadmapRow, PrdStanding]>) =>
    new Map(entries.map(([r, s]) => [r.id, { row: r, standing: s, state: prdState(s) }] as const));

  it('names the first blocker not merged, its PR and its state', () => {
    const blocked = row('P3', 1203, ['P1', 'P2']);
    const table = rows([
      [row('P1', 1201), standing([pr({ state: 'MERGED' })])],
      [row('P2', 1202, ['P1']), standing([pr({ number: parsePr(22), url: 'https://x/22', isDraft: false })])],
    ]);
    expect(waitsOn(blocked, table)).toEqual({ waitsOn: 'waits on widgets#22 (P2 PRD 1202): ready, waiting for your merge', waitsOnUrl: 'https://x/22' });
  });

  it('says each state: building, outbox questions, closed unmerged, not started', () => {
    const blocked = row('P2', 1202, ['P1']);
    const line = (s: PrdStanding) => waitsOn(blocked, rows([[row('P1', 1201), s]])).waitsOn;
    expect(line(standing([pr()]))).toBe('waits on widgets#21 (P1 PRD 1201): building');
    expect(line(standing([pr({ questions: 1 })]))).toBe('waits on widgets#21 (P1 PRD 1201): outbox: 1 question');
    expect(line(standing([pr({ questions: 3 })]))).toBe('waits on widgets#21 (P1 PRD 1201): outbox: 3 questions');
    expect(line(standing([pr({ state: 'CLOSED' })]))).toBe('waits on widgets#21 (P1 PRD 1201): closed unmerged: fix the roadmap');
    expect(waitsOn(blocked, rows([[row('P1', 1201), standing([])]]))).toEqual({ waitsOn: 'waits on P1 PRD 1201: not started', waitsOnUrl: null });
  });

  it('names the first PR still open in a plan repository', () => {
    const blocked = row('P2', 1202, ['P1']);
    const s = standing([pr({ state: 'MERGED' }), pr({ repo: 'crew', number: parsePr(7), url: 'https://x/crew/7' })], { expected: 2 });
    expect(waitsOn(blocked, rows([[row('P1', 1201), s]])).waitsOn).toBe('waits on crew#7 (P1 PRD 1201): building');
  });

  it('waits on nothing once every blocker merged, and keeps the line within the app\'s limit', () => {
    expect(waitsOn(row('P2', 1202, ['P1']), rows([[row('P1', 1201), standing([], { shipped: true })]]))).toEqual({ waitsOn: null, waitsOnUrl: null });
    const long = waitsOn(row('P2', 1202, ['P1']), rows([[row('P1', 1201, [], { title: 'x'.repeat(400) }), standing([])]])).waitsOn;
    expect(long).toHaveLength(WAITS_ON_MAX);
    expect(long?.endsWith('…')).toBe(true);
  });
});

describe('roadmapPushBody', () => {
  const roadmap: Roadmap = {
    roadmap: parseIssue(1200), title: 'Crew', milestone: 'A company grants its first mandate.', product: 'Vertuoza Crew', target: '2027-03-31', source: null,
    repos: false,
    prds: [row('P1', 1201), row('P2', 1202, ['P1'])],
    questions: [
      { id: 'Q2', question: 'Which default?', recommendation: 'The first', blocks: ['P2'], kind: 'default' },
      { id: 'Q5', question: 'Trial week?', recommendation: '', blocks: ['P2'], kind: 'person' },
    ],
  };

  it('carries exactly the contract\'s fields, the answers and each PRD\'s standing', () => {
    const body = roadmapPushBody({
      repo: 'acme/widgets', roadmap, document: '# the file\n',
      standings: new Map([['P1', standing([pr()])]]),
      answers: new Map([['Q5', 'yes']]),
    });
    expect(body).toEqual({
      repo: 'acme/widgets', roadmap: 1200, title: 'Crew', milestone: 'A company grants its first mandate.', product: 'Vertuoza Crew', target: '2027-03-31', source: null,
      document: '# the file\n',
      questions: [
        { id: 'Q2', question: 'Which default?', recommendation: 'The first', blocks: ['P2'], kind: 'default', answer: null },
        { id: 'Q5', question: 'Trial week?', recommendation: null, blocks: ['P2'], kind: 'person', answer: 'yes' },
      ],
      prds: [
        { id: 'P1', prd: 1201, title: 'PRD 1201', repos: [], blockers: [], wave: 1, state: 'building', waitsOn: null, waitsOnUrl: null, startedAt: '2026-10-01T09:00:00Z', endedAt: null },
        { id: 'P2', prd: 1202, title: 'PRD 1202', repos: [], blockers: ['P1'], wave: 2, state: 'waiting', waitsOn: 'waits on widgets#21 (P1 PRD 1201): building', waitsOnUrl: 'https://github.com/acme/widgets/pull/21', startedAt: null, endedAt: null },
      ],
    });
  });

  // PRD 1218, slice s3: the prerequisites and this machine's last result ride along, only when the
  // roadmap has the section, so a roadmap without it pushes exactly as before.
  const docker: RoadmapPrerequisite = {
    id: 'p1', category: 'local', need: 'Docker is running', check: 'base:docker', fix: null, blocks: ['P2'], who: 'check', repos: null,
    card: { why: 'The tests need it.', command: 'open -a Docker', whatItDoes: 'Starts Docker.', whoCanDoIt: 'Anyone with this laptop.' },
  };
  const preview: RoadmapPrerequisite = { id: 'p2', category: 'permissions', need: 'The preview has its secret', check: null, fix: null, blocks: 'all', who: 'person', repos: ['crew'], card: null };
  const plain = { repo: 'acme/widgets', document: '# the file\n', standings: new Map<string, PrdStanding>(), answers: new Map<string, string>() };

  it('leaves the prerequisites out of a roadmap without the section, whatever result is given', () => {
    const body = roadmapPushBody({ ...plain, roadmap: { ...roadmap, prerequisites: [] }, result: { machine: 'mac', checkedAt: '2026-10-08T09:00:00.000Z', rows: [] } });
    expect(body).not.toHaveProperty('prerequisites');
    expect(body).not.toHaveProperty('prerequisiteResult');
  });

  it('carries every prerequisite with its card, and the result with its machine and time', () => {
    const result = {
      machine: 'pierre-mac', checkedAt: '2026-10-08T09:00:00.000Z',
      rows: [{ id: 'p1', state: 'waits' as const, detail: 'docker info exited 1' }, { id: 'p2', state: 'ticked' as const, detail: null }],
    };
    const body = roadmapPushBody({ ...plain, roadmap: { ...roadmap, prerequisites: [docker, preview] }, result });
    expect(body.prerequisites).toEqual([
      { id: 'p1', category: 'local', need: 'Docker is running', check: 'base:docker', fix: null, blocks: ['P2'], who: 'check', repos: [], card: docker.card },
      { id: 'p2', category: 'permissions', need: 'The preview has its secret', check: null, fix: null, blocks: 'all', who: 'person', repos: ['crew'], card: null },
    ]);
    expect(body.prerequisiteResult).toEqual(result);
  });

  it('sends a null result when this machine has none', () => {
    const body = roadmapPushBody({ ...plain, roadmap: { ...roadmap, prerequisites: [docker] }, result: null });
    expect(body.prerequisites).toHaveLength(1);
    expect(body.prerequisiteResult).toBeNull();
  });
});

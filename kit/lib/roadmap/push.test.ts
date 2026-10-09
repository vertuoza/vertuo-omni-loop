// PRD 1162, slice s6: where each PRD of a roadmap stands, and the body `omni roadmap push` sends.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, parsePr } from '../ids.ts';
import { makeRepo } from '../../test/fixture.ts';
import type { Roadmap, RoadmapPrerequisite, RoadmapRow } from './parse.ts';
import { prdState, prdTimes, readRoadmapPrds, roadmapPushBody, waitsOn, WAITS_ON_MAX } from './push.ts';
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
      prdWork: [],
    });
    expect(body).toEqual({
      humanWork: [],
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
  const plain = { repo: 'acme/widgets', document: '# the file\n', standings: new Map<string, PrdStanding>(), answers: new Map<string, string>(), prdWork: null };

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

  it('carries the unanswered person questions, then the PRDs\' work; no humanWork when it could not be read', () => {
    const park = { key: 'park:1201', prd: parsePrd(1201), repo: 'widgets', source: 'park' as const, text: 'waits on you', act: null, url: 'https://x/21', ruleKind: 'development' as const };
    const args = { repo: 'acme/widgets', roadmap, document: '', standings: new Map(), answers: new Map<string, string>(), prdWork: null };
    expect(roadmapPushBody({ ...args, prdWork: [park] }).humanWork).toEqual([
      { key: 'question:Q5', prd: 1202, repo: 'widgets', source: 'question', text: 'Trial week?', act: null, url: 'https://github.com/acme/widgets/issues/1200', ruleKind: 'business' },
      park,
    ]);
    expect(roadmapPushBody({ ...args, prdWork: null })).not.toHaveProperty('humanWork');
  });
});

// PRD 1217, slice s1: each PRD's human work, read through the `gh` and `git` handed in.
describe('readRoadmapPrds', () => {
  const OUTBOX = '.omni-loop/delivery/outbox/1201-alpha';
  const PLAN = '.omni-loop/delivery/inbox/1201-alpha/plan.md';
  const files = {
    '.omni-loop/delivery/inbox/1201-alpha/spec.md': 'spec\n',
    '.omni-loop/delivery/inbox/1202-beta/spec.md': 'spec\n',
  };

  const itemFile = (id: string, rank: string, question: string, steps = '') => [
    '---', `id: ${id}`, 'prd: 1201', `slice: ${id.split('-')[0]}`, `rank: ${rank}`, 'bears-on: none', 'raised: 2026-10-08', 'wave: 1', '---', '',
    '## The question, in plain words', '', question, '', '## The decision, in plain words', '', 'd', '',
    ...(rank === 'human-action' ? ['## What a person must do', '', steps, ''] : ['## The options, in plain words', '', 'A. One.', 'B. Two.', '']),
    '## What I had to decide', '', 'x', '', '## What I did meanwhile', '', 'y', '', '## What it costs to change later', '', 'z', '',
    '## What I could not know', '', '(author) w', '',
  ].join('\n');

  const comments = (list: Array<{ body: string; url?: string; createdAt: string }>) =>
    list.map((c) => JSON.stringify({ body: c.body, url: c.url ?? null, createdAt: c.createdAt })).join('\n');

  /** `gh` and `git` over one GitHub and one remote: PRD 1201's feature PR open with an outbox and a
   * park, PRD 1202 not started with a clarification asked. */
  function readers({ plan = '', crewPr = false, failComments = false } = {}) {
    const gh = (args: string[]) => {
      if (args[0] === 'pr') {
        const repo = args[args.indexOf('--repo') + 1];
        if (args[args.indexOf('--head') + 1] !== 'feat/alpha') return '[]';
        if (repo === 'acme/crew') return crewPr ? JSON.stringify([{ number: 9, url: 'https://github.com/acme/crew/pull/9', state: 'OPEN', isDraft: true, createdAt: '2026-10-02T00:00:00Z' }]) : '[]';
        return JSON.stringify([{ number: 21, url: 'https://github.com/acme/widgets/pull/21', state: 'OPEN', isDraft: true, createdAt: '2026-10-01T00:00:00Z' }]);
      }
      if (failComments) throw new Error('gh: 502');
      if (args[1] === 'repos/acme/widgets/issues/21/comments') {
        return comments([{ body: '<!-- omni-outbox-status -->\n**Agent status**\n\n- loop: parked · waits on Pierre: grant the app · https://github.com/acme/widgets/pull/21', createdAt: '2026-10-05T00:00:00Z' }]);
      }
      if (args[1] === 'repos/acme/widgets/issues/1202/comments') {
        return comments([{ body: '<!-- omni-needs-clarification -->\n1. Which tier?\n2. Who signs off?', url: 'https://github.com/acme/widgets/issues/1202#c1', createdAt: '2026-10-04T00:00:00Z' }]);
      }
      return '';
    };
    const shown = new Map<string, string>([
      [`origin/feat/alpha:${OUTBOX}/s1-01-key.md`, itemFile('s1-01-key', 'human-action', 'The repository has no deploy key.', '1. Add `DEPLOY_KEY` to the repository secrets.')],
      [`origin/feat/alpha:${OUTBOX}/s2-01-shape.md`, itemFile('s2-01-shape', 'high', 'Which cache shape?')],
      [`origin/feat/alpha:${OUTBOX}/s2-02-name.md`, itemFile('s2-02-name', 'medium', 'Which name?')],
      [`origin/feat/alpha:${PLAN}`, plan],
    ]);
    const git = (args: string[]) => {
      if (args[0] === 'ls-tree') return [...shown.keys()].map((key) => key.slice(key.indexOf(':') + 1)).filter((path) => path.startsWith(OUTBOX)).join('\n');
      if (args[0] !== 'show') return '';
      const text = shown.get(args[1] ?? '');
      if (!text) throw new Error('not on the branch');
      return text;
    };
    return { gh, git };
  }

  const roadmap: Roadmap = {
    roadmap: parseIssue(1200), title: 'Crew', milestone: 'm', product: null, target: null, source: null, repos: false,
    prds: [row('P1', 1201), row('P2', 1202, ['P1'])],
    questions: [],
  };

  it('reads, in a single repository, the open PR\'s human-action and high items, its park, and a clarification', () => {
    const { ctx } = makeRepo({ files });
    const { standings, prdWork } = readRoadmapPrds(ctx, roadmap, readers());
    expect(standings.get('P1')?.prs.map((p) => p.number)).toEqual([21]);
    expect(prdWork).toEqual([
      { key: 'outbox:1201/s1-01-key', prd: 1201, repo: 'widgets', source: 'outbox', text: 'The repository has no deploy key.', act: '1. Add `DEPLOY_KEY` to the repository secrets.', url: 'https://github.com/acme/widgets/pull/21', ruleKind: 'dev-ops' },
      { key: 'outbox:1201/s2-01-shape', prd: 1201, repo: 'widgets', source: 'outbox', text: 'Which cache shape?', act: null, url: 'https://github.com/acme/widgets/pull/21', ruleKind: 'development' },
      { key: 'park:1201', prd: 1201, repo: 'widgets', source: 'park', text: 'waits on Pierre: grant the app', act: null, url: 'https://github.com/acme/widgets/pull/21', ruleKind: 'dev-ops' },
      { key: 'clarification:1202', prd: 1202, repo: 'widgets', source: 'clarification', text: 'Which tier?', act: 'Who signs off?', url: 'https://github.com/acme/widgets/issues/1202#c1', ruleKind: 'development' },
    ]);
  });

  it('names, in a plan repository, the repository each item\'s slice lands in', () => {
    const plan = [
      '| id | repo | slice | territory | blocked by | wave |', '| --- | --- | --- | --- | --- | --- |',
      '| s1 | widgets | one | `a/` | — | 1 |', '| s2 | crew | two | `b/` | — | 1 |',
    ].join('\n');
    const { ctx } = makeRepo({ files: { ...files, [PLAN]: plan }, config: { plan: { targets: [{ repo: 'acme/crew', role: 'back-end', knowledge: 'none' }] } } });
    const rm: Roadmap = { ...roadmap, repos: true, prds: [row('P1', 1201, [], { repos: ['widgets', 'crew'] })] };
    const { prdWork } = readRoadmapPrds(ctx, rm, readers({ plan, crewPr: true }));
    expect(prdWork?.filter((w) => w.source === 'outbox').map((w) => [w.key, w.repo])).toEqual([
      ['outbox:1201/s1-01-key', 'widgets'],
      ['outbox:1201/s2-01-shape', 'crew'],
    ]);
  });

  it('reads no clarification once a plan was committed after it, and no work at all when a read fails', () => {
    const { ctx } = makeRepo({ files: { ...files, '.omni-loop/delivery/inbox/1202-beta/plan.md': 'plan\n' } });
    const r = readers();
    const git = (args: string[]) => (args[0] === 'log' ? '2026-10-06T00:00:00+02:00\n' : r.git(args));
    expect(readRoadmapPrds(ctx, roadmap, { gh: r.gh, git }).prdWork?.some((w) => w.source === 'clarification')).toBe(false);
    const failing = readRoadmapPrds(ctx, roadmap, readers({ failComments: true }));
    expect(failing.prdWork).toBeNull();
    expect(failing.standings.size).toBe(2);
  });
});

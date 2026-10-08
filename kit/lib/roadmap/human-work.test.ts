// PRD 1217, slice s1: a roadmap's human work, read from its four sources, each with its rule kind.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePrd } from '../ids.ts';
import { parseOutboxItem } from '../outbox/outbox.ts';
import type { OutboxItem } from '../types.ts';
import {
  ACT_MAX, CLARIFICATION_MARKER, TEXT_MAX, clarificationWork, outboxWork, parkOf, parkWork, questionWork, ruleKind,
} from './human-work.ts';
import type { Roadmap, RoadmapRow } from './parse.ts';

const PRD = parsePrd(1201);

describe('ruleKind', () => {
  it('reads every question as business, whatever its words', () => {
    expect(ruleKind('question', 'Which secret do we deploy to production?', null)).toBe('business');
  });

  it('reads a missing right as dev-ops: secret, token, scope, permission, grant, access, branch protection', () => {
    for (const word of ['secret', 'Token', 'SCOPE', 'permission', 'grant', 'access', 'branch protection', 'secrets', 'permissions']) {
      expect(ruleKind('outbox', `Add the ${word} here`, null), word).toBe('dev-ops');
    }
    expect(ruleKind('park', 'waits on you', 'Grant the app the repository')).toBe('dev-ops');
  });

  it('reads a production step as delivery-ops: deploy, production, prod, migration run, console, environment variable', () => {
    for (const word of ['deploy', 'production', 'prod', 'migration run', 'console', 'environment variable', 'Environment variables']) {
      expect(ruleKind('outbox', `Do the ${word} step`, null), word).toBe('delivery-ops');
    }
    expect(ruleKind('clarification', 'Which one?', 'Then deploy it')).toBe('delivery-ops');
  });

  it('tries dev-ops before delivery-ops', () => {
    expect(ruleKind('outbox', 'Set the production secret', null)).toBe('dev-ops');
  });

  it('matches whole words only, and reads anything else as development', () => {
    expect(ruleKind('outbox', 'Which layout? the tokenizer, a deployment-free product, the accessory', null)).toBe('development');
    expect(ruleKind('outbox', 'Pick the cache shape', null)).toBe('development');
    expect(ruleKind('park', 'waits on you: a migration', null)).toBe('development');
  });
});

function row(id: string, prd: number): RoadmapRow {
  return { id, prd: parsePrd(prd), title: `PRD ${prd}`, repos: null, blockedBy: [], why: null, wave: 1 };
}

describe('questionWork', () => {
  const roadmap: Pick<Roadmap, 'questions' | 'prds'> = {
    prds: [row('P1', 1201), row('P2', 1202)],
    questions: [
      { id: 'Q1', question: 'Which default?', recommendation: 'The first', blocks: ['P1'], kind: 'default' },
      { id: 'Q2', question: 'Trial  week\nor month?', recommendation: 'A week', blocks: ['P9', 'P2'], kind: 'person' },
      { id: 'Q3', question: 'Who pays?', recommendation: '—', blocks: [], kind: 'person' },
      { id: 'Q4', question: 'Answered?', recommendation: '', blocks: ['P1'], kind: 'person' },
    ],
  };

  it('turns each unanswered person question into a business entry linking the roadmap issue', () => {
    const work = questionWork(roadmap, new Map([['Q4', 'yes']]), { repo: 'widgets', issueUrl: 'https://github.com/acme/widgets/issues/1200' });
    expect(work).toEqual([
      { key: 'question:Q2', prd: 1202, repo: 'widgets', source: 'question', text: 'Trial week or month?', act: 'A week', url: 'https://github.com/acme/widgets/issues/1200', ruleKind: 'business' },
      { key: 'question:Q3', prd: null, repo: 'widgets', source: 'question', text: 'Who pays?', act: null, url: 'https://github.com/acme/widgets/issues/1200', ruleKind: 'business' },
    ]);
  });
});

/** An outbox item as `omni item new` writes it. */
function item(id: string, rank: string, sections: { question?: string; steps?: string } = {}): OutboxItem {
  const body = rank === 'human-action'
    ? ['## What a person must do', '', sections.steps ?? '1. Add the secret.', '']
    : ['## The options, in plain words', '', 'A. One.', 'B. Two.', ''];
  const text = [
    '---', `id: ${id}`, `prd: ${PRD}`, `slice: ${id.split('-')[0]}`, `rank: ${rank}`, 'bears-on: none', 'raised: 2026-10-08', 'wave: 1', '---', '',
    '## The question, in plain words', '', sections.question ?? `Which way for ${id}?`, '',
    '## The decision, in plain words', '', 'The first way.', '',
    ...body,
    '## What I had to decide', '', 'x', '', '## What I did meanwhile', '', 'y', '',
    '## What it costs to change later', '', 'z', '', '## What I could not know', '', '(author) w', '',
  ].join('\n');
  const parsed = parseOutboxItem(text, { file: `${id}.md` });
  if (!parsed.ok) throw new Error(parsed.errors.join('; '));
  return parsed.item;
}

describe('outboxWork', () => {
  it('keeps human-action and high items, a human action\'s steps word for word as its act', () => {
    const items = [
      item('s1-01-key', 'human-action', { question: 'The deploy key is missing.', steps: '1. Add `DEPLOY_KEY` to the repository secrets.\n2. Rerun the check.' }),
      item('s2-01-shape', 'high', { question: 'Which cache shape?' }),
      item('s2-02-name', 'medium'),
    ];
    const work = outboxWork(PRD, items, { repoOf: (it) => (it.slice === 's2' ? 'crew' : 'widgets'), url: 'https://github.com/acme/widgets/pull/21' });
    expect(work).toEqual([
      { key: 'outbox:1201/s1-01-key', prd: 1201, repo: 'widgets', source: 'outbox', text: 'The deploy key is missing.', act: '1. Add `DEPLOY_KEY` to the repository secrets.\n2. Rerun the check.', url: 'https://github.com/acme/widgets/pull/21', ruleKind: 'dev-ops' },
      { key: 'outbox:1201/s2-01-shape', prd: 1201, repo: 'crew', source: 'outbox', text: 'Which cache shape?', act: null, url: 'https://github.com/acme/widgets/pull/21', ruleKind: 'development' },
    ]);
  });

  it('gives no entry once nothing is open', () => {
    expect(outboxWork(PRD, [], { repoOf: () => 'widgets', url: null })).toEqual([]);
  });
});

describe('the caps the app takes', () => {
  it('cuts a text over TEXT_MAX and an act over ACT_MAX with an ellipsis, the rule kind read on the whole', () => {
    const [work] = parkWork(PRD, `- loop: parked · ${'a'.repeat(TEXT_MAX + 50)} secret`, { repo: 'widgets', prUrl: null });
    expect(work?.text).toHaveLength(TEXT_MAX);
    expect(work?.text.endsWith('…')).toBe(true);
    expect(work?.ruleKind).toBe('dev-ops');
    const item = { id: 's1-01-x', rank: 'human-action', sections: { personSteps: 'b'.repeat(ACT_MAX + 1) } } as unknown as OutboxItem;
    const [action] = outboxWork(PRD, [item], { repoOf: () => 'widgets', url: null });
    expect(action?.act).toHaveLength(ACT_MAX);
    expect(action?.act?.endsWith('…')).toBe(true);
  });
});

describe('parkOf and parkWork', () => {
  const status = ['<!-- omni-outbox-status -->', '**Agent status**', '', '- state: done', '- loop: parked · waits on Pierre: answer 2 questions · https://github.com/acme/widgets/pull/21'].join('\n');

  it('reads the why and the link of the park line', () => {
    expect(parkOf(status)).toEqual({ why: 'waits on Pierre: answer 2 questions', link: 'https://github.com/acme/widgets/pull/21' });
    expect(parkOf('- loop: parked · waits on you: a · b')).toEqual({ why: 'waits on you: a · b', link: null });
    expect(parkOf('- state: done')).toBeNull();
  });

  it('turns a parked PRD into one entry linking its feature PR; none when not parked', () => {
    expect(parkWork(PRD, status, { repo: 'widgets', prUrl: 'https://x/pr/21' })).toEqual([
      { key: 'park:1201', prd: 1201, repo: 'widgets', source: 'park', text: 'waits on Pierre: answer 2 questions', act: null, url: 'https://x/pr/21', ruleKind: 'development' },
    ]);
    expect(parkWork(PRD, '- state: done', { repo: 'widgets', prUrl: null })).toEqual([]);
    expect(parkWork(PRD, null, { repo: 'widgets', prUrl: null })).toEqual([]);
  });
});

describe('clarificationWork', () => {
  const ask = (createdAt: string, lines: string[], url = `https://x/issues/1201#${createdAt}`) =>
    ({ body: [CLARIFICATION_MARKER, ...lines].join('\n'), url, createdAt });

  it('reads the latest marked comment: its first question as the text, the others as the act', () => {
    const comments = [
      ask('2026-10-01T09:00:00Z', ['1. Old question?']),
      { body: 'A person\'s reply', url: null, createdAt: '2026-10-03T09:00:00Z' },
      ask('2026-10-02T09:00:00Z', ['Two gaps:', '', '1. Which plan tier?', '2) Who signs off?', '3. When?'], 'https://x/c/2'),
    ];
    expect(clarificationWork(PRD, comments, { repo: 'widgets', planAt: null })).toEqual([
      { key: 'clarification:1201', prd: 1201, repo: 'widgets', source: 'clarification', text: 'Which plan tier?', act: 'Who signs off?\nWhen?', url: 'https://x/c/2', ruleKind: 'development' },
    ]);
  });

  it('reads the first line when nothing is numbered, with no act', () => {
    const work = clarificationWork(PRD, [ask('2026-10-02T09:00:00Z', ['', 'Is the console step ours?'])], { repo: 'widgets', planAt: null });
    expect(work.map(({ text, act, ruleKind: kind }) => ({ text, act, kind }))).toEqual([{ text: 'Is the console step ours?', act: null, kind: 'delivery-ops' }]);
  });

  it('is done once a plan was committed after it, and reads none without the marker', () => {
    const comments = [ask('2026-10-02T09:00:00Z', ['1. Which?'])];
    expect(clarificationWork(PRD, comments, { repo: 'widgets', planAt: '2026-10-03T00:00:00Z' })).toEqual([]);
    expect(clarificationWork(PRD, comments, { repo: 'widgets', planAt: '2026-10-01T00:00:00Z' })).toHaveLength(1);
    expect(clarificationWork(PRD, [{ body: 'needs clarification\n1. Which?', url: null, createdAt: '2026-10-02T09:00:00Z' }], { repo: 'widgets', planAt: null })).toEqual([]);
  });

  it('is the marker /omni:plan opens its comment with, and /omni:ultra-yolo names', () => {
    const skill = (name: string) => readFileSync(fileURLToPath(new URL(`../../plugin/skills/${name}/SKILL.md`, import.meta.url)), 'utf8');
    expect(skill('plan')).toContain(`the file's first line is exactly\n\`${CLARIFICATION_MARKER}\``);
    expect(skill('ultra-yolo')).toContain(`\`${CLARIFICATION_MARKER}\``);
  });
});

import { describe, expect, it } from 'vitest';
import { parseRoadmap, roadmapWaves } from './parse.ts';

function roadmapMd({
  front = ['roadmap: 1200', 'title: Crew — from skeleton to earned autonomy', 'milestone: A company grants its first mandate.'],
  prds = [
    '| id | PRD | title | blocked by | why | wave |',
    '|---|---|---|---|---|---|',
    '| P1.1 | #1201 | Crew API skeleton | – | – | 1 |',
    '| P3.4 | #1213 | Think endpoint | P1.1 | the worker calls it | 2 |',
  ],
  questions = [] as string[],
}: { front?: string[]; prds?: string[] | null; questions?: string[] } = {}): string {
  return [
    '---',
    ...front,
    '---',
    '',
    ...(prds === null ? [] : ['## PRDs', '', ...prds, '']),
    ...questions,
    '',
  ].join('\n');
}

const QUESTIONS = [
  '## Open questions',
  '',
  '| id | question | recommendation | blocks | kind |',
  '|---|---|---|---|---|',
  '| Q2 | Which queue? | The managed one | P1.1, P3.4 | default |',
  '| Q5 | Who signs the mandate? | The owner | P3.4 | person |',
];

describe('parseRoadmap', () => {
  it('reads the front matter, its optional fields absent', () => {
    const parsed = parseRoadmap(roadmapMd());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.roadmap).toMatchObject({
      roadmap: 1200,
      title: 'Crew — from skeleton to earned autonomy',
      milestone: 'A company grants its first mandate.',
      product: null,
      target: null,
      source: null,
      repos: false,
      questions: [],
    });
  });

  it('reads the optional product, target and source', () => {
    const parsed = parseRoadmap(
      roadmapMd({
        front: ['roadmap: 1200', 'title: T', 'milestone: M', 'product: Vertuoza Crew', 'target: 2027-03-31', 'source: https://example.com/plan'],
      }),
    );
    expect(parsed.ok && parsed.roadmap).toMatchObject({ product: 'Vertuoza Crew', target: '2027-03-31', source: 'https://example.com/plan' });
  });

  it('refuses a missing field, an unknown field, a bad number and a bad date, each by name', () => {
    const parsed = parseRoadmap(roadmapMd({ front: ['roadmap: twelve', 'title: T', 'target: soon', 'owner: me'] }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^front matter: unexpected field "owner"/),
        expect.stringMatching(/^front matter: roadmap is "twelve"/),
        expect.stringMatching(/^front matter: no "milestone" field\.$/),
        expect.stringMatching(/^front matter: target is "soon": .*YYYY-MM-DD/),
      ]),
    );
  });

  it('refuses a file with no front matter', () => {
    expect(parseRoadmap('## PRDs\n')).toEqual({ ok: false, errors: [expect.stringMatching(/^no front matter/)] });
  });

  it('reads the PRDs table without repos: blockers, why and waves, a dash meaning none', () => {
    const parsed = parseRoadmap(roadmapMd());
    expect(parsed.ok && parsed.roadmap.prds).toEqual([
      { id: 'P1.1', prd: 1201, title: 'Crew API skeleton', repos: null, blockedBy: [], why: null, wave: 1 },
      { id: 'P3.4', prd: 1213, title: 'Think endpoint', repos: null, blockedBy: ['P1.1'], why: 'the worker calls it', wave: 2 },
    ]);
  });

  it('reads the PRDs table with repos, each a comma-separated list', () => {
    const parsed = parseRoadmap(
      roadmapMd({
        prds: [
          '| id | PRD | title | repos | blocked by | why | wave |',
          '|---|---|---|---|---|---|---|',
          '| P1.1 | #1201 | Skeleton | crew, ai-domain | — | — | 1 |',
          '| P1.2 | #1202 | Next | crew | P1.1 | it builds on it | 2 |',
        ],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.roadmap.repos).toBe(true);
    expect(parsed.roadmap.prds.map((row) => row.repos)).toEqual([['crew', 'ai-domain'], ['crew']]);
  });

  it('reads the Open questions table with default and person questions', () => {
    const parsed = parseRoadmap(roadmapMd({ questions: QUESTIONS }));
    expect(parsed.ok && parsed.roadmap.questions).toEqual([
      { id: 'Q2', question: 'Which queue?', recommendation: 'The managed one', blocks: ['P1.1', 'P3.4'], kind: 'default' },
      { id: 'Q5', question: 'Who signs the mandate?', recommendation: 'The owner', blocks: ['P3.4'], kind: 'person' },
    ]);
  });

  it('reads an Open questions section with no table as no question', () => {
    const parsed = parseRoadmap(roadmapMd({ questions: ['## Open questions', '', 'None yet.'] }));
    expect(parsed.ok && parsed.roadmap.questions).toEqual([]);
  });

  it('refuses a missing PRDs section, a section with no table and a missing column', () => {
    expect(parseRoadmap(roadmapMd({ prds: null }))).toEqual({ ok: false, errors: ['sections: no "## PRDs" section.'] });
    expect(parseRoadmap(roadmapMd({ prds: ['Nothing yet.'] }))).toEqual({ ok: false, errors: [expect.stringMatching(/^PRDs: no table/)] });
    const missing = parseRoadmap(roadmapMd({ prds: ['| id | PRD | title | blocked by | wave |', '|---|---|---|---|---|', '| P1 | #1 | T | – | 1 |'] }));
    expect(missing).toEqual({ ok: false, errors: ['PRDs: the table has no "why" column.'] });
  });

  it('refuses a bad id, PRD cell, title, wave and blocker, naming the row', () => {
    const parsed = parseRoadmap(
      roadmapMd({
        prds: [
          '| id | PRD | title | blocked by | why | wave |',
          '|---|---|---|---|---|---|',
          '| P 1 | #1 | T | – | – | 1 |',
          '| P2 | 1202 | T | – | – | 1 |',
          '| P3 | #1203 |  | – | – | 0 |',
          '| P4 | #1204 | T | P 1 | x | 2 |',
          '|  | #1205 | T | – | – | 1 |',
        ],
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual([
      'PRDs: P 1 has the id "P 1", which is empty or holds a space, a comma or a pipe.',
      'PRDs: P2 has the PRD cell "1202", not #<number>.',
      'PRDs: P3 has no title.',
      'PRDs: P3 has the wave "0", not a positive whole number.',
      'PRDs: P4 is blocked by "P 1", which is no id.',
      'PRDs: row 5 has the id "", which is empty or holds a space, a comma or a pipe.',
    ]);
  });

  it('refuses a question with a bad kind, no question or a bad id, naming it', () => {
    const parsed = parseRoadmap(
      roadmapMd({
        questions: [
          '## Open questions',
          '| id | question | recommendation | blocks | kind |',
          '|---|---|---|---|---|',
          '| Q1 | Which? | This | P1.1 | maybe |',
          '| Q2 |  | This | P1 1 | person |',
        ],
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual([
      'Open questions: Q1 has the kind "maybe", not one of default, person.',
      'Open questions: Q2 asks nothing: its question is empty.',
      'Open questions: Q2 blocks "P1 1", which is no id.',
    ]);
  });

  it('refuses an Open questions table missing a column', () => {
    const parsed = parseRoadmap(roadmapMd({ questions: ['## Open questions', '| id | question | blocks | kind |', '|---|---|---|---|'] }));
    expect(parsed).toEqual({ ok: false, errors: ['Open questions: the table has no "recommendation" column.'] });
  });

  it('groups the rows by wave, in order', () => {
    const parsed = parseRoadmap(roadmapMd());
    if (!parsed.ok) throw new Error('parses');
    expect(roadmapWaves(parsed.roadmap).map(({ wave, rows }) => [wave, rows.map((row) => row.id)])).toEqual([
      [1, ['P1.1']],
      [2, ['P3.4']],
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { PREREQUISITE_CATEGORIES, PREREQUISITE_WHO, parseRoadmap, roadmapWaves } from './parse.ts';

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

/** A roadmap with a Prerequisites section made of `lines`. */
const withPrerequisites = (lines: string[]): string => roadmapMd({ questions: [...QUESTIONS, '', '## Prerequisites', '', ...lines] });

const PREREQUISITES = [
  '| id | category | need | check | fix | blocks | who |',
  '|---|---|---|---|---|---|---|',
  '| p1 | local | Docker is running, for the database tests | `base:docker` | | P3.4 | check |',
  '| p2 | access | the `@vertuoza/ui` package installs | `npm view @vertuoza/ui version` | – | all | check |',
  '| p3 | permissions | the Vercel preview has `DATABASE_URL` | | | P1.1, P3.4 | person |',
  '| p4 | access | the dependencies install | `base:install` | `base:install` | all | agent |',
  '',
  '### p1',
  '',
  '- **Why:** The tests start a database in Docker.',
  '  Without Docker running, no slice can merge.',
  '- **Command:** `open -a Docker`',
  '- **What it does:** Starts the Docker app on your Mac.',
  '- **Who can do it:** Anyone with this laptop.',
  '',
  '### p3',
  '',
  '- **Why:** The preview needs its database.',
  '- **What it does:** Opens the project settings.',
];

describe('parseRoadmap — prerequisites', () => {
  it('knows the categories and the who of spec section 1', () => {
    expect(PREREQUISITE_CATEGORIES).toEqual(['local', 'access', 'permissions', 'github', 'services']);
    expect(PREREQUISITE_WHO).toEqual(['agent', 'check', 'person']);
  });

  it('reads a roadmap without the section as no prerequisite', () => {
    const parsed = parseRoadmap(roadmapMd());
    expect(parsed.ok && parsed.roadmap.prerequisites).toEqual([]);
  });

  it('reads the table, its cells unquoted, all and lists, and each card by id', () => {
    const parsed = parseRoadmap(withPrerequisites(PREREQUISITES));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.roadmap.prerequisites).toEqual([
      {
        id: 'p1',
        category: 'local',
        need: 'Docker is running, for the database tests',
        check: 'base:docker',
        fix: null,
        blocks: ['P3.4'],
        who: 'check',
        repos: null,
        card: {
          why: 'The tests start a database in Docker. Without Docker running, no slice can merge.',
          command: 'open -a Docker',
          whatItDoes: 'Starts the Docker app on your Mac.',
          whoCanDoIt: 'Anyone with this laptop.',
        },
      },
      { id: 'p2', category: 'access', need: 'the `@vertuoza/ui` package installs', check: 'npm view @vertuoza/ui version', fix: null, blocks: 'all', who: 'check', repos: null, card: null },
      {
        id: 'p3',
        category: 'permissions',
        need: 'the Vercel preview has `DATABASE_URL`',
        check: null,
        fix: null,
        blocks: ['P1.1', 'P3.4'],
        who: 'person',
        repos: null,
        card: { why: 'The preview needs its database.', command: null, whatItDoes: 'Opens the project settings.', whoCanDoIt: null },
      },
      { id: 'p4', category: 'access', need: 'the dependencies install', check: 'base:install', fix: 'base:install', blocks: 'all', who: 'agent', repos: null, card: null },
    ]);
  });

  it('reads a repos cell when the table has the column', () => {
    const parsed = parseRoadmap(
      withPrerequisites([
        '| id | category | need | check | fix | blocks | who | repos |',
        '|---|---|---|---|---|---|---|---|',
        '| p1 | local | Docker | `base:docker` | | all | agent | crew, ai-domain |',
      ]),
    );
    expect(parsed.ok && parsed.roadmap.prerequisites?.map((row) => row.repos)).toEqual([['crew', 'ai-domain']]);
  });

  it('reads a Prerequisites section with no table as no prerequisite', () => {
    const parsed = parseRoadmap(withPrerequisites(['None yet.']));
    expect(parsed.ok && parsed.roadmap.prerequisites).toEqual([]);
  });

  it('refuses a table missing a column', () => {
    const parsed = parseRoadmap(withPrerequisites(['| id | category | need | check | blocks | who |', '|---|---|---|---|---|---|']));
    expect(parsed).toEqual({ ok: false, errors: ['Prerequisites: the table has no "fix" column.'] });
  });

  it('refuses an unknown category or who, an empty need, a bad id, a bad blocks entry and a card of no row, naming each', () => {
    const parsed = parseRoadmap(
      withPrerequisites([
        '| id | category | need | check | fix | blocks | who |',
        '|---|---|---|---|---|---|---|',
        '| p1 | laptop | Docker | | | all | check |',
        '| p2 | local | Node | | | all | robot |',
        '| p3 | local |  | | | all | person |',
        '| p 4 | local | pnpm | | | all | person |',
        '| p5 | local | git | | | P1 1 | person |',
        '',
        '### p9',
        '- **Why:** Nothing.',
      ]),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual([
      'Prerequisites: p1 has the category "laptop", not one of local, access, permissions, github, services.',
      'Prerequisites: p2 has the who "robot", not one of agent, check, person.',
      'Prerequisites: p3 needs nothing: its need is empty.',
      'Prerequisites: p 4 has the id "p 4", which is empty or holds a space, a comma or a pipe.',
      'Prerequisites: p5 blocks "P1 1", which is no id.',
      'Prerequisites: the card "### p9" is for no row of the table.',
    ]);
  });
});

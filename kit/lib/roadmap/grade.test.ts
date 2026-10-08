import { describe, expect, it } from 'vitest';
import { parsePrd } from '../ids.ts';
import type { PrdNumber } from '../ids.ts';
import { PREREQUISITE_BASE_CHECKS, PREREQUISITE_BASE_FIXES, gradeRoadmap } from './grade.ts';
import type { PrdFacts, RoadmapTarget } from './grade.ts';
import { parseRoadmap } from './parse.ts';
import type { Roadmap } from './parse.ts';

/** A roadmap from its PRD rows (`id | PRD | title | [repos |] blocked by | why | wave`) and its questions. */
function roadmap(rows: string[], { repos = false, questions = [] as string[], prerequisites = [] as string[] } = {}): Roadmap {
  const header = repos ? '| id | PRD | title | repos | blocked by | why | wave |' : '| id | PRD | title | blocked by | why | wave |';
  const text = [
    '---',
    'roadmap: 1200',
    'title: T',
    'milestone: M',
    '---',
    '## PRDs',
    header,
    repos ? '|---|---|---|---|---|---|---|' : '|---|---|---|---|---|---|',
    ...rows,
    '',
    ...(questions.length > 0 ? ['## Open questions', '| id | question | recommendation | blocks | kind |', '|---|---|---|---|---|', ...questions] : []),
    '',
    ...(prerequisites.length > 0 ? ['## Prerequisites', '| id | category | need | check | fix | blocks | who |', '|---|---|---|---|---|---|---|', ...prerequisites] : []),
    '',
  ].join('\n');
  const parsed = parseRoadmap(text);
  if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
  return parsed.roadmap;
}

/** Each PRD's spec, as `{ prd: blockers }`; a PRD left out has no folder. */
function specs(blockers: Record<number, number[] | 'unreadable'>): (prd: PrdNumber) => PrdFacts {
  return (prd) => {
    const facts = blockers[prd];
    if (facts === undefined) return 'no-folder';
    if (facts === 'unreadable') return 'unreadable';
    return { blockedBy: facts.length === 0 ? 'none' : facts.map(parsePrd) };
  };
}

const ONE_REPO = [
  '| P1 | #1201 | Skeleton | – | – | 1 |',
  '| P2 | #1202 | Worker | P1 | it runs on the skeleton | 2 |',
  '| P3 | #1203 | Think | P1, P2 | the worker calls it | 3 |',
];
const ONE_REPO_SPECS = specs({ 1201: [], 1202: [1201], 1203: [1201, 1202] });

describe('gradeRoadmap — one repository', () => {
  it('passes a green roadmap', () => {
    const graded = gradeRoadmap(roadmap(ONE_REPO, { questions: ['| Q1 | Which? | This | P2, P3 | person |'] }), { prdFacts: ONE_REPO_SPECS, targets: null });
    expect(graded).toEqual([]);
  });

  it('refuses an id used twice', () => {
    const graded = gradeRoadmap(roadmap([...ONE_REPO, '| P1 | #1204 | Again | – | – | 1 |']), {
      prdFacts: specs({ 1201: [], 1202: [1201], 1203: [1201, 1202], 1204: [] }),
      targets: null,
    });
    expect(graded).toEqual(['P1: the id is used twice.']);
  });

  it('refuses a blocker that is not a row', () => {
    const graded = gradeRoadmap(roadmap(['| P1 | #1201 | Skeleton | P9 | it needs it | 2 |']), { prdFacts: specs({ 1201: [] }), targets: null });
    expect(graded).toContain('P1: blocked by P9, which is not a row of the roadmap.');
  });

  it('refuses a cycle, naming the rows it runs through', () => {
    const graded = gradeRoadmap(
      roadmap(['| P1 | #1201 | A | P2 | b first | 2 |', '| P2 | #1202 | B | P1 | a first | 3 |']),
      { prdFacts: specs({ 1201: [1202], 1202: [1201] }), targets: null },
    );
    expect(graded.filter((line) => line.includes('cycle'))).toEqual(['P1: a cycle — P1 → P2 → P1.']);
  });

  it('refuses a wave that does not follow its blockers, either way', () => {
    const graded = gradeRoadmap(
      roadmap(['| P1 | #1201 | A | – | – | 2 |', '| P2 | #1202 | B | P1 | a first | 2 |', '| P3 | #1203 | C | P2 | b first | 5 |']),
      { prdFacts: specs({ 1201: [], 1202: [1201], 1203: [1202] }), targets: null },
    );
    expect(graded).toEqual([
      'P1: in wave 2, but it has no blocker, so its wave is 1.',
      'P2: in wave 2, but its highest blocker, P1, is in wave 2, so its wave is 3.',
      'P3: in wave 5, but its highest blocker, P2, is in wave 2, so its wave is 3.',
    ]);
  });

  it('refuses a blocker without its why', () => {
    const graded = gradeRoadmap(roadmap(['| P1 | #1201 | A | – | – | 1 |', '| P2 | #1202 | B | P1 | — | 2 |']), {
      prdFacts: specs({ 1201: [], 1202: [1201] }),
      targets: null,
    });
    expect(graded).toEqual(['P2: blocked by P1 with no why — every blocker says why it blocks.']);
  });

  it('refuses a row without its PRD folder, and one whose spec does not parse', () => {
    const graded = gradeRoadmap(roadmap(ONE_REPO), { prdFacts: specs({ 1201: [], 1202: 'unreadable' }), targets: null });
    expect(graded).toEqual([
      "P2: PRD #1202's spec does not parse, so its blocked-by cannot be compared.",
      'P3: PRD #1203 has no inbox or shipped folder.',
    ]);
  });

  it("refuses a spec whose blocked-by differs from the row's blockers", () => {
    const graded = gradeRoadmap(roadmap(ONE_REPO), { prdFacts: specs({ 1201: [1999], 1202: [1201], 1203: [1201] }), targets: null });
    expect(graded).toEqual([
      "P1: PRD #1201's spec is blocked by #1999, but its row by none.",
      "P3: PRD #1203's spec is blocked by #1201, but its row by #1201, #1202.",
    ]);
  });

  it('refuses a question blocking a row that does not exist', () => {
    const graded = gradeRoadmap(roadmap(ONE_REPO, { questions: ['| Q2 | Which? | This | P1, P7 | default |'] }), { prdFacts: ONE_REPO_SPECS, targets: null });
    expect(graded).toEqual(['Q2: blocks P7, which is not a row of the roadmap.']);
  });

  it('refuses a repos column outside a plan repository', () => {
    const graded = gradeRoadmap(roadmap(['| P1 | #1201 | A | crew | – | – | 1 |'], { repos: true }), { prdFacts: specs({ 1201: [] }), targets: null });
    expect(graded).toEqual(['PRDs: a repos column needs a plan repository (a config with plan.targets).']);
  });
});

const TARGETS: RoadmapTarget[] = [
  { repo: 'vertuoza/crew', consumes: ['ai-domain'] },
  { repo: 'vertuoza/ai-domain' },
  { repo: 'vertuoza/backend-php', readOnly: true },
];

describe('gradeRoadmap — a plan repository', () => {
  const rows = [
    '| P1.1 | #1201 | Skeleton | crew | – | – | 1 |',
    '| P3.4 | #1213 | Think | ai-domain | P1.1 | the worker calls it | 2 |',
    '| P4.1 | #1214 | Install the SDK | crew | P3.4 | it installs the published SDK | 3 |',
  ];
  const facts = specs({ 1201: [], 1213: [1201], 1214: [1213] });

  it('passes a green roadmap across repositories', () => {
    expect(gradeRoadmap(roadmap(rows, { repos: true }), { prdFacts: facts, targets: TARGETS })).toEqual([]);
  });

  it('refuses a roadmap with no repos column', () => {
    const graded = gradeRoadmap(roadmap(['| P1 | #1201 | A | – | – | 1 |']), { prdFacts: specs({ 1201: [] }), targets: TARGETS });
    expect(graded).toEqual(['PRDs: the table has no "repos" column; in a plan repository each row names its repositories.']);
  });

  it('refuses a row naming no repository, a repo that is not a target and a read-only repo', () => {
    const graded = gradeRoadmap(
      roadmap(['| P1 | #1201 | A | – | – | – | 1 |', '| P2 | #1202 | B | erp, backend-php | – | – | 1 |'], { repos: true }),
      { prdFacts: specs({ 1201: [], 1202: [] }), targets: TARGETS },
    );
    expect(graded).toEqual([
      'P1: names no repository.',
      'P2: erp is not a target of plan.targets (crew, ai-domain, backend-php).',
      'P2: backend-php is a read-only target — no roadmap row may name it.',
    ]);
  });

  it('refuses a consumer PRD in a wave not after the provider PRD it waits on', () => {
    const graded = gradeRoadmap(
      roadmap(
        [
          '| P3.4 | #1213 | Think | ai-domain | – | – | 1 |',
          '| P3.5 | #1215 | Docs | ai-domain | P3.4 | it documents it | 2 |',
          '| P4.1 | #1214 | Install the SDK | crew | P3.5 | it installs the published SDK | 2 |',
        ],
        { repos: true },
      ),
      { prdFacts: specs({ 1213: [], 1215: [1213], 1214: [1215] }), targets: TARGETS },
    );
    expect(graded).toContain(
      'P4.1: changes crew, which consumes ai-domain, in wave 2, not after P3.5 (wave 2) that changes ai-domain and that it waits on.',
    );
  });

  it('passes a consumer PRD and a provider PRD side by side when neither waits on the other', () => {
    const graded = gradeRoadmap(
      roadmap(['| P1 | #1201 | Crew | crew | – | – | 1 |', '| P2 | #1202 | SDK | ai-domain | – | – | 1 |'], { repos: true }),
      { prdFacts: specs({ 1201: [], 1202: [] }), targets: TARGETS },
    );
    expect(graded).toEqual([]);
  });
});

/** A card for `id`, with every line but those named in `without`. */
function card(id: string, without: string[] = []): string[] {
  const lines: [string, string][] = [
    ['Why', 'The tests need it.'],
    ['Command', '`open -a Docker`'],
    ['What it does', 'Starts Docker.'],
    ['Who can do it', 'Anyone with this laptop.'],
  ];
  return ['', `### ${id}`, ...lines.filter(([label]) => !without.includes(label)).map(([label, text]) => `- **${label}:** ${text}`)];
}

/** The ONE_REPO roadmap with these prerequisite rows and cards, graded. */
const gradePrerequisites = (lines: string[]): string[] =>
  gradeRoadmap(roadmap(ONE_REPO, { prerequisites: lines }), { prdFacts: ONE_REPO_SPECS, targets: null });

describe('gradeRoadmap — prerequisites', () => {
  it('passes a valid table whose check and person rows have their cards', () => {
    expect(
      gradePrerequisites([
        '| p1 | local | Docker is running | `base:docker` | | P2, P3 | check |',
        '| p2 | access | the private package installs | `npm view @acme/ui version` | | all | check |',
        '| p3 | permissions | the preview has its secret | | | P3 | person |',
        '| p4 | access | the dependencies install | `base:install` | `base:install` | all | agent |',
        '| p5 | github | the labels exist | `base:labels` | `base:labels` | all | agent |',
        '| p6 | local | each .env exists | `base:env-file` | `base:env-file` | P1 | agent |',
        ...card('p1'),
        ...card('p2'),
        ...card('p3'),
      ]),
    ).toEqual([]);
  });

  it('knows every base check of the catalog', () => {
    const names = ['gh-auth', 'node', 'pnpm', 'npm', 'yarn', 'install', 'registry', 'docker', 'labels', 'env-file', 'omni-signin'];
    expect(PREREQUISITE_BASE_CHECKS).toEqual(names);
    expect(PREREQUISITE_BASE_FIXES).toEqual(['install', 'labels', 'env-file']);
    const rows = names.map((name, index) => `| p${index + 1} | local | ${name} works | \`base:${name}\` | | all | check |`);
    expect(gradePrerequisites([...rows, ...names.flatMap((_, index) => card(`p${index + 1}`))])).toEqual([]);
  });

  it('refuses a duplicate id, also against a PRD row', () => {
    expect(gradePrerequisites(['| p1 | local | A | `base:node` | | all | person |', '| p1 | local | B | | | all | person |', '| P1 | local | C | | | all | person |', ...card('p1'), ...card('P1')])).toEqual([
      'p1: the id is used twice.',
      'P1: the id is used twice.',
    ]);
  });

  it('refuses a blocks naming no row of the PRDs table', () => {
    expect(gradePrerequisites(['| p1 | local | A | | | P2, P9 | person |', ...card('p1')])).toEqual(['p1: blocks P9, which is not a row of the roadmap.']);
  });

  it('refuses a check naming no base check', () => {
    expect(gradePrerequisites(['| p1 | local | A | `base:podman` | | all | check |', ...card('p1')])).toEqual([
      'p1: checks base:podman, which is no base check (gh-auth, node, pnpm, npm, yarn, install, registry, docker, labels, env-file, omni-signin).',
    ]);
  });

  it('refuses a fix on a row that is not agent, a fix naming no base fix, and an agent row without a fix', () => {
    expect(
      gradePrerequisites([
        '| p1 | local | A | `base:install` | `base:install` | all | check |',
        '| p2 | local | B | `base:docker` | `base:docker` | all | agent |',
        '| p3 | local | C | `base:docker` | `docker start` | all | agent |',
        '| p4 | local | D | `base:node` | | all | agent |',
        ...card('p1'),
      ]),
    ).toEqual([
      'p1: has the fix base:install, but only an agent row has a fix.',
      'p2: has the fix base:docker, which is no base fix (install, labels, env-file).',
      'p3: has the fix docker start, which is no base fix (install, labels, env-file).',
      'p4: is an agent row without a fix; an agent row names the base fix it runs.',
    ]);
  });

  it('refuses a check or person row without its card, and a card missing a line', () => {
    expect(
      gradePrerequisites([
        '| p1 | local | A | `base:docker` | | all | check |',
        '| p2 | local | B | | | all | person |',
        '| p3 | local | C | | | all | person |',
        ...card('p3', ['Command', 'Who can do it']),
      ]),
    ).toEqual([
      'p1: has no card; a check or person row has a "### p1" card under the table.',
      'p2: has no card; a check or person row has a "### p2" card under the table.',
      'p3: its card has no "Command" line.',
      'p3: its card has no "Who can do it" line.',
    ]);
  });
});

// `omni roadmap check [<n>]` and `omni check inbox` on a roadmap, through `main()` (PRD 1162, s4).
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

async function run(argv: readonly string[], cwd: string) {
  const s = io();
  const code = await main(argv, { cwd, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

const IN = '.omni-loop/delivery/inbox';
const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };

function spec(prd: number, blockedBy: string): string {
  return ['---', `prd: ${prd}`, `title: PRD ${prd}`, `blocked-by: ${blockedBy}`, 'spec: file', '---', ''].join('\n');
}

function roadmapMd(number: number, rows: string[]): string {
  return [
    '---',
    `roadmap: ${number}`,
    'title: Crew',
    'milestone: A company grants its first mandate.',
    '---',
    '',
    '## PRDs',
    '',
    '| id | PRD | title | blocked by | why | wave |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

const SPECS = {
  [`${IN}/1201-skeleton/spec.md`]: spec(1201, 'none'),
  [`${IN}/1202-worker/spec.md`]: spec(1202, '[1201]'),
  [`${IN}/1203-think/spec.md`]: spec(1203, '[1201, 1202]'),
};
const GREEN = roadmapMd(1200, [
  '| P1 | #1201 | Skeleton | – | – | 1 |',
  '| P2 | #1202 | Worker | P1 | it runs on the skeleton | 2 |',
  '| P3 | #1203 | Think | P1, P2 | the worker calls it | 3 |',
]);
const RED = roadmapMd(1300, [
  '| P1 | #1201 | Skeleton | – | – | 2 |',
  '| P2 | #1202 | Worker | P1 | – | 3 |',
  '| P3 | #1203 | Think | P2 | the worker calls it | 4 |',
]);

describe('omni roadmap check', () => {
  it('prints a green roadmap wave by wave and exits 0', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, ...SPECS, [`${IN}/roadmaps/1200-crew/roadmap.md`]: GREEN } });
    const { code, out } = await run(['roadmap', 'check'], root);
    expect(code).toBe(0);
    expect(out).toContain(`omni roadmap check — roadmap 1200: 3 PRD(s) across 3 wave(s) (${IN}/roadmaps/1200-crew/roadmap.md).`);
    expect(out).toMatch(/^ {2}wave 1: P1 #1201\n {2}wave 2: P2 #1202\n {2}wave 3: P3 #1203$/m);
    expect(out).toContain('omni roadmap check — roadmap 1200: every row, blocker and question holds.');
  });

  it('prints every violation of a red roadmap and exits 1', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, ...SPECS, [`${IN}/roadmaps/1300-crew/roadmap.md`]: RED } });
    const { code, out } = await run(['roadmap', 'check'], root);
    expect(code).toBe(1);
    const file = `${IN}/roadmaps/1300-crew/roadmap.md`;
    expect(out).toContain('omni roadmap check — roadmap 1300: violation(s):');
    expect(out).toContain(`  ${file}: P1: in wave 2, but it has no blocker, so its wave is 1.`);
    expect(out).toContain(`  ${file}: P2: blocked by P1 with no why — every blocker says why it blocks.`);
    expect(out).toContain(`  ${file}: P3: PRD #1203's spec is blocked by #1201, #1202, but its row by #1202.`);
  });

  it('grades one roadmap when given its number', async () => {
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, ...SPECS, [`${IN}/roadmaps/1200-crew/roadmap.md`]: GREEN, [`${IN}/roadmaps/1300-crew/roadmap.md`]: RED },
    });
    const one = await run(['roadmap', 'check', '1200'], root);
    expect(one.code).toBe(0);
    expect(one.out).not.toContain('1300');
    const all = await run(['roadmap', 'check'], root);
    expect(all.code).toBe(1);
  });

  it("refuses a front matter number that disagrees with its folder's", async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, ...SPECS, [`${IN}/roadmaps/1250-crew/roadmap.md`]: GREEN } });
    const { code, out } = await run(['roadmap', 'check'], root);
    expect(code).toBe(1);
    expect(out).toContain(`${IN}/roadmaps/1250-crew/roadmap.md: roadmap 1200 does not agree with its folder's number, 1250.`);
  });

  it('refuses a table that does not parse, and a folder with no roadmap.md', async () => {
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, [`${IN}/roadmaps/1200-crew/roadmap.md`]: '---\nroadmap: 1200\ntitle: T\nmilestone: M\n---\n', [`${IN}/roadmaps/1300-empty/notes.md`]: 'x' },
    });
    const { code, out } = await run(['roadmap', 'check'], root);
    expect(code).toBe(1);
    expect(out).toContain(`${IN}/roadmaps/1200-crew/roadmap.md: sections: no "## PRDs" section.`);
    expect(out).toContain(`${IN}/roadmaps/1300-empty/roadmap.md: roadmap.md is missing.`);
  });

  it('passes an inbox with no roadmap', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out } = await run(['roadmap', 'check'], root);
    expect(code).toBe(0);
    expect(out).toContain('omni roadmap check — no roadmap in the inbox.');
  });

  it('exits 2 with one line on an unknown roadmap or a bad argument', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const unknown = await run(['roadmap', 'check', '1200'], root);
    expect(unknown.code).toBe(2);
    expect(unknown.err).toMatch(/roadmap 1200 has no folder/);
    expect((await run(['roadmap', 'check', 'x'], root)).code).toBe(2);
    expect((await run(['roadmap'], root)).code).toBe(2);
  });

  it('runs in a plan repository, printing the repositories and refusing a read-only one', async () => {
    const config = {
      '.omni-loop/config.yml': [
        'kit: 1',
        'repo:',
        '  slug: vertuoza/crew-plan',
        'plan:',
        '  targets:',
        '    - repo: vertuoza/crew',
        '      role: back-end',
        '      knowledge: own',
        '    - repo: vertuoza/backend-php',
        '      role: legacy',
        '      knowledge: none',
        '      readOnly: true',
        '',
      ].join('\n'),
    };
    const text = [
      '---',
      'roadmap: 1200',
      'title: Crew',
      'milestone: M',
      '---',
      '## PRDs',
      '| id | PRD | title | repos | blocked by | why | wave |',
      '|---|---|---|---|---|---|---|',
      '| P1 | #1201 | Skeleton | crew | – | – | 1 |',
      '| P2 | #1202 | Worker | crew, backend-php | P1 | it runs on the skeleton | 2 |',
      '',
    ].join('\n');
    const { root } = makeRepo({
      git: true,
      files: { ...config, [`${IN}/1201-skeleton/spec.md`]: spec(1201, 'none'), [`${IN}/1202-worker/spec.md`]: spec(1202, '[1201]'), [`${IN}/roadmaps/1200-crew/roadmap.md`]: text },
    });
    const { code, out } = await run(['roadmap', 'check'], root);
    expect(code).toBe(1);
    expect(out).toContain('  wave 2: P2 #1202 (crew, backend-php)');
    expect(out).toContain('P2: backend-php is a read-only target — no roadmap row may name it.');
  });
});

describe('omni check inbox on a roadmap', () => {
  it('fails on a broken roadmap, and passes on a green one', async () => {
    const red = makeRepo({ git: true, files: { ...CONFIG, ...SPECS, [`${IN}/roadmaps/1300-crew/roadmap.md`]: RED } });
    const failed = await run(['check', 'inbox'], red.root);
    expect(failed.code).toBe(1);
    expect(failed.out).toContain(`${IN}/roadmaps/1300-crew/roadmap.md: P1: in wave 2, but it has no blocker, so its wave is 1.`);
    const green = makeRepo({ git: true, files: { ...CONFIG, ...SPECS, [`${IN}/roadmaps/1200-crew/roadmap.md`]: GREEN } });
    expect((await run(['check', 'inbox'], green.root)).code).toBe(0);
  });
});

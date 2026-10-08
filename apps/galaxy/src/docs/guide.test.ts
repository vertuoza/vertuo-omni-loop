import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { diagramsNamed } from './diagrams';
import { commandsNamed, guideProblems, parsePage, readGuide, skillsNamed } from './guide';
import { pageUrl } from './paths';
import { sure } from '../arcade/test/sure';

vi.mock('server-only', () => ({}));

// The docs guard (PRD 346): docs/guide/ holds its pages in order, each with a title and a Next link
// to the page to read next, the last one back to Getting started; every /omni:<skill> and
// `omni <command>` a page names is one the kit has; and every diagram a page shows is a file of the
// guide that reads. It fails on a guide that breaks any of that.

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const GUIDE = join(REPO, 'docs/guide');
const KIT = { skills: join(REPO, 'kit/plugin/skills'), commands: join(REPO, 'kit/bin/commands') };

const ORDER = [
  'index', 'install', 'join', 'invade', 'loop', 'first-prd', 'drive', 'several-repositories', 'roadmaps', 'landings', 'flow', 'validate-e2e', 'use-cases', 'troubleshooting',
];
const TITLES = [
  'Getting started', 'Install', 'Join a team', 'Invade', 'How the loop works', 'Your first PRD', 'Drive the loop', 'Several repositories',
  'Roadmaps', 'Landings', 'Repository flow', 'Validate with e2e (beta)', 'Use cases', 'When something goes wrong',
];

describe('docs/guide', () => {
  it('passes the guard', () => {
    expect(guideProblems(GUIDE, KIT)).toEqual([]);
  });

  it('holds its fourteen pages, in order, each with its title', () => {
    const { order, pages } = readGuide(GUIDE);
    expect(order).toEqual(ORDER);
    expect(pages.map((page) => [page.slug, page.title])).toEqual(ORDER.map((slug, i) => [slug, TITLES[i]]));
  });

  it('links each page to the one to read next, and the last back to Getting started', () => {
    const { pages } = readGuide(GUIDE);
    expect(pages.map((page) => page.next)).toEqual([
      '/docs/install', '/docs/join', '/docs/loop', '/docs/loop', '/docs/first-prd', '/docs/several-repositories', '/docs/several-repositories',
      '/docs/roadmaps', '/docs/landings', '/docs/flow', '/docs/validate-e2e', '/docs/use-cases', '/docs/troubleshooting', '/docs',
    ]);
  });

  it('explains driving the loop: starting it, its plan, watching it on the Loop page, stopping and resuming (PRD 1139)', () => {
    const drive = readGuide(GUIDE).pages.find((page) => page.slug === 'drive')?.body ?? '';
    for (const heading of ['## Start it', '## The loop plan', '## One step per tick', '## Stop and restart', '## Watch it on the Loop page']) {
      expect(drive, heading).toContain(heading);
    }
    for (const phrase of ['/loop /omni:drive', 'omni next --plan', '/omni:pr-care --once', 'stops itself', 'resumes, with the same plan', 'silent', 'omni signin']) {
      expect(drive, phrase).toContain(phrase);
    }
  });

  it('explains roadmaps: one sitting, one map, specs up front, the check, one phase-0 PR, the drive line and the waiting PR (PRD 1162)', () => {
    const roadmaps = readGuide(GUIDE).pages.find((page) => page.slug === 'roadmaps')?.body ?? '';
    for (const heading of ['## Write a roadmap', '## roadmap.md', '## Drive it', '## Answer a question']) {
      expect(roadmaps, heading).toContain(heading);
    }
    for (const phrase of ['/omni:roadmap', '/omni:mega-roadmap', 'one map', 'one phase-0', 'omni roadmap check', '/loop /omni:drive --roadmap', '/loop /omni:mega-drive --roadmap', 'waits on', 'omni roadmap answer']) {
      expect(roadmaps, phrase).toContain(phrase);
    }
  });

  it('explains a roadmap\'s prerequisites: the table, the categories, the base checks, what the agent may fix, and the tab (PRD 1218)', () => {
    const roadmaps = readGuide(GUIDE).pages.find((page) => page.slug === 'roadmaps')?.body ?? '';
    const at = roadmaps.indexOf('## Prerequisites');
    expect(at).toBeGreaterThan(0);
    const section = roadmaps.slice(at);
    for (const phrase of [
      '| id | category | need | check | fix | blocks | who |', '`local`', '`access`', '`permissions`', '`github`', '`services`',
      '`base:docker`', '`base:install`', '**Who can do it:**', 'omni roadmap prereqs', '--fix', 'omni roadmap tick',
      'never installs software', '**Prerequisites** tab', 'waits on prerequisite',
    ]) {
      expect(section, phrase).toContain(phrase);
    }
  });

  it('sends someone joining a team past Invade, which their repository needs no more', () => {
    const join = readGuide(GUIDE).pages.find((page) => page.slug === 'join');
    expect(join?.next).toBe('/docs/loop');
    for (const never of ['omni init', 'installing the GitHub App', '/omni:invade']) expect(join?.body).toContain(never);
  });

  it('says why the phase-0 pull request goes into the default branch, and links it where a PRD is approved', () => {
    const { pages } = readGuide(GUIDE);
    const body = (slug: string) => pages.find((page) => page.slug === slug)?.body ?? '';
    expect(body('loop')).toContain('### Why the phase-0 pull request goes into the default branch');
    for (const slug of ['first-prd', 'use-cases']) {
      expect(body(slug), slug).toContain('](/docs/loop#why-the-phase-0-pull-request-goes-into-the-default-branch)');
    }
  });

  it('gives a vast idea its row and its section on the use-cases page, and /omni:think-big its row on the loop page (PRD 686)', () => {
    const { pages } = readGuide(GUIDE);
    const body = (slug: string) => pages.find((page) => page.slug === slug)?.body ?? '';
    const useCases = body('use-cases');
    const row = /^\| \[([^\]]*vast idea[^\]]*)\]\(#([a-z-]+)\) \| `\/omni:think-big [^`]+`/m.exec(useCases);
    expect(row, 'a row for a vast idea, typing /omni:think-big').not.toBeNull();
    const heading = useCases.split('\n').find((line) => /^### /.test(line) && line.slice(4).toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-') === sure(row, 'row')[2]);
    expect(heading, `a section #${sure(row, 'row')[2]}`).toBeDefined();
    const section = useCases.slice(useCases.indexOf(sure(heading, 'heading')), useCases.indexOf('\n## ', useCases.indexOf(sure(heading, 'heading'))));
    for (const phrase of ['/omni:think-big', 'omni:concept', '.omni-loop/delivery/inbox/concepts/', '/omni:brainstorm --concept']) {
      expect(section, phrase).toContain(phrase);
    }
    expect(body('loop')).toMatch(/^\| `\/omni:think-big` \|/m);
  });

  it('walks the kernel and migrations example end to end on the flow page (PRD 1089)', () => {
    const flow = readGuide(GUIDE).pages.find((page) => page.slug === 'flow')?.body ?? '';
    for (const step of [
      '```yaml file=.omni-loop/config.yml',
      '```markdown file=.omni-loop/flow/kernel/tests.md',
      'migrations: slice alone, a slice of this area touches no path outside it.',
      'kernel: wave first',
      'all territories and blocks well-formed.',
      'omni flow show --path src/kernel/Bus/Dispatcher.php',
      'kitStep: replaced',
      'omni flow verdict do-work.test --from out.txt',
      'not ok kernel: approval person',
      'gh pr merge 12 --squash --delete-branch',
      'ADR-0069',
    ]) expect(flow, step).toContain(step);
  });

  it('draws the loop, its pull requests and its skills on the loop page', () => {
    const loop = readGuide(GUIDE).pages.find((page) => page.slug === 'loop');
    expect(diagramsNamed(loop?.body ?? '').map((diagram) => [diagram.src, diagram.alone])).toEqual([
      ['diagrams/loop.svg', true], ['diagrams/pull-requests.svg', true], ['diagrams/skills.svg', true],
    ]);
  });

  it('draws the repositories, their pull requests and their skills on the several-repositories page', () => {
    const page = readGuide(GUIDE).pages.find((p) => p.slug === 'several-repositories');
    expect(diagramsNamed(page?.body ?? '').map((diagram) => [diagram.src, diagram.alone])).toEqual([
      ['diagrams/repositories.svg', true], ['diagrams/pull-requests-repositories.svg', true],
      ['diagrams/skills-repositories.svg', true],
    ]);
  });

  it('draws /omni:mega-pr-care and /omni:mega-bug-fix among what you type in the plan repository (PRD 1118)', () => {
    const svg = readFileSync(join(GUIDE, 'diagrams/skills-repositories.svg'), 'utf8');
    const desc = /<desc>([\s\S]*?)<\/desc>/.exec(svg)?.[1] ?? '';
    const typed = [...svg.matchAll(/<text [^>]*class="dg-code dg-you"[^>]*>([^<]*)<\/text>/g)].map((m) => sure(m[1], 'm[1]'));
    for (const skill of ['/omni:mega-pr-care', '/omni:mega-bug-fix']) {
      expect(desc, `the <desc> names ${skill}`).toContain(skill);
      expect(typed.some((text) => text.startsWith(skill)), `${skill} is drawn as a command you type`).toBe(true);
    }
  });

  it('draws a roadmap from its source to the end, and its PRDs over time, on the roadmaps page (PRD 1162)', () => {
    const page = readGuide(GUIDE).pages.find((p) => p.slug === 'roadmaps');
    expect(diagramsNamed(page?.body ?? '').map((diagram) => [diagram.src, diagram.alone])).toEqual([
      ['diagrams/roadmap.svg', true], ['diagrams/roadmap-waves.svg', true],
    ]);
  });

  it('draws the roadmap skills among what you type, in one repository and in a plan repository (PRD 1162)', () => {
    for (const [file, skills] of [
      ['diagrams/skills.svg', ['/omni:roadmap', '/loop /omni:drive --roadmap']],
      ['diagrams/skills-repositories.svg', ['/omni:mega-roadmap', '/loop /omni:mega-drive --roadmap']],
    ] as const) {
      const svg = readFileSync(join(GUIDE, file), 'utf8');
      const desc = /<desc>([\s\S]*?)<\/desc>/.exec(svg)?.[1] ?? '';
      const typed = [...svg.matchAll(/<text [^>]*class="dg-code dg-you"[^>]*>([^<]*)<\/text>/g)].map((m) => sure(m[1], 'm[1]'));
      for (const skill of skills) {
        expect(desc, `${file}: the <desc> names ${skill}`).toContain(skill);
        expect(typed.some((text) => text.startsWith(skill)), `${file}: ${skill} is drawn as a command you type`).toBe(true);
      }
    }
  });

  describe('getting started (#890)', () => {
    // Everyone's laptop, in four steps on Install, each shown as the line to type.
    const STEPS = [
      ['omni, installed globally', 'npm install -g github:vertuoza/vertuo-omni-loop'],
      ['the skills, loaded in Claude Code', 'claude plugin install omni@omni-loop'],
      ['the sign-in', 'omni signin'],
      ['the questions, on the Omni page', '/omni:ask on'],
    ];
    const SETUP_LINES = ['npm install -g github:vertuoza/vertuo-omni-loop', 'plugin install omni@omni-loop'];
    const body = (slug: string) => readGuide(GUIDE).pages.find((page) => page.slug === slug)?.body ?? '';
    /** A page's numbered steps: each `## <n>. ` section, up to the next `## `. */
    const steps = (markdown: string) => markdown.split(/^## /m).slice(1).filter((section) => /^\d+\. /.test(section));
    /** The lines of code a section shows in its fenced blocks. */
    const codeLines = (section: string) =>
      [...section.matchAll(/^\s*```[^\n]*\n([\s\S]*?)^\s*```\s*$/gm)].flatMap((m) => sure(m[1], 'm[1]').split('\n').map((line) => line.trim()));

    it('takes everyone, on Install, through four steps: omni globally, the skills in Claude Code, the sign-in, the questions', () => {
      const found = steps(body('install'));
      expect(found.map((section) => section.split('\n')[0])).toHaveLength(STEPS.length);
      STEPS.forEach(([what, line], i) => { expect(codeLines(found[i] ?? ''), `step ${i + 1}, ${what}`).toContain(line); });
    });

    it('reads Install right after Getting started, before Join a team', () => {
      const { order, pages } = readGuide(GUIDE);
      expect(order.slice(0, 3)).toEqual(['index', 'install', 'join']);
      expect(pages.find((page) => page.slug === 'index')?.next).toBe('/docs/install');
    });

    it('gives the lines that install omni and the skills on Install only: the other pages link it', () => {
      for (const page of readGuide(GUIDE).pages.filter((p) => p.slug !== 'install')) {
        for (const line of SETUP_LINES) expect(page.body, `${page.slug}.md shows ${line}`).not.toContain(line);
      }
      for (const slug of ['index', 'join']) expect(body(slug), slug).toContain('](/docs/install)');
    });
  });

  it('points the Invade page\'s plan-repository section at the several-repositories page', () => {
    const invade = readGuide(GUIDE).pages.find((p) => p.slug === 'invade')?.body ?? '';
    const section = invade.slice(invade.indexOf('## A plan repository'), invade.indexOf('[Next →'));
    expect(section).toContain('](/docs/several-repositories)');
    expect(section).not.toContain('```');
  });
});

describe('what a page names', () => {
  it('finds every /omni: skill, in prose or in code', () => {
    expect(skillsNamed('Run `/omni:brainstorm`, then /omni:yolo 7. The `omni:prd` label is no skill.')).toEqual(['brainstorm', 'yolo']);
  });

  it('finds every omni command shown as code, and not Omni Loop in prose', () => {
    const page = 'Omni Loop is the omni way. Run `omni signin`, then:\n\n```bash\nomni config\nnpx omni-thing\ncd x && omni help\n```\n';
    expect(commandsNamed(page)).toEqual(['config', 'help', 'signin']);
  });

  it('reads a page\'s title and Next link', () => {
    expect(parsePage('install', '---\ntitle: Install\n---\n\nWords.\n\n[Next → Invade](/docs/invade)\n'))
      .toEqual({ slug: 'install', title: 'Install', next: '/docs/invade', body: '\nWords.\n\n[Next → Invade](/docs/invade)\n', bodyLine: 4 });
    expect(parsePage('x', 'No frontmatter.')).toMatchObject({ title: null, next: null, bodyLine: 1 });
  });

  it('serves index at /docs and every other page under it', () => {
    expect([pageUrl('index'), pageUrl('first-prd')]).toEqual(['/docs', '/docs/first-prd']);
  });
});

describe('the order file', () => {
  let dir = '';
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  const guideWith = (meta: unknown) => {
    dir = mkdtempSync(join(tmpdir(), 'omni-guide-'));
    writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta));
    writeFileSync(join(dir, 'index.md'), '---\ntitle: A\n---\n');
    return () => readGuide(dir);
  };

  it('reads the pages it lists, and none when it lists none', () => {
    expect(guideWith({ pages: ['index'] })().order).toEqual(['index']);
    expect(guideWith({})().order).toEqual([]);
  });

  it('refuses pages that are not a list of slugs, naming the field', () => {
    expect(guideWith({ pages: 'index' })).toThrow(/meta\.json: pages: /);
    expect(guideWith({ pages: ['index', 7] })).toThrow(/meta\.json: pages\.1: /);
  });
});

describe('the guard', () => {
  let dir = '';
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  /** A guide and a kit in a scratch folder: the kit has the skill `plan` and the command `config`;
   * `files` are more files of the guide, such as its diagrams. */
  function guide(pages: Record<string, string>, order = Object.keys(pages), files: Record<string, string> = {}) {
    dir = mkdtempSync(join(tmpdir(), 'omni-guide-'));
    const kit = { skills: join(dir, 'skills'), commands: join(dir, 'commands') };
    mkdirSync(join(kit.skills, 'plan'), { recursive: true });
    mkdirSync(kit.commands);
    writeFileSync(join(kit.commands, 'config.ts'), '');
    mkdirSync(join(dir, 'guide'));
    writeFileSync(join(dir, 'guide/meta.json'), JSON.stringify({ pages: order }));
    for (const [slug, text] of Object.entries(pages)) writeFileSync(join(dir, 'guide', `${slug}.md`), text);
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(dir, 'guide', path, '..'), { recursive: true });
      writeFileSync(join(dir, 'guide', path), text);
    }
    return guideProblems(join(dir, 'guide'), kit);
  }
  const page = (title: string, next: string, body = '') => `---\ntitle: ${title}\n---\n\n${body}\n\n[Next → x](${next})\n`;

  it('passes a guide that holds', () => {
    expect(guide({ index: page('A', '/docs/b', 'Run `/omni:plan`, then `omni config`.'), b: page('B', '/docs') })).toEqual([]);
  });

  it('fails on a /omni: skill the plugin does not have', () => {
    expect(guide({ index: page('A', '/docs/b', 'Run /omni:nope.'), b: page('B', '/docs') })).toEqual(['index.md: /omni:nope is no skill of the plugin']);
  });

  it('fails on an omni command the CLI does not have', () => {
    expect(guide({ index: page('A', '/docs/b', '```bash terminal\nomni nope\n```'), b: page('B', '/docs') })).toEqual(['index.md: omni nope is no command of the CLI']);
  });

  it('fails on a page with no title', () => {
    expect(guide({ index: page('A', '/docs/b'), b: 'Words.\n\n[Next → A](/docs)\n' })).toEqual(['b.md: no title']);
  });

  it('fails on a Next link to no page, on one to the page itself, and on a page with none', () => {
    expect(guide({ index: page('A', '/docs/gone'), b: page('B', '/docs/b'), c: '---\ntitle: C\n---\n' })).toEqual([
      'index.md: Next → /docs/gone is no other page of the guide',
      'b.md: Next → /docs/b is no other page of the guide',
      'c.md: no Next → link',
    ]);
  });

  it('passes code blocks that each name where they go, fenced or indented in a list', () => {
    const body = [
      '```bash terminal', 'gh auth login', '```', '',
      '```text agent', '/omni:plan 7', '```', '',
      '```bash terminal agent', 'omni config', '```', '',
      '```yaml file=.omni-loop/config.yml', 'ask:', '```', '',
      '- A reply:', '', '  ```text github', '  1: A', '  ```',
      '',
      '````markdown agent', '```', 'a fence shown inside a block', '```', '````',
    ].join('\n');
    expect(guide({ index: page('A', '/docs/b', body), b: page('B', '/docs') })).toEqual([]);
  });

  it.each([
    ['```bash', 'the code block names no kind (terminal, agent, file=<path>, github)'],
    ['```text foo', 'the code block names "foo", which is no kind'],
    ['```yaml file', 'the code block names file with no path'],
    ['```text github terminal', 'the code block names github beside another kind: it stands alone'],
    ['  ```yaml file= agent', 'the code block names file with no path'],
  ])('fails on a block fenced %j, once, naming the page and the line', (fence, problem) => {
    // The frontmatter takes lines 1 to 3, a blank line 4, Words. line 5: the fence opens on line 7.
    const body = `Words.\n\n${fence}\nsome code\n${fence.startsWith(' ') ? '  ' : ''}\`\`\`\n`;
    expect(guide({ index: page('A', '/docs/b', body), b: page('B', '/docs') })).toEqual([`index.md:7: ${problem}`]);
  });

  it('passes an install page whose TERMINAL blocks are each one line', () => {
    const body = '```bash terminal\nomni config\n```\n\n```text agent\n/omni:plan 7\n/omni:plan 8\n```\n';
    expect(guide({ index: page('A', '/docs/install'), install: page('Install', '/docs', body) })).toEqual([]);
  });

  it('fails on an install page with a TERMINAL block of more than one line, naming the line', () => {
    // The frontmatter takes lines 1 to 3, a blank line 4, Words. line 5: the fence opens on line 7.
    const body = 'Words.\n\n```bash terminal agent\ngit add .omni-loop\ngit commit\n```\n';
    expect(guide({ index: page('A', '/docs/install'), install: page('Install', '/docs', body) }))
      .toEqual(['install.md:7: the TERMINAL block is 2 lines: every one on the install page is one line']);
  });

  it('lets another page show a TERMINAL block of several lines', () => {
    const body = '```bash terminal\ngit switch main\ngit pull\n```\n';
    expect(guide({ index: page('A', '/docs/b', body), b: page('B', '/docs') })).toEqual([]);
  });

  it('fails on a page naming ~/.local/bin/omni, anywhere but troubleshooting', () => {
    const old = 'An old `~/.local/bin/omni` can go: `rm ~/.local/bin/omni`.';
    expect(guide({ index: page('A', '/docs/install', old), install: page('Install', '/docs/troubleshooting', old), troubleshooting: page('T', '/docs', old) }))
      .toEqual(['index.md: names ~/.local/bin/omni, the old PATH wrapper: only troubleshooting may', 'install.md: names ~/.local/bin/omni, the old PATH wrapper: only troubleshooting may']);
  });

  describe('a diagram', () => {
    const SVG = '<svg viewBox="0 0 10 10"><rect class="dg-box" width="10" height="10"/></svg>';
    // The frontmatter takes lines 1 to 3, a blank line 4, Words. line 5: the diagram is on line 7.
    const shown = (line: string, files: Record<string, string> = { 'diagrams/a.svg': SVG }) =>
      guide({ index: page('A', '/docs/b', `Words.\n\n${line}\n`), b: page('B', '/docs') }, undefined, files);

    it('passes one that stands alone, is named, and reads', () => {
      expect(shown('![The loop](diagrams/a.svg)')).toEqual([]);
    });

    it('fails on one that is no file of the guide', () => {
      expect(shown('![The loop](diagrams/gone.svg)')).toEqual(['index.md:7: the diagram diagrams/gone.svg is no file of the guide']);
    });

    it('fails on one with no alt text', () => {
      expect(shown('![](diagrams/a.svg)')).toEqual(['index.md:7: the diagram diagrams/a.svg has no alt text']);
    });

    it('fails on one inside a sentence, which the page could not set as a figure', () => {
      expect(shown('See ![the loop](diagrams/a.svg) here.')).toEqual(['index.md:7: the diagram diagrams/a.svg does not stand alone on its line']);
    });

    it('fails on one whose file does not read, naming its line', () => {
      expect(shown('![The loop](diagrams/a.svg)', { 'diagrams/a.svg': '<svg>\n<g>\n</svg>' }))
        .toEqual(['index.md:7: the diagram diagrams/a.svg does not read: line 3: </svg> closes <g>']);
    });

    it('leaves an image from elsewhere to fumadocs', () => {
      expect(shown('![A photo](https://example.com/a.svg)')).toEqual([]);
    });
  });

  it('fails on a page the order file leaves out, and on an order entry with no page', () => {
    expect(guide({ index: page('A', '/docs/b'), b: page('B', '/docs') }, ['index', 'gone'])).toEqual([
      'meta.json: lists gone, which has no gone.md',
      'b.md: not in meta.json',
    ]);
  });
});

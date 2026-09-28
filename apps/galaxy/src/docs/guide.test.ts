import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { commandsNamed, guideProblems, parsePage, readGuide, skillsNamed } from './guide';
import { pageUrl } from './paths';

// The docs guard (PRD 346): docs/guide/ holds the five pages in order, each with a title and a Next
// link to the following page, the last one back to Getting started; and every /omni:<skill> and
// `omni <command>` a page names is one the kit has. It fails on a guide that breaks any of that.

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const GUIDE = join(REPO, 'docs/guide');
const KIT = { skills: join(REPO, 'kit/plugin/skills'), commands: join(REPO, 'kit/bin/commands') };

const ORDER = ['index', 'install', 'invade', 'first-prd', 'troubleshooting'];
const TITLES = ['Getting started', 'Install', 'Invade', 'Your first PRD', 'When something goes wrong'];

describe('docs/guide', () => {
  it('passes the guard', () => {
    expect(guideProblems(GUIDE, KIT)).toEqual([]);
  });

  it('holds the five pages, in order, each with its title', () => {
    const { order, pages } = readGuide(GUIDE);
    expect(order).toEqual(ORDER);
    expect(pages.map((page) => [page.slug, page.title])).toEqual(ORDER.map((slug, i) => [slug, TITLES[i]]));
  });

  it('links each page to the following one, and the last back to Getting started', () => {
    const { pages } = readGuide(GUIDE);
    expect(pages.map((page) => page.next)).toEqual(['/docs/install', '/docs/invade', '/docs/first-prd', '/docs/troubleshooting', '/docs']);
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

describe('the guard', () => {
  let dir = '';
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  /** A guide and a kit in a scratch folder: the kit has the skill `plan` and the command `config`. */
  function guide(pages: Record<string, string>, order = Object.keys(pages)) {
    dir = mkdtempSync(join(tmpdir(), 'omni-guide-'));
    const kit = { skills: join(dir, 'skills'), commands: join(dir, 'commands') };
    mkdirSync(join(kit.skills, 'plan'), { recursive: true });
    mkdirSync(kit.commands);
    writeFileSync(join(kit.commands, 'config.mjs'), '');
    mkdirSync(join(dir, 'guide'));
    writeFileSync(join(dir, 'guide/meta.json'), JSON.stringify({ pages: order }));
    for (const [slug, text] of Object.entries(pages)) writeFileSync(join(dir, 'guide', `${slug}.md`), text);
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

  it('fails on a page the order file leaves out, and on an order entry with no page', () => {
    expect(guide({ index: page('A', '/docs/b'), b: page('B', '/docs') }, ['index', 'gone'])).toEqual([
      'meta.json: lists gone, which has no gone.md',
      'b.md: not in meta.json',
    ]);
  });
});

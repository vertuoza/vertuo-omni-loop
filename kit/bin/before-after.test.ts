// PRD 2239, s2 and s3: `omni before-after new` and `render` through `main()` on a fixture repository.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readEnv } from '../lib/env/read.ts';
import { parsePrd } from '../lib/ids.ts';
import type { RenderLaunch } from '../lib/before-after/render.ts';
import { makeRepo, testContext } from '../test/fixture.ts';
import { renderPage } from './commands/before-after.ts';
import { main } from './omni.ts';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };
const DIR = '.omni-loop/delivery/inbox/2239-two-tabs';
const PAGE = `${DIR}/before-after.html`;
const FILL = '<!-- FILL -->';

function repo(extra: Record<string, string> = { [`${DIR}/spec.md`]: '' }) {
  return makeRepo({ git: true, files: { ...CONFIG, ...extra } });
}

async function omni(root: string, argv: readonly string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni before-after new', () => {
  it('writes the two-tab page into the inbox folder, names it and exits 0', async () => {
    const { root } = repo();
    const result = await omni(root, ['before-after', 'new', '2239', '--services', 'kit,galaxy']);
    expect(result).toEqual({ code: 0, out: `wrote ${PAGE}\n`, err: '' });
    const html = readFileSync(join(root, PAGE), 'utf8');
    expect(html).toContain('<meta name="omni-before-after" content="2">');
    expect(html.match(/data-service="kit"/g)).toHaveLength(2);
    expect(html.match(/data-service="galaxy"/g)).toHaveLength(2);
    expect(html).toContain(FILL);
  });

  it('writes a page omni check inbox accepts once the FILL markers are replaced with a state', async () => {
    const { root } = repo({
      [`${DIR}/spec.md`]: '---\nprd: 2239\ntitle: Two tabs\nblocked-by: none\nspec: file\n---\n\n# Two tabs\n',
    });
    await omni(root, ['before-after', 'new', '2239', '--services', 'kit']);
    const raw = await omni(root, ['check', 'inbox']);
    expect(raw.code).toBe(1);
    expect(raw.err + raw.out).toContain('before-after.html: 8 <!-- FILL --> markers left');
    writeFileSync(join(root, PAGE), readFileSync(join(root, PAGE), 'utf8').replaceAll(FILL, 'N/A — nothing changes'));
    const filled = await omni(root, ['check', 'inbox']);
    expect(filled.err + filled.out).not.toContain('before-after.html');
    expect(filled.code).toBe(0);
  });

  it('refuses a PRD with no inbox folder, writing nothing, with one line and exit 1', async () => {
    const { root } = repo();
    const result = await omni(root, ['before-after', 'new', '7', '--services', 'kit']);
    expect(result).toEqual({ code: 1, out: '', err: 'omni before-after new: PRD 7 has no inbox folder.\n' });
  });

  it('refuses a PRD already shipped', async () => {
    const { root } = repo({ '.omni-loop/delivery/shipped/0007-old/spec.md': '' });
    const result = await omni(root, ['before-after', 'new', '7', '--services', 'kit']);
    expect(result.code).toBe(1);
    expect(result.err).toBe('omni before-after new: PRD 7 has no inbox folder.\n');
    expect(existsSync(join(root, '.omni-loop/delivery/shipped/0007-old/before-after.html'))).toBe(false);
  });

  it('refuses an existing page without --force, leaves it, and replaces it with --force', async () => {
    const { root } = repo({ [`${DIR}/spec.md`]: '', [PAGE]: 'mine' });
    const refused = await omni(root, ['before-after', 'new', '2239', '--services', 'kit']);
    expect(refused).toEqual({ code: 1, out: '', err: `omni before-after new: ${PAGE} already exists: pass --force to replace it.\n` });
    expect(readFileSync(join(root, PAGE), 'utf8')).toBe('mine');
    const forced = await omni(root, ['before-after', 'new', '2239', '--services', 'kit', '--force']);
    expect(forced.code).toBe(0);
    expect(readFileSync(join(root, PAGE), 'utf8')).toContain('omni-before-after');
  });

  it('refuses a missing, valueless or empty --services with one line and exit 1, writing nothing', async () => {
    const { root } = repo();
    for (const argv of [['2239'], ['2239', '--services'], ['2239', '--services', ''], ['2239', '--services', ' , ']]) {
      const result = await omni(root, ['before-after', 'new', ...argv]);
      expect(result.code, argv.join(' ')).toBe(1);
      expect(result.out).toBe('');
      expect(result.err).toMatch(/^omni before-after new: --services needs at least one service.*\n$/);
    }
    expect(existsSync(join(root, PAGE))).toBe(false);
  });

  it('refuses a service name the page cannot carry', async () => {
    const { root } = repo();
    const result = await omni(root, ['before-after', 'new', '2239', '--services', 'a"b']);
    expect(result.code).toBe(1);
    expect(result.err).toContain('"a"b" is not a service name');
  });

  it('is a usage error, exit 2, with no verb, an unknown verb, or a bad number', async () => {
    const { root } = repo();
    mkdirSync(join(root, DIR), { recursive: true });
    for (const argv of [['before-after'], ['before-after', 'old'], ['before-after', 'new'], ['before-after', 'new', 'x', '--services', 'kit'], ['before-after', 'new', '1', '2', '--services', 'kit']]) {
      const result = await omni(root, argv);
      expect(result.code, argv.join(' ')).toBe(2);
      expect(result.out).toBe('');
    }
  });

});

describe('omni before-after render', () => {
  const PRE = '<pre class="mermaid">graph TD</pre>';
  const page = `<html><head><meta name="omni-before-after" content="2"></head><body><div data-section="flow" data-state="filled">${PRE}</div></body></html>`;
  const io = (root: string) => {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, io: { ctx: testContext(root), stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) }, exec: execFileSync, env: {}, vars: readEnv({}) } };
  };
  const browser = (answer: unknown): RenderLaunch => () =>
    Promise.resolve({ newPage: () => Promise.resolve({ setContent: () => Promise.resolve(), evaluate: () => Promise.resolve(answer) }), close: () => Promise.resolve() });

  it('writes the drawn page and prints one line per diagram, exit 0, through a fake browser', async () => {
    const { root } = repo({ [`${DIR}/spec.md`]: '', [PAGE]: page });
    const run = io(root);
    expect(await renderPage(parsePrd(2239), run.io, browser({ svg: '<svg>x</svg>' }))).toBe(0);
    expect(run.out.join('')).toBe('rendered flow of the page\n');
    const html = readFileSync(join(root, PAGE), 'utf8');
    expect(html).toContain('<figure class="mermaid-diagram" data-source="graph TD"><svg>x</svg></figure>');
    expect(html).not.toContain(PRE);
  });

  it('exits 1 naming a refused diagram, the page still written', async () => {
    const { root } = repo({ [`${DIR}/spec.md`]: '', [PAGE]: page });
    const run = io(root);
    expect(await renderPage(parsePrd(2239), run.io, browser({ error: 'Parse error on line 1:\nx' }))).toBe(1);
    expect(run.err.join('')).toBe('omni before-after render: flow of the page: Parse error on line 1:\n');
    expect(readFileSync(join(root, PAGE), 'utf8')).toBe(page);
  });

  it('exits 1 with the install line, leaving the page byte-identical, when no browser starts', async () => {
    const { root } = repo({ [`${DIR}/spec.md`]: '', [PAGE]: page });
    const run = io(root);
    const none: RenderLaunch = () => Promise.reject(new Error('Playwright is not installed in this repository'));
    expect(await renderPage(parsePrd(2239), run.io, none)).toBe(1);
    expect(run.err.join('')).toBe(
      'omni before-after render: cannot render the diagrams: Playwright is not installed in this repository. Install it: pnpm add -D playwright && pnpm exec playwright install chromium\n',
    );
    expect(readFileSync(join(root, PAGE), 'utf8')).toBe(page);
  });

  it('through main(), a repository with no Playwright gets the install line and an untouched page', async () => {
    const { root } = repo({ [`${DIR}/spec.md`]: '', [PAGE]: page });
    const result = await omni(root, ['before-after', 'render', '2239']);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/^omni before-after render: cannot render the diagrams: .*\. Install it: pnpm add -D playwright && pnpm exec playwright install chromium\n$/);
    expect(readFileSync(join(root, PAGE), 'utf8')).toBe(page);
  });

  it('says there is nothing to render for a page with no diagram, starting no browser', async () => {
    const { root } = repo({ [`${DIR}/spec.md`]: '', [PAGE]: '<html></html>' });
    const result = await omni(root, ['before-after', 'render', '2239']);
    expect(result).toEqual({ code: 0, out: 'no diagrams to render\n', err: '' });
  });

  it('refuses a PRD with no inbox folder and a folder with no page, exit 1; a bad number is a usage error', async () => {
    const { root } = repo();
    expect(await omni(root, ['before-after', 'render', '7'])).toEqual({ code: 1, out: '', err: 'omni before-after render: PRD 7 has no inbox folder.\n' });
    const missing = await omni(root, ['before-after', 'render', '2239']);
    expect(missing).toEqual({ code: 1, out: '', err: `omni before-after render: ${PAGE} does not exist: write it with omni before-after new 2239.\n` });
    expect((await omni(root, ['before-after', 'render'])).code).toBe(2);
    expect((await omni(root, ['before-after', 'render', 'x'])).code).toBe(2);
  });
});

// The design ratchet (PRD omni-loop-11, s2): stylelint.config.ts over every app-page stylesheet, its
// breaches held by design/baseline.json, a list that may only shrink. The rules run for real on
// inline fixture stylesheets, git is a fake; then one guard runs the ratchet over the tracked tree, so
// the baseline is exact at every commit.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BASELINE, eslintPages, main, replacedClasses, stylelintSheets, type Deps, type Git } from './design-ratchet.ts';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const PAGE = 'apps/galaxy/src/ask/ask.css';
const OTHER = 'apps/galaxy/src/outbox/outbox.css';

/** The fixture tree: path → text. Every stylesheet but PAGE and OTHER is out of the ratchet's reach. */
const tree: Record<string, string> = {
  [PAGE]: '.a { padding: var(--space-2); }\n',
  [OTHER]: '.b { border: 1px solid #fff; }\n',
  'apps/galaxy/src/arcade/hud.css': '.c { font-size: 13px; color: #0f0; }\n',
  'apps/galaxy/src/play-dock/dock.css': '.d { z-index: 99; }\n',
  'apps/galaxy/src/home/home.css': '.e { padding: 8px; }\n',
  'apps/galaxy/src/ask/ask.tsx': 'export const Ask = () => null;\n',
  'apps/galaxy/app/globals.css': '.f { color: red; }\n',
  'packages/ui/src/button.css': '.g { color: red; }\n',
};

const json = (breaches: readonly string[]) => `${JSON.stringify({ breaches }, null, 2)}\n`;

/** A git that knows one merge-base per ref, and the baseline at it (`null`: absent there). */
function fakeGit(base: string | null, seen: string[] = []): Git {
  return {
    mergeBase: (ref) => {
      seen.push(ref);
      return ref === 'origin/missing' ? null : `base-of-${ref}`;
    },
    show: () => base,
  };
}

function deps(
  files: Record<string, string>,
  { baseline = json([]), base = null, read = [], seenRefs = [] }: { baseline?: string | null; base?: string | null; read?: string[][]; seenRefs?: string[] } = {},
): Deps {
  const css = stylelintSheets((path) => files[path] ?? '');
  const tsx = eslintPages((path) => files[path] ?? '', ['dossier-approve', 'pitch-action']);
  const lint = async (paths: readonly string[]) => [...(await css(paths)), ...(await tsx(paths))];
  return {
    tracked: () => Object.keys(files),
    lint: async (paths) => {
      read.push([...paths]);
      return lint(paths);
    },
    baseline: () => baseline,
    git: fakeGit(base, seenRefs),
  };
}

const COLOUR = `${OTHER} color-no-hex`;

describe('the design ratchet, on fixtures', () => {
  it('AC-1: fails on a new raw value, naming the file and the rule', async () => {
    const files = { ...tree, [PAGE]: '.a { font-size: 14px; }\n' };
    const { code, lines } = await main([], deps(files, { baseline: json([COLOUR]) }));
    expect(code).toBe(1);
    expect(lines).toContain(`${PAGE} declaration-property-value-allowed-list`);
    expect(lines.join('\n')).toContain(`${PAGE}:1`);
  });

  it('AC-2: passes when every breach is listed in the baseline', async () => {
    const { code, lines } = await main([], deps(tree, { baseline: json([COLOUR]) }));
    expect(code).toBe(0);
    expect(lines.at(-1)).toMatch(/^design ratchet: 3 files read, 1 breach, each listed in design\/baseline\.json$/);
  });

  it('AC-3: fails on a baseline holding a line the base does not, naming it', async () => {
    const grown = `${PAGE} color-no-hex`;
    const files = { ...tree, [PAGE]: '.a { border: 1px solid #000; }\n' };
    const { code, lines } = await main([], deps(files, { baseline: json([grown, COLOUR].sort()), base: json([COLOUR]) }));
    expect(code).toBe(1);
    expect(lines.join('\n')).toContain('grew against');
    expect(lines).toContain(grown);
  });

  it('AC-3: passes a baseline that shrank or stayed against the base', async () => {
    const files = { ...tree, [OTHER]: '.b { color: var(--color-text-primary); }\n' };
    expect((await main([], deps(files, { baseline: json([]), base: json([COLOUR]) }))).code).toBe(0);
    expect((await main([], deps(tree, { baseline: json([COLOUR]), base: json([COLOUR]) }))).code).toBe(0);
  });

  it('AC-3: counts a baseline absent at the base as no growth', async () => {
    expect((await main([], deps(tree, { baseline: json([COLOUR]), base: null }))).code).toBe(0);
  });

  it('compares with the merge-base of HEAD and origin/main by default, and of the ref --base names', async () => {
    const seenRefs: string[] = [];
    await main([], deps(tree, { baseline: json([COLOUR]), seenRefs }));
    await main(['--base', 'origin/feat/x'], deps(tree, { baseline: json([COLOUR]), seenRefs }));
    await main(['--base=origin/feat/y'], deps(tree, { baseline: json([COLOUR]), seenRefs }));
    expect(seenRefs).toEqual(['origin/main', 'origin/feat/x', 'origin/feat/y']);
  });

  it('stops with exit 2, naming it, when the base cannot be read', async () => {
    const { code, lines } = await main(['--base', 'origin/missing'], deps(tree, { baseline: json([COLOUR]) }));
    expect(code).toBe(2);
    expect(lines.join('\n')).toContain('origin/missing');
  });

  it('fails on a baseline line whose breach is gone, naming the line to delete', async () => {
    const fixed = { ...tree, [OTHER]: '.b { color: var(--color-text-primary); }\n' };
    const { code, lines } = await main([], deps(fixed, { baseline: json([COLOUR]) }));
    expect(code).toBe(1);
    expect(lines.join('\n')).toContain('delete');
    expect(lines).toContain(COLOUR);
  });

  it('fails on a baseline line whose file is gone', async () => {
    const gone = 'apps/galaxy/src/old/old.css color-no-hex';
    const { code, lines } = await main([], deps(tree, { baseline: json([COLOUR, gone].sort()) }));
    expect(code).toBe(1);
    expect(lines).toContain(gone);
  });

  it('AC-5: never reads a stylesheet under the arcade or HOME, nor one outside apps/galaxy/src', async () => {
    const read: string[][] = [];
    const { code } = await main([], deps(tree, { baseline: json([COLOUR]), read }));
    expect(code).toBe(0);
    expect(read).toEqual([[PAGE, OTHER, 'apps/galaxy/src/ask/ask.tsx'].sort()]);
  });

  it('AC-5: never reads a TSX under the arcade or HOME', async () => {
    const files = { ...tree, 'apps/galaxy/src/arcade/Hud.tsx': 'export const H = () => <button style={{ top: 1 }} />;\n', 'apps/galaxy/src/home/Home.tsx': 'export const H = () => <table />;\n' };
    expect((await main([], deps(files, { baseline: json([COLOUR]) }))).code).toBe(0);
  });

  it('AC-4: a raw button in a page fails, naming the file and raw-component', async () => {
    const file = 'apps/galaxy/src/ask/Raw.tsx';
    const files = { ...tree, [file]: 'export const A = () => <button type="button">Go</button>;\n' };
    const { code, lines } = await main([], deps(files, { baseline: json([COLOUR]) }));
    expect(code).toBe(1);
    expect(lines).toContain(`${file} raw-component`);
  });

  it('AC-4: a raw table, dialog, input, select, textarea or a replaced class fails; a Button from @omni/ui passes', async () => {
    for (const body of ['<table />', '<dialog />', '<input />', '<select />', '<textarea />', '<div className="x dossier-approve" />', '<div className={`pitch-action ${y}`} />']) {
      const file = 'apps/galaxy/src/ask/Raw.tsx';
      const { code, lines } = await main([], deps({ ...tree, [file]: `export const A = () => ${body};\n` }, { baseline: json([COLOUR]) }));
      expect({ body, code }).toEqual({ body, code: 1 });
      expect(lines).toContain(`${file} raw-component`);
    }
    const good = "import { Button } from '@omni/ui';\nexport const A = () => <Button className=\"dossier-approver\">Go</Button>;\n";
    expect((await main([], deps({ ...tree, 'apps/galaxy/src/ask/Good.tsx': good }, { baseline: json([COLOUR]) }))).code).toBe(0);
  });

  it('a style prop fails as inline-style', async () => {
    const file = 'apps/galaxy/src/ask/Styled.tsx';
    const files = { ...tree, [file]: 'export const A = () => <div style={{ top: 1 }} />;\n' };
    const { code, lines } = await main([], deps(files, { baseline: json([COLOUR]) }));
    expect(code).toBe(1);
    expect(lines).toContain(`${file} inline-style`);
  });

  it('reads the classes @omni/ui components replace from the meta files', () => {
    const metas: Record<string, string> = { a: "replaces: ['x-one', 'x-two'],", b: "replaces: ['x-one'],", c: 'no list' };
    expect(replacedClasses((file) => metas[file] ?? '', () => ['a', 'b', 'c'])).toEqual(['x-one', 'x-two']);
  });

  it('AC-5: never reads them even when named', async () => {
    const read: string[][] = [];
    const { code } = await main(['apps/galaxy/src/arcade/hud.css', 'apps/galaxy/src/home/'], deps(tree, { baseline: json([]), read }));
    expect(code).toBe(0);
    expect(read).toEqual([[]]);
  });

  it('given paths, reads only those among its stylesheets, and judges only their baseline lines', async () => {
    const read: string[][] = [];
    const elsewhere = 'apps/galaxy/src/old/old.css color-no-hex';
    const { code } = await main([`./${PAGE}`, 'apps/galaxy/src/ask/ask.tsx'], deps(tree, { baseline: json([COLOUR, elsewhere].sort()), read }));
    expect(code).toBe(0);
    expect(read).toEqual([[PAGE, 'apps/galaxy/src/ask/ask.tsx']]);
    const folder = await main(['apps/galaxy/src/outbox'], deps(tree, { baseline: json([]), read }));
    expect(folder.code).toBe(1);
    expect(folder.lines).toContain(COLOUR);
  });

  it('holds one line per file and rule, however many times the file breaks it', async () => {
    const files = { ...tree, [OTHER]: '.b { border: 1px solid #fff; }\n.c { outline: 1px solid #000; }\n' };
    expect((await main([], deps(files, { baseline: json([COLOUR]) }))).code).toBe(0);
  });

  it('fails on a baseline that is not sorted, one line per file and rule', async () => {
    const page = `${PAGE} color-no-hex`;
    const files = { ...tree, [PAGE]: '.a { border: 1px solid #000; }\n' };
    const { code, lines } = await main([], deps(files, { baseline: json([COLOUR, page]) }));
    expect(code).toBe(1);
    expect(lines.join('\n')).toContain('sorted');
    expect((await main([], deps(tree, { baseline: json([COLOUR, COLOUR]) }))).code).toBe(1);
  });

  it('reads a missing baseline as an empty one', async () => {
    const { code, lines } = await main([], deps(tree, { baseline: null }));
    expect(code).toBe(1);
    expect(lines).toContain(COLOUR);
  });

  it('stops with exit 2 on a malformed baseline or argument', async () => {
    expect((await main([], deps(tree, { baseline: '{"breaches": [42]}' }))).code).toBe(2);
    expect((await main([], deps(tree, { baseline: 'not json' }))).code).toBe(2);
    expect((await main([], deps(tree, { baseline: json([COLOUR]), base: '{}' }))).code).toBe(2);
    expect((await main(['--base'], deps(tree, { baseline: json([COLOUR]) }))).code).toBe(2);
    expect((await main(['--write'], deps(tree, { baseline: json([COLOUR]) }))).code).toBe(2);
  });
});

describe('the design ratchet, on the tracked tree', () => {
  it(`finds no breach ${BASELINE} does not list, and no line there whose breach is gone`, async () => {
    const tracked = execFileSync('git', ['ls-files', '-z', 'apps/galaxy/src'], { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean);
    const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');
    const metas = readdirSync(join(repoRoot, 'packages/ui/src')).filter((file) => file.endsWith('.meta.ts')).map((file) => `packages/ui/src/${file}`);
    const uiClasses = replacedClasses(read, () => metas);
    // The base is the CI's to compare (s6): here the baseline is held exact, and growth is the fixtures'.
    const real: Deps = { tracked: () => tracked, lint: async (paths) => [...(await stylelintSheets(read)(paths)), ...(await eslintPages(read, uiClasses)(paths))], baseline: () => read(BASELINE), git: fakeGit(null) };
    const { code, lines } = await main([], real);
    expect({ code, lines }).toEqual({ code: 0, lines: [expect.stringMatching(/^design ratchet: \d+ files read, \d+ breach(es)?, each listed/)] });
  });
});

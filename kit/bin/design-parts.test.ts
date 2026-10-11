// `omni design parts` (PRD 1559, s1): the closed list of parts DESIGN.md holds — each part with its
// variants, states and code paths, then the reference screens and whatever in the file does not
// read. With no DESIGN.md it points at `/omni:pixel-perfect init`; with design off it prints
// `design: off`. It only reports: exit 0 in every case, on a fixture repository. `omni config
// design.system` prints the path read, `DESIGN.md` when the config names none.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const HEAD = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const ON = 'design:\n  enabled: true\n';

const SYSTEM = `---
colors:
  primary: "#2563eb"
---

## Components

### Button

- **Summary:** the one way to start an action.
- **Variants:** primary, secondary, ghost
- **States:** default, hover, focus-visible, active, disabled, loading
- **Code:** \`src/ui/Button.tsx\`

### EmptyState

- **Summary:** what a list shows with nothing in it.
- **States:** default

## Reference screens

- \`quotes-list\` — a list with its empty, loading and error states
`;

async function run(root: string, args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(args, { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni config design.system', () => {
  it('prints DESIGN.md when unset, and the path a repository names', async () => {
    const unset = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD + ON } });
    expect(await run(unset.root, ['config', 'design.system'])).toEqual({ code: 0, out: 'DESIGN.md\n', err: '' });
    const named = makeRepo({ git: true, files: { '.omni-loop/config.yml': `${HEAD}${ON}  system: docs/DESIGN.md\n` } });
    expect(await run(named.root, ['config', 'design.system'])).toEqual({ code: 0, out: 'docs/DESIGN.md\n', err: '' });
  });

  it('refuses an empty path', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `${HEAD}${ON}  system: ""\n` } });
    const { code, err } = await run(root, ['config', 'design.system']);
    expect(code).not.toBe(0);
    expect(err).toMatch(/design\.system/);
  });
});

describe('omni design parts', () => {
  it('lists every part with its variants, states and code paths, then the reference screens', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD + ON, 'DESIGN.md': SYSTEM } });
    expect(await run(root, ['design', 'parts'])).toEqual({
      code: 0,
      out: [
        'Button — variants: primary, secondary, ghost · states: default, hover, focus-visible, active, disabled, loading · code: src/ui/Button.tsx',
        'EmptyState — variants: none · states: default · code: none',
        '2 parts · DESIGN.md · reference screens: quotes-list',
        '',
      ].join('\n'),
      err: '',
    });
  });

  it('reads the file design.system names, and names what in it does not read', async () => {
    const { root } = makeRepo({
      git: true,
      files: { '.omni-loop/config.yml': `${HEAD}${ON}  system: docs/DESIGN.md\n`, 'docs/DESIGN.md': '# Our look\n\nWe like blue.\n' },
    });
    expect(await run(root, ['design', 'parts'])).toEqual({
      code: 0,
      out: ['0 parts · docs/DESIGN.md · reference screens: none', 'docs/DESIGN.md: no front matter of design tokens', 'docs/DESIGN.md: no Components section: no part is listed', ''].join('\n'),
      err: '',
    });
  });

  it('points at /omni:pixel-perfect init with no DESIGN.md, and exits 0', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD + ON } });
    expect(await run(root, ['design', 'parts'])).toEqual({ code: 0, out: 'parts: no DESIGN.md (run /omni:pixel-perfect init)\n', err: '' });
  });

  it('prints design: off while the flag is off, and exits 0', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD, 'DESIGN.md': SYSTEM } });
    expect(await run(root, ['design', 'parts'])).toEqual({ code: 0, out: 'design: off\n', err: '' });
  });

  it('refuses an operand as a usage mistake (exit 2)', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD + ON, 'DESIGN.md': SYSTEM } });
    const { code, err } = await run(root, ['design', 'parts', 'extra']);
    expect(code).toBe(2);
    expect(err).toMatch(/omni design parts/);
  });

  it('is named by omni help design', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD } });
    const { code, out } = await run(root, ['help', 'design']);
    expect(code).toBe(0);
    expect(out).toContain('omni design parts');
    expect(out).toContain('/omni:pixel-perfect init');
  });
});

// PRD 1559, s2: `omni design parts --check <page>` reads a mockup's marked screens only, as the word
// pass does, and `--check <ref>` reads what the branch changed since it left `<ref>`. Both only report:
// exit 0 in every case.
const PAGE = `<!doctype html><html><body>
<p>A caption the page writes for the reviewer. <button>Not read</button></p>
<section data-screen="quotes-list">
  <h1>Quotes</h1>
  <button data-part="Button" data-primary>New quote</button>
  <div data-part="EmptyState"><p>No quote yet.</p><a href="/new" class="btn">Start</a></div>
  <div data-part="FancyCard">A card no one listed</div>
  <button>Export</button>
  <input type="text" placeholder="Search quotes">
  <input type="hidden" name="token">
  <a href="/help">Help</a>
  <a href="/x" role="button">Open</a>
  <div data-content><button>A button the PRD's text shows</button><span data-part="Pasted">x</span></div>
</section>
</body></html>`;

describe('omni design parts --check <page>', () => {
  it('prints the off-list tags and the untagged controls of each marked screen, and exits 0', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD + ON, 'DESIGN.md': SYSTEM, 'mock.html': PAGE } });
    expect(await run(root, ['design', 'parts', '--check', 'mock.html'])).toEqual({
      code: 0,
      out: [
        'mock.html',
        '  screen quotes-list · 3 parts tagged',
        '    off-list: FancyCard',
        '    untagged: button "Export"',
        '    untagged: input "Search quotes"',
        '    untagged: a "Open"',
        '',
      ].join('\n'),
      err: '',
    });
  });

  it('says a screen is clean when every part is listed and every control tagged', async () => {
    const page = '<main data-screen="form"><button data-part="button">Save</button><div data-part="empty-state"><input></div></main>';
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD + ON, 'DESIGN.md': SYSTEM, 'mock.html': page } });
    expect((await run(root, ['design', 'parts', '--check', 'mock.html'])).out).toBe('mock.html\n  screen form · 2 parts tagged\n    parts: all listed\n');
  });

  it('skips a page with no marked screen', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD + ON, 'DESIGN.md': SYSTEM, 'mock.html': '<p><button>Go</button></p>' } });
    expect(await run(root, ['design', 'parts', '--check', 'mock.html'])).toEqual({
      code: 0,
      out: 'mock.html\n  no screen marked: skipped ([data-screen])\n',
      err: '',
    });
  });

  it('names a page it cannot read, and exits 0', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD + ON, 'DESIGN.md': SYSTEM } });
    const { code, out } = await run(root, ['design', 'parts', '--check', 'gone.html']);
    expect(code).toBe(0);
    expect(out).toMatch(/^gone\.html: cannot read — /);
  });

  it('points at init with no DESIGN.md, and prints design: off while the flag is off', async () => {
    const none = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD + ON, 'mock.html': PAGE } });
    expect(await run(none.root, ['design', 'parts', '--check', 'mock.html'])).toEqual({ code: 0, out: 'parts: no DESIGN.md (run /omni:pixel-perfect init)\n', err: '' });
    const off = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD, 'DESIGN.md': SYSTEM, 'mock.html': PAGE } });
    expect(await run(off.root, ['design', 'parts', '--check', 'mock.html'])).toEqual({ code: 0, out: 'design: off\n', err: '' });
  });

  it('refuses --check beside an operand, or on another verb, as a usage mistake', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD + ON, 'DESIGN.md': SYSTEM } });
    expect((await run(root, ['design', 'parts', 'extra', '--check', 'mock.html'])).code).toBe(2);
    expect((await run(root, ['design', 'screens', '--check', 'mock.html'])).code).toBe(2);
  });
});

const PATHS = '  paths: ["src/ui/", "src/pages/"]\n';
const SCREEN = `---
screen: quotes-list
status: draft
implements: [src/pages/Quotes.tsx]
---

## Regions
`;

/** A repository on `main` with DESIGN.md, a library screen and the Button part, then a `slice` branch committing `files`. */
function branched(config: string, files: Readonly<Record<string, string>>) {
  const repo = makeRepo({
    git: true,
    files: {
      '.omni-loop/config.yml': config,
      'DESIGN.md': SYSTEM,
      '.omni-loop/knowledge/design/screens/quotes-list.md': SCREEN,
      'src/ui/Button.tsx': 'export const Button = 1;\n',
    },
  });
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: repo.root, stdio: 'ignore' });
  git('checkout', '-q', '-b', 'slice');
  for (const [path, text] of Object.entries(files)) repo.write(path, text);
  git('add', '-A');
  git('commit', '-q', '-m', 'slice');
  return repo;
}

describe('omni design parts --check <ref>', () => {
  it('names the parts a diff changes and a new component file no part names and no screen claims, and exits 0', async () => {
    const { root } = branched(HEAD + ON + PATHS, {
      'src/ui/Button.tsx': 'export const Button = 2;\n',
      'src/ui/Fancy.tsx': 'export const Fancy = 1;\n',
      'src/ui/Fancy.test.tsx': 'test\n',
      'src/ui/tokens.ts': 'export const x = 1;\n',
      'src/pages/Quotes.tsx': 'export const Quotes = 1;\n',
      'src/lib/Other.tsx': 'export const Other = 1;\n',
    });
    expect(await run(root, ['design', 'parts', '--check', 'main'])).toEqual({
      code: 0,
      out: ['parts changed: Button', 'off-list: src/ui/Fancy.tsx (added: no part names it, no screen implements it)', ''].join('\n'),
      err: '',
    });
  });

  it('says so when the diff changes no part and adds none', async () => {
    const { root } = branched(HEAD + ON + PATHS, { 'README.md': 'hello\n' });
    expect((await run(root, ['design', 'parts', '--check', 'main'])).out).toBe('parts changed: none\nparts: all listed\n');
  });

  it('prints parts: unknown when it cannot read the ref, or design.paths is empty, and exits 0', async () => {
    const unread = branched(HEAD + ON + PATHS, { 'src/ui/Fancy.tsx': 'x\n' });
    expect(await run(unread.root, ['design', 'parts', '--check', 'nowhere'])).toEqual({
      code: 0,
      out: 'parts: unknown — cannot read nowhere: fetch it or pass another ref\n',
      err: '',
    });
    const empty = branched(HEAD + ON, { 'src/ui/Button.tsx': 'y\n', 'src/ui/Fancy.tsx': 'x\n' });
    expect(await run(empty.root, ['design', 'parts', '--check', 'main'])).toEqual({
      code: 0,
      out: 'parts changed: Button\nparts: unknown — design.paths is empty: judge from the diff whether a new file is a part\n',
      err: '',
    });
  });

  it('points at init with no DESIGN.md', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD + ON + PATHS } });
    expect((await run(root, ['design', 'parts', '--check', 'main'])).out).toBe('parts: no DESIGN.md (run /omni:pixel-perfect init)\n');
  });
});

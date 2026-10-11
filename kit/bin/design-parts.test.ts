// `omni design parts` (PRD 1559, s1): the closed list of parts DESIGN.md holds — each part with its
// variants, states and code paths, then the reference screens and whatever in the file does not
// read. With no DESIGN.md it points at `/omni:pixel-perfect init`; with design off it prints
// `design: off`. It only reports: exit 0 in every case, on a fixture repository. `omni config
// design.system` prints the path read, `DESIGN.md` when the config names none.
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

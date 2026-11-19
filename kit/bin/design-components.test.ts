// `omni design components` and `omni design component <name>` (PRD omni-loop-13), and the schema they
// read, from a fixture manifest. No network, no model.
import { describe, expect, it } from 'vitest';
import { parseManifest } from '../lib/design/manifest.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const HEAD = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const WITH = HEAD + 'design:\n  enabled: true\n  manifest: design-system.json\n';

const theme = { omni: '#111111', light: '#ffffff', dark: '#000000' };

type Fixture = {
  'omni-design': number;
  tokens: { name: string; role: string; themes: Record<string, string> }[];
  components: Record<string, unknown>[];
  patterns: unknown[];
  surfaces: string[];
};

function fixture(): Fixture {
  return {
    'omni-design': 1,
    tokens: [{ name: 'canvas', role: 'color', themes: { ...theme } }],
    components: [
      {
        name: 'Button',
        import: '@omni/ui',
        variants: { variant: ['primary', 'secondary'], size: ['md', 'sm'] },
        do: ['Name the action with a verb.'],
        dont: ['Put two primary buttons in one view.'],
        replaces: ['pitch-action'],
        example: '<Button variant="primary">Approve</Button>',
      },
      { name: 'Badge', import: '@omni/ui', example: '<Badge>new</Badge>' },
      { name: 'Card', import: '@omni/ui', example: '<Card />' },
    ],
    patterns: [],
    surfaces: ['apps/galaxy/app/**'],
  };
}

async function run(files: Record<string, string>, args: string[]) {
  const { root } = makeRepo({ git: true, files });
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['design', ...args], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

const files = (manifest: unknown, config = WITH) => ({ '.omni-loop/config.yml': config, 'design-system.json': JSON.stringify(manifest) });

describe('the manifest schema', () => {
  it('accepts a valid manifest', () => {
    expect(parseManifest(fixture()).kind).toBe('ok');
  });

  const refusals: [string, (m: Fixture) => void, RegExp][] = [
    ['no omni-design key', (m) => delete (m as Partial<Fixture>)['omni-design'], /^omni-design:/],
    ['a version other than 1', (m) => (m['omni-design'] = 2), /^omni-design:/],
    ['a component without an import', (m) => delete m.components[0]?.['import'], /^components\.0\.import:/],
    ['a component without an example', (m) => delete m.components[1]?.['example'], /^components\.1\.example:/],
    ['a token without its three themes', (m) => delete m.tokens[0]?.themes['dark'], /^tokens\.0\.themes\.dark:/],
  ];
  for (const [name, mutate, field] of refusals) {
    it(`refuses ${name} with one line naming the field`, () => {
      const manifest = fixture();
      mutate(manifest);
      const read = parseManifest(manifest);
      expect(read.kind).toBe('refused');
      if (read.kind === 'refused') {
        expect(read.refusals).toHaveLength(1);
        expect(read.refusals[0]).toMatch(field);
        expect(read.refusals[0]).not.toContain('\n');
      }
    });
  }
});

describe('omni design components', () => {
  it('AC-2: prints one line per component, its name and import, in at most 1536 bytes', async () => {
    const { code, out, err } = await run(files(fixture()), ['components']);
    expect(err).toBe('');
    expect(code).toBe(0);
    expect(out.trimEnd().split('\n')).toEqual(['Button  @omni/ui', 'Badge  @omni/ui', 'Card  @omni/ui']);
    expect(Buffer.byteLength(out)).toBeLessThanOrEqual(1536);
  });

  it('AC-4: with no design.manifest prints one line and exits 0, for both commands', async () => {
    for (const args of [['components'], ['component', 'Button']]) {
      const { code, out } = await run({ '.omni-loop/config.yml': HEAD }, args);
      expect(code).toBe(0);
      expect(out).toMatch(/^this repository has no design manifest.*\n$/);
    }
  });

  it('prints the refusals and exits 1 when the manifest fails the schema', async () => {
    const bad = fixture();
    bad['omni-design'] = 2;
    const { code, out } = await run(files(bad), ['components']);
    expect(code).toBe(1);
    expect(out).toMatch(/omni-design:/);
  });

  it('prints one line and exits 1 when the manifest file cannot be read', async () => {
    const { code, out } = await run({ '.omni-loop/config.yml': WITH }, ['components']);
    expect(code).toBe(1);
    expect(out).toMatch(/^design-system\.json: cannot read/);
  });

  it('stops with exit 2 on a stray operand', async () => {
    expect((await run(files(fixture()), ['components', 'x'])).code).toBe(2);
    expect((await run(files(fixture()), ['component'])).code).toBe(2);
  });
});

describe('omni design component <name>', () => {
  it("AC-3: prints Button's variants, do and don't and one example in at most 800 bytes", async () => {
    const { code, out } = await run(files(fixture()), ['component', 'Button']);
    expect(code).toBe(0);
    expect(out).toContain('variant: primary | secondary');
    expect(out).toContain('size: md | sm');
    expect(out).toContain('Name the action with a verb.');
    expect(out).toContain('Put two primary buttons in one view.');
    expect(out).toContain('<Button variant="primary">Approve</Button>');
    expect(Buffer.byteLength(out)).toBeLessThanOrEqual(800);
  });

  it('keeps the example and stays within 800 bytes when the lists are long', async () => {
    const manifest = fixture();
    manifest.components[0] = { ...manifest.components[0], do: Array.from({ length: 30 }, (_, i) => `Do the thing number ${i} with care.`) };
    const { out } = await run(files(manifest), ['component', 'Button']);
    expect(Buffer.byteLength(out)).toBeLessThanOrEqual(800);
    expect(out).toContain('<Button variant="primary">Approve</Button>');
  });

  it('names the closest names and exits 1 for an unknown component', async () => {
    const { code, out } = await run(files(fixture()), ['component', 'Buton']);
    expect(code).toBe(1);
    expect(out.trimEnd().split('\n')).toHaveLength(1);
    expect(out).toMatch(/closest: Button/);
  });
});

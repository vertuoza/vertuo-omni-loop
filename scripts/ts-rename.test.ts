// The rename (PRD 725, s2): `scripts/ts-rename.mjs` turns every `.mjs` file of a repository into
// `.ts`, outside `kit/dist/`, `.omni-loop/bin/` and itself, opens each with `// @ts-nocheck`, and
// rewrites every import and path that names a renamed file. A second run changes nothing. The
// fixture is a small git repository in a temporary folder; nothing here touches this checkout.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('./ts-rename.mjs', import.meta.url));

const FILES = {
  'package.json': JSON.stringify({
    name: 'acme-widgets',
    scripts: { build: 'node kit/build.mjs', play: 'node --env-file-if-exists=.env game/cli/play.mjs' },
    exports: { '.': { types: './src/index.d.ts', default: './src/index.mjs' } },
  }, null, 2) + '\n',
  'kit/build.mjs': "#!/usr/bin/env node\nimport { main } from './bin/omni.mjs';\nmain();\n",
  'kit/bin/omni.mjs': "export async function main(name) {\n  return import(`./commands/${name}.mjs`);\n}\n",
  'kit/bin/commands/hello.mjs': "export const hello = 'hello';\n",
  'kit/bin/install.mjs': "export const later = (dir) => `node ${dir}/bin/omni.mjs update`;\nexport const LAYOUT = 'Tests sit beside the code, as `*.test.mjs`.';\nexport const BIN = (dir) => join(dir, 'omni.mjs');\n",
  'kit/bin/omni.test.mjs': "import { main } from './omni.mjs';\nimport { hello } from 'acme-widgets/kit/bin/commands/hello.mjs';\n// kit/build.mjs bundles kit/bin/omni.mjs into kit/dist/omni.mjs.\nconst installed = '.omni-loop/bin/omni.mjs';\n",
  'kit/dist/omni.mjs': "// kit/bin/omni.mjs\nexport {};\n",
  'game/cli/play.mjs': "import '../../kit/bin/omni.mjs';\n",
  'src/index.mjs': "export * from './logo.mjs';\n",
  'src/logo.mjs': 'export const LOGO = 1;\n',
  'src/logo.d.mts': 'export const LOGO: number;\n',
  'src/index.d.ts': "export * from './logo.mjs';\n",
  '.omni-loop/bin/omni.mjs': "#!/usr/bin/env node\nimport { main } from '../../kit/bin/omni.mjs';\nmain();\n",
  '.github/workflows/release.yml': 'jobs:\n  release:\n    steps:\n      - run: node kit/build.mjs\n',
  'tools/entry.jsonc': '{ "entry": ["game/cli/*.mjs", "kit/bin/omni.mjs"] }\n',
  'docs/notes.md': 'Run `node kit/build.mjs`; another repository runs `lib/other.mjs`.\n',
  '.omni-loop/delivery/shipped/0001-start/spec.md': 'Built `kit/build.mjs`.\n',
  '.omni-loop/knowledge/adr/0001-build.md': 'We build with `kit/build.mjs`.\n',
  '.omni-loop/knowledge/playbook/verification.md': 'The preflight builds with `kit/build.mjs`, as `vitest.config.mjs` says.\n',
  'vitest.config.mjs': 'export default {};\n',
};

const roots: string[] = [];
afterEach(() => {
  while (roots.length) rmSync(roots.pop() as string, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ts-rename-'));
  roots.push(root);
  for (const [path, text] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'fixture');
  return root;
}

const rename = (root: string) => execFileSync(process.execPath, [SCRIPT, root], { encoding: 'utf8' });

function snapshot(root: string) {
  const out: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === '.git') continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else out[relative(root, path)] = readFileSync(path, 'utf8');
    }
  };
  walk(root);
  return out;
}

const read = (root: string, path: string) => readFileSync(join(root, path), 'utf8');

describe('scripts/ts-rename.mjs', () => {
  it('leaves no .mjs file outside kit/dist/ and .omni-loop/bin/', () => {
    const root = fixture();
    rename(root);
    const left = Object.keys(snapshot(root)).filter((path) => path.endsWith('.mjs'));
    expect(left.sort()).toEqual(['.omni-loop/bin/omni.mjs', 'kit/dist/omni.mjs']);
    expect(existsSync(join(root, 'vitest.config.ts'))).toBe(true);
    expect(existsSync(join(root, 'kit/bin/omni.ts'))).toBe(true);
    expect(existsSync(join(root, 'kit/bin/omni.test.ts'))).toBe(true);
  });

  it('opens each renamed file with // @ts-nocheck, after its hashbang', () => {
    const root = fixture();
    rename(root);
    expect(read(root, 'kit/bin/commands/hello.ts')).toBe("// @ts-nocheck\nexport const hello = 'hello';\n");
    expect(read(root, 'kit/build.ts').split('\n').slice(0, 2)).toEqual(['#!/usr/bin/env node', '// @ts-nocheck']);
  });

  it('rewrites imports, package subpaths, dynamic imports and paths that name a renamed file, and no pattern that starts with a wildcard, and no bare file name', () => {
    const root = fixture();
    rename(root);
    expect(read(root, 'kit/build.ts')).toContain("from './bin/omni.ts'");
    expect(read(root, 'kit/bin/omni.ts')).toContain('import(`./commands/${name}.ts`)');
    const test = read(root, 'kit/bin/omni.test.ts');
    expect(test).toContain("from './omni.ts'");
    expect(test).toContain("from 'acme-widgets/kit/bin/commands/hello.ts'");
    expect(test).toContain('// kit/build.ts bundles kit/bin/omni.ts into kit/dist/omni.mjs.');
    expect(test).toContain("'.omni-loop/bin/omni.mjs'");
    expect(read(root, 'kit/bin/install.ts')).toBe("// @ts-nocheck\n" + FILES['kit/bin/install.mjs']);
    expect(read(root, 'game/cli/play.ts')).toContain("import '../../kit/bin/omni.ts'");
    expect(read(root, '.omni-loop/bin/omni.mjs')).toContain("from '../../kit/bin/omni.ts'");
    expect(read(root, '.github/workflows/release.yml')).toContain('node kit/build.ts');
    expect(read(root, 'tools/entry.jsonc')).toBe('{ "entry": ["game/cli/*.ts", "kit/bin/omni.ts"] }\n');
    expect(read(root, 'docs/notes.md')).toBe('Run `node kit/build.ts`; another repository runs `lib/other.mjs`.\n');
    const pkg = JSON.parse(read(root, 'package.json'));
    expect(pkg.scripts).toEqual({ build: 'node kit/build.ts', play: 'node --env-file-if-exists=.env game/cli/play.ts' });
    expect(pkg.exports['.'].default).toBe('./src/index.ts');
  });

  it('leaves the delivery and decision records as they were written, and rewrites the playbook', () => {
    const root = fixture();
    rename(root);
    expect(read(root, '.omni-loop/delivery/shipped/0001-start/spec.md')).toBe('Built `kit/build.mjs`.\n');
    expect(read(root, '.omni-loop/knowledge/adr/0001-build.md')).toBe('We build with `kit/build.mjs`.\n');
    expect(read(root, '.omni-loop/knowledge/playbook/verification.md')).toBe('The preflight builds with `kit/build.ts`, as `vitest.config.ts` says.\n');
  });

  it('leaves the bundle untouched, and a declaration file still naming its hand-written declarations', () => {
    const root = fixture();
    rename(root);
    expect(read(root, 'kit/dist/omni.mjs')).toBe(FILES['kit/dist/omni.mjs']);
    expect(read(root, 'src/index.d.ts')).toBe("export * from './logo.mjs';\n");
    expect(read(root, 'src/index.ts')).toBe("// @ts-nocheck\nexport * from './logo.ts';\n");
  });

  it('changes nothing when run a second time', () => {
    const root = fixture();
    rename(root);
    const once = snapshot(root);
    rename(root);
    expect(snapshot(root)).toEqual(once);
  });
});

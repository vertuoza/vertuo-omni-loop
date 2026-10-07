// No provider's name leaks (PRD 1108 s5, the spec's acceptance 9): a provider is named only by its own
// file, its own test and the registry, so removing its file and its registry line leaves every other
// test green. Two rules, proven on fixtures first, then run on every file git knows:
//
// - `import`: no file imports a provider's file but the registry and the provider's own test. Code
//   reaches a provider through the registry, by kind and setting, never by its file.
// - `name`: within the providers' folder, a provider's id is written as a string only in its own file,
//   its own test (or those of a namesake of another kind), the registry and the registry's test. A setting names a provider as data (a product's
//   Pitch settings), which is no leak: an id gone from the registry falls back to its kind's default.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const FOLDER = 'kit/lib/pitch/providers';
const REGISTRY = `${FOLDER}/registry.ts`;

type Source = { path: string; text: string };
type Provider = { path: string; id: string };
type Leak = { path: string; rule: 'import' | 'name'; provider: string };

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

/** The provider files the registry imports, read from its text. */
function registered(registryText: string): string[] {
  return [...registryText.matchAll(SPECIFIER)].map((match) => match[1] ?? '').filter((specifier) => /^\.\/[a-z]+\/[a-z0-9-]+\.ts$/.test(specifier)).map((specifier) => normalize(join(FOLDER, specifier)));
}

/** The id a provider file declares (`id: '…'`). */
function idOf(text: string, path: string): string {
  const id = /\bid:\s*'([^']+)'/.exec(text)?.[1];
  if (id === undefined) throw new Error(`${path} declares no id`);
  return id;
}

const testOf = (path: string): string => path.replace(/\.ts$/, '.test.ts');

/** The files `source` imports by a relative path, resolved from the repository's root. */
const importsOf = (source: Source): string[] =>
  [...source.text.matchAll(SPECIFIER)].map((match) => match[1] ?? '').filter((specifier) => specifier.startsWith('.')).map((specifier) => normalize(join(dirname(source.path), specifier)));

/** Every leak of a provider's file or name in `sources`. */
function leaks(sources: readonly Source[], providers: readonly Provider[]): Leak[] {
  const found: Leak[] = [];
  for (const provider of providers) {
    // Two kinds may each have a provider of the same name (music and fonts each read an uploaded file): each one's own files may write it.
    const namesakes = providers.filter((other) => other.id === provider.id).flatMap((other) => [other.path, testOf(other.path)]);
    const allowed = new Set([...namesakes, REGISTRY, testOf(REGISTRY)]);
    for (const source of sources) {
      if (source.path !== REGISTRY && source.path !== testOf(provider.path) && importsOf(source).includes(provider.path)) found.push({ path: source.path, rule: 'import', provider: provider.id });
      const quoted = new RegExp(`(['"\`])${provider.id.replace(/[-]/g, '\\-')}\\1`);
      if (source.path.startsWith(`${FOLDER}/`) && !allowed.has(source.path) && quoted.test(source.text)) found.push({ path: source.path, rule: 'name', provider: provider.id });
    }
  }
  return found;
}

const FAKE_REGISTRY = `import { jukebox } from './music/jukebox.ts';\nimport type { Kind } from './types.ts';\nexport const R = [jukebox];\n`;
const JUKEBOX: Provider = { path: `${FOLDER}/music/jukebox.ts`, id: 'jukebox' };

describe('the guard, on fixtures', () => {
  it('reads the provider files from the registry, not its other imports', () => {
    expect(registered(FAKE_REGISTRY)).toEqual([JUKEBOX.path]);
    expect(idOf("export const jukebox = { kind: 'music', id: 'jukebox' };", JUKEBOX.path)).toBe('jukebox');
    expect(() => idOf('export const x = 1;', JUKEBOX.path)).toThrow(/declares no id/);
  });

  it('lets the registry and the provider test import a provider, and nothing else', () => {
    const sources: Source[] = [
      { path: REGISTRY, text: FAKE_REGISTRY },
      { path: `${FOLDER}/music/jukebox.test.ts`, text: "import { jukebox } from './jukebox.ts';" },
      { path: 'kit/lib/pitch/render.ts', text: "import { jukebox } from './providers/music/jukebox.ts';" },
      { path: 'kit/bin/commands/pitch.ts', text: "const m = await import('../../lib/pitch/providers/music/jukebox.ts');" },
      { path: 'kit/lib/pitch/studio.ts', text: "import { providerFor } from './providers/registry.ts';" },
    ];
    expect(leaks(sources, [JUKEBOX])).toEqual([
      { path: 'kit/lib/pitch/render.ts', rule: 'import', provider: 'jukebox' },
      { path: 'kit/bin/commands/pitch.ts', rule: 'import', provider: 'jukebox' },
    ]);
  });

  it("refuses a provider's id written as a string elsewhere in the providers' folder", () => {
    const sources: Source[] = [
      { path: JUKEBOX.path, text: "export const jukebox = { id: 'jukebox' };" },
      { path: REGISTRY, text: "const DEFAULTS = { music: 'jukebox' };" },
      { path: `${FOLDER}/registry.test.ts`, text: "music('jukebox')" },
      { path: `${FOLDER}/contract.test.ts`, text: "if (provider.id === 'jukebox') skip();" },
      { path: `${FOLDER}/music/other.ts`, text: 'const name = "jukebox";' },
      { path: `${FOLDER}/music/other.test.ts`, text: '// the jukebox is not named as a string here' },
    ];
    expect(leaks(sources, [JUKEBOX])).toEqual([
      { path: `${FOLDER}/contract.test.ts`, rule: 'name', provider: 'jukebox' },
      { path: `${FOLDER}/music/other.ts`, rule: 'name', provider: 'jukebox' },
    ]);
  });
});

describe('the guard, on the repository', () => {
  const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.ts', '*.tsx', '*.mts'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter((path) => path !== '' && !path.startsWith('kit/dist/'));
  const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');
  const providers = registered(read(REGISTRY)).map((path) => ({ path, id: idOf(read(path), path) }));

  it('finds every registered provider', () => {
    expect(providers.length).toBeGreaterThanOrEqual(8);
    expect(providers.every((provider) => relative(FOLDER, provider.path).split('/').length === 2)).toBe(true);
  });

  it('finds no provider named outside its file, its test and the registry', () => {
    const sources = tracked.flatMap((path) => {
      try {
        return [{ path, text: read(path) }];
      } catch {
        return [];
      }
    });
    expect(leaks(sources, providers)).toEqual([]);
  });
});

// The import guard (PRD 1066, s3; ADR-0058): what a source file may import beyond its own zone, Node
// built-ins and npm packages. Every TypeScript file git tracks is read from its syntax tree: a static
// import, an `export … from`, a dynamic `import('literal')`, an `import x = require(…)` and a type's
// `import('…')`, type-only ones included, since a type couples the layers all the same. The three
// spellings this repository uses (a relative path, `vertuo-omni-plan/…` and `@omni/*`, through the
// workspace packages' names and exports) resolve to a zone, and the zone's row of the rule table
// decides. A test may also import `kit/test` and `kit/bin`; every other rule holds for tests too.
// Then the arcade's client and server: a module the client can reach never reaches one marked
// `server-only`, and the refusal prints the chain; an arcade source file that imports a Node
// built-in or the server environment module carries the marker. Last, fallow finds no import
// cycle. No allowlist, no comment escape: the exceptions are named rules below, each with its
// reason. The rules are proven on fixtures first, then the guard runs on every file git tracks.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** One fixture file's findings, as `line rule`. */
const found = (path: string, text: string): string[] => findViolations([{ path, text }]).map((v) => `${v.line} ${v.rule}`);
/** Several fixture files' findings, as `path:line rule`. */
const foundIn = (files: readonly File[]): string[] => findViolations(files).map((v) => `${v.path}:${v.line} ${v.rule}`);

describe('the import guard, on fixtures: the rule table', () => {
  it('refuses kit/lib importing kit/bin, kit/test, the game, an app or a package, naming the file, the line and the rule', () => {
    expect(findViolations([{ path: 'kit/lib/a.ts', text: "export const a = 1;\nimport { main } from '../bin/omni.ts';\n" }])).toEqual([
      { path: 'kit/lib/a.ts', line: 2, rule: 'kit/lib may import nothing beyond its zone, not kit/bin', text: "import { main } from '../bin/omni.ts';" },
    ]);
    expect(found('kit/lib/a.ts', "import { makeRepo } from '../test/fixture.ts';\n")).toEqual(['1 kit/lib may import nothing beyond its zone, not kit/test']);
    expect(found('kit/lib/x/a.ts', "import { score } from '../../../game/score.ts';\n")).toEqual(['1 kit/lib may import nothing beyond its zone, not game']);
    expect(found('kit/lib/a.ts', "import { x } from '../../apps/galaxy/src/x.ts';\n")).toEqual(['1 kit/lib may import nothing beyond its zone, not apps/galaxy']);
    expect(found('kit/lib/a.ts', "import { tokens } from '../../packages/design/src/index.ts';\n")).toEqual(['1 kit/lib may import nothing beyond its zone, not packages/design']);
  });

  it('lets kit/lib import itself, Node built-ins and npm packages', () => {
    expect(found('kit/lib/a.ts', "import { readFileSync } from 'node:fs';\nimport { z } from 'zod';\nimport { b } from './b.ts';\nimport { ids } from '../lib/ids.ts';\n")).toEqual([]);
  });

  it('lets kit/bin import kit/lib, and refuses it kit/test, the game and the apps', () => {
    expect(found('kit/bin/a.ts', "import { config } from '../lib/config.ts';\n")).toEqual([]);
    expect(found('kit/bin/a.ts', "import { makeRepo } from '../test/fixture.ts';\n")).toEqual(['1 kit/bin may import kit/lib, not kit/test']);
    expect(found('kit/bin/a.ts', "import { score } from '../../game/score.ts';\n")).toEqual(['1 kit/bin may import kit/lib, not game']);
    expect(found('kit/bin/a.ts', "import { x } from '../../apps/omni-app/src/x.ts';\n")).toEqual(['1 kit/bin may import kit/lib, not apps/omni-app']);
  });

  it("lets the kit's build scripts import kit/lib and kit/bin, and refuses them the game and the apps", () => {
    expect(found('kit/build.ts', "import { main } from './bin/omni.ts';\nimport { x } from './lib/x.ts';\n")).toEqual([]);
    expect(found('kit/release/release.ts', "import { x } from '../lib/x.ts';\n")).toEqual([]);
    expect(found('kit/release/release.ts', "import { score } from '../../game/score.ts';\n")).toEqual([
      "1 the kit's build scripts may import kit/lib, kit/bin, not game",
    ]);
  });

  it('lets the game import kit/lib/ids and kit/lib/env, and refuses it the rest of the kit, the apps and the packages', () => {
    expect(found('game/a.ts', "import type { PrdNumber } from '../kit/lib/ids.ts';\nimport { readEnv } from '../kit/lib/env/read.ts';\n")).toEqual([]);
    expect(found('game/a.ts', "import { loadConfig } from '../kit/lib/config.ts';\n")).toEqual(['1 game may import kit/lib/ids, kit/lib/env, the supabase types, not kit/lib']);
    expect(found('game/a.ts', "import { main } from '../kit/bin/omni.ts';\n")).toEqual(['1 game may import kit/lib/ids, kit/lib/env, the supabase types, not kit/bin']);
    expect(found('game/a.ts', "import { x } from '../apps/galaxy/src/x.ts';\n")).toEqual(['1 game may import kit/lib/ids, kit/lib/env, the supabase types, not apps/galaxy']);
    expect(found('game/a.ts', "import { x } from '../packages/galaxy/src/x.ts';\n")).toEqual(['1 game may import kit/lib/ids, kit/lib/env, the supabase types, not packages/galaxy']);
  });

  it('lets packages/galaxy import the game, @omni/design and kit/lib/ids, and refuses it the apps and the rest of the kit', () => {
    expect(found('packages/galaxy/src/a.ts', "import { rulebook } from 'vertuo-omni-plan/game/rulebook.ts';\nimport { tokens } from '../../design/src/index.ts';\nimport type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';\n")).toEqual([]);
    expect(found('packages/galaxy/src/a.ts', "import { x } from '../../../apps/galaxy/src/x.ts';\n")).toEqual(['1 packages/galaxy may import game, packages/design, kit/lib/ids, not apps/galaxy']);
    expect(found('packages/galaxy/src/a.ts', "import { narrow } from 'vertuo-omni-plan/kit/lib/narrow.ts';\n")).toEqual(['1 packages/galaxy may import game, packages/design, kit/lib/ids, not kit/lib']);
  });

  it('lets packages/design import kit/lib by package name only, and refuses it the apps and the game', () => {
    expect(found('packages/design/src/a.ts', "import { narrow } from 'vertuo-omni-plan/kit/lib/narrow.ts';\n")).toEqual([]);
    expect(found('packages/design/src/a.ts', "import { narrow } from '../../../kit/lib/narrow.ts';\n")).toEqual([
      '1 packages/design may import kit/lib (by package name), not kit/lib by a relative path',
    ]);
    expect(found('packages/design/src/a.ts', "import { rulebook } from 'vertuo-omni-plan/game/rulebook.ts';\n")).toEqual(['1 packages/design may import kit/lib (by package name), not game']);
    expect(found('packages/design/src/a.ts', "import { x } from '../../../apps/galaxy/src/x.ts';\n")).toEqual(['1 packages/design may import kit/lib (by package name), not apps/galaxy']);
  });

  it('lets the GitHub App import kit/lib, @omni/design and the supabase types, and refuses it the arcade, kit/bin, kit/test and the game', () => {
    expect(found('apps/omni-app/src/a.ts', "import { x } from 'vertuo-omni-plan/kit/lib/x.ts';\nimport type { Database } from '../../../supabase/database.types.ts';\n")).toEqual([]);
    expect(found('apps/omni-app/src/a.ts', "import { ask } from '../../galaxy/src/ask/api.ts';\n")).toEqual([
      '1 apps/omni-app may import kit/lib, packages/design, the supabase types, not apps/galaxy',
    ]);
    expect(found('apps/omni-app/src/a.ts', "import { dig } from 'vertuo-omni-plan/kit/bin/dig.ts';\n")).toEqual([
      '1 apps/omni-app may import kit/lib, packages/design, the supabase types, not kit/bin',
    ]);
    expect(found('apps/omni-app/src/a.ts', "import { rulebook } from 'vertuo-omni-plan/game/rulebook.ts';\n")).toEqual([
      '1 apps/omni-app may import kit/lib, packages/design, the supabase types, not game',
    ]);
  });

  it('lets the arcade import kit/lib, @omni/*, the game, the supabase types and the root manifest, and refuses it the GitHub App, kit/bin and kit/test', () => {
    const text = [
      "import { narrow } from 'vertuo-omni-plan/kit/lib/narrow.ts';",
      "import { Button } from '@omni/design';",
      "import { Galaxy } from '@omni/galaxy';",
      "import { rulebook } from 'vertuo-omni-plan/game/rulebook.ts';",
      "import type { Database } from '../../../supabase/database.types';",
      "import pkg from '../../../package.json' with { type: 'json' };",
      '',
    ].join('\n');
    expect(found('apps/galaxy/src/a.ts', text)).toEqual([]);
    expect(found('apps/galaxy/src/a.ts', "import { check } from '../../omni-app/src/check.ts';\n")).toEqual([
      '1 apps/galaxy may import kit/lib, packages/design, packages/galaxy, game, the supabase types, the root manifest, not apps/omni-app',
    ]);
    expect(found('apps/galaxy/src/a.ts', "import { dig } from 'vertuo-omni-plan/kit/bin/dig.ts';\n")).toEqual([
      '1 apps/galaxy may import kit/lib, packages/design, packages/galaxy, game, the supabase types, the root manifest, not kit/bin',
    ]);
    expect(found('apps/galaxy/src/a.ts', "import { sure } from 'vertuo-omni-plan/kit/test/assert.ts';\n")).toEqual([
      '1 apps/galaxy may import kit/lib, packages/design, packages/galaxy, game, the supabase types, the root manifest, not kit/test',
    ]);
  });

  it('lets the scripts import anything', () => {
    expect(found('scripts/a.ts', "import { makeRepo } from '../kit/test/fixture.ts';\nimport { x } from '../apps/galaxy/src/x.ts';\nimport { main } from '../kit/bin/omni.ts';\n")).toEqual([]);
  });

  it('lets a test also import kit/test and kit/bin, and holds every other rule for it', () => {
    expect(found('apps/galaxy/src/a.test.ts', "import { sure } from 'vertuo-omni-plan/kit/test/assert.ts';\nimport { dig } from 'vertuo-omni-plan/kit/bin/dig.ts';\n")).toEqual([]);
    expect(found('apps/galaxy/src/ask/test/helper.ts', "import { sure } from 'vertuo-omni-plan/kit/test/assert.ts';\n")).toEqual([]);
    expect(found('kit/lib/a.test.ts', "import { makeRepo } from '../test/fixture.ts';\nimport { main } from '../bin/omni.ts';\n")).toEqual([]);
    expect(found('apps/omni-app/src/a.test.ts', "import { ask } from '../../galaxy/src/ask/api.ts';\n")).toEqual([
      '1 apps/omni-app may import kit/lib, packages/design, the supabase types (a test also kit/test, kit/bin), not apps/galaxy',
    ]);
    expect(found('kit/lib/a.test.ts', "import { score } from '../../game/score.ts';\n")).toEqual(['1 kit/lib may import nothing beyond its zone (a test also kit/test, kit/bin), not game']);
  });

  it("lets the kit's own tests import kit/lib and kit/bin, and nothing else beyond the kit", () => {
    expect(found('kit/test/fixture.ts', "import { config } from '../lib/config.ts';\nimport { main } from '../bin/omni.ts';\n")).toEqual([]);
    expect(found('kit/test/fixture.ts', "import { score } from '../../game/score.ts';\n")).toEqual(['1 kit/test may import kit/lib, kit/bin (a test also kit/test, kit/bin), not game']);
  });

  it('refuses an import by package name that the importing package does not declare', () => {
    expect(found('apps/omni-app/src/a.ts', "import { Galaxy } from '@omni/galaxy';\n")).toEqual([
      '1 apps/omni-app does not declare @omni/galaxy',
      '1 apps/omni-app may import kit/lib, packages/design, the supabase types, not packages/galaxy',
    ]);
    expect(found('packages/galaxy/src/a.ts', "import { tokens } from '@omni/design';\n")).toEqual(['1 packages/galaxy does not declare @omni/design']);
    expect(found('kit/lib/a.ts', "import { tokens } from '@omni/design';\n")).toEqual([
      '1 the root package does not declare @omni/design',
      '1 kit/lib may import nothing beyond its zone, not packages/design',
    ]);
    expect(found('apps/galaxy/src/a.ts', "import { Galaxy } from '@omni/galaxy';\nimport { x } from 'vertuo-omni-plan/kit/lib/x.ts';\n")).toEqual([]);
  });

  it('reads no comment as an escape', () => {
    expect(found('kit/lib/a.ts', "// import-guard-allow: the CLI's path\nimport { main } from '../bin/omni.ts'; // allow\n")).toEqual([
      '2 kit/lib may import nothing beyond its zone, not kit/bin',
    ]);
  });

  it('skips a generated file and a file that is not TypeScript', () => {
    expect(found('supabase/database.types.ts', "import { x } from '../kit/bin/omni.ts';\n")).toEqual([]);
    expect(found('kit/lib/a.md', "import { main } from '../bin/omni.ts';\n")).toEqual([]);
  });
});

describe('the import guard, on fixtures: every way to import, in every spelling', () => {
  it('counts a type-only import, an export from, a dynamic import, an import-require and a type import like any other', () => {
    const text = [
      "import type { Command } from '../bin/omni.ts';",
      "export { main } from '../bin/omni.ts';",
      "export type { Command as C } from '../bin/omni.ts';",
      "export * from '../bin/omni.ts';",
      "const omni = await import('../bin/omni.ts');",
      "import cli = require('../bin/omni.ts');",
      "export type M = typeof import('../bin/omni.ts');",
      "import '../bin/omni.ts';",
      '',
    ].join('\n');
    expect(found('kit/lib/a.ts', text)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'].map((line) => `${line} kit/lib may import nothing beyond its zone, not kit/bin`));
  });

  it('reads a dynamic import of a computed path, a string and a comment as no import', () => {
    const text = [
      'declare const path: string;',
      'export const load = () => import(path);',
      "export const said = \"import { main } from '../bin/omni.ts'\";",
      "// import { main } from '../bin/omni.ts';",
      '',
    ].join('\n');
    expect(found('kit/lib/a.ts', text)).toEqual([]);
  });

  it('resolves a relative path, vertuo-omni-plan/… and @omni/* to the zone they name', () => {
    expect(found('game/a.ts', "import { x } from '../kit/lib/config.ts';\n")).toEqual(['1 game may import kit/lib/ids, kit/lib/env, the supabase types, not kit/lib']);
    expect(found('game/a.ts', "import { x } from 'vertuo-omni-plan/kit/lib/config.ts';\n")).toEqual(['1 game may import kit/lib/ids, kit/lib/env, the supabase types, not kit/lib']);
    const game = (specifier: string): string[] => found('game/a.ts', `import '${specifier}';\n`).slice(1);
    expect(game('@omni/design')).toEqual(['1 game may import kit/lib/ids, kit/lib/env, the supabase types, not packages/design']);
    expect(game('@omni/design/tokens.css')).toEqual(['1 game may import kit/lib/ids, kit/lib/env, the supabase types, not packages/design']);
    expect(game('@omni/galaxy')).toEqual(['1 game may import kit/lib/ids, kit/lib/env, the supabase types, not packages/galaxy']);
    const arcade = (specifier: string): string[] => found('apps/galaxy/src/a.ts', `import '${specifier}';\n`);
    expect(arcade('@omni/design')).toEqual([]);
    expect(arcade('@omni/design/tokens.css')).toEqual([]);
    expect(arcade('@omni/galaxy')).toEqual([]);
  });

  it('reads a package subpath through its exports map', () => {
    const known = new Set(['packages/design/src/index.ts', 'packages/design/tokens.css', 'packages/design/fonts/inter.woff2']);
    expect(resolve('apps/galaxy/src/a.ts', '@omni/design', known)?.path).toBe('packages/design/src/index.ts');
    expect(resolve('apps/galaxy/src/a.ts', '@omni/design/tokens.css', known)?.path).toBe('packages/design/tokens.css');
    expect(resolve('apps/galaxy/src/a.ts', '@omni/design/fonts/inter.woff2', known)?.path).toBe('packages/design/fonts/inter.woff2');
    expect(resolve('apps/galaxy/src/a.ts', 'vertuo-omni-plan/kit/lib/ids.ts', known)?.path).toBe('kit/lib/ids.ts');
    expect(resolve('apps/galaxy/src/a/b.ts', '../c', new Set(['apps/galaxy/src/c.tsx']))?.path).toBe('apps/galaxy/src/c.tsx');
    expect(resolve('apps/galaxy/src/a.ts', 'zod', known)).toBeUndefined();
    expect(resolve('apps/galaxy/src/a.ts', 'node:fs', known)).toBeUndefined();
  });
});

describe('the import guard, on fixtures: the arcade on the client and on the server', () => {
  const marked = "import 'server-only';\nexport const secret = () => 1;\n";

  it('refuses a client component that reaches a server-only module two imports away, printing the chain', () => {
    const files = [
      { path: 'apps/galaxy/src/a/Card.tsx', text: "'use client';\nimport { label } from './label';\nexport const Card = () => <p>{label}</p>;\n" },
      { path: 'apps/galaxy/src/a/label.ts', text: "import { secret } from '../b/secret.ts';\nexport const label = String(secret());\n" },
      { path: 'apps/galaxy/src/b/secret.ts', text: marked },
    ];
    expect(findViolations(files)).toEqual([
      {
        path: 'apps/galaxy/src/a/Card.tsx',
        line: 2,
        rule: 'a client module reaches a server-only module: apps/galaxy/src/a/Card.tsx → apps/galaxy/src/a/label.ts → apps/galaxy/src/b/secret.ts',
        text: "import { label } from './label';",
      },
    ]);
  });

  it('follows the kit and the packages too, by any spelling', () => {
    const files = [
      { path: 'apps/galaxy/src/a/Card.tsx', text: "'use client';\nimport { Button } from '@omni/design';\nexport const Card = () => <Button />;\n" },
      { path: 'packages/design/src/index.ts', text: "export { Button } from './button.tsx';\n" },
      { path: 'packages/design/src/button.tsx', text: marked },
    ];
    expect(foundIn(files)).toEqual([
      'apps/galaxy/src/a/Card.tsx:2 a client module reaches a server-only module: apps/galaxy/src/a/Card.tsx → packages/design/src/index.ts → packages/design/src/button.tsx',
    ]);
  });

  it('does not follow a type-only import, nor into a server action', () => {
    const files = [
      { path: 'apps/galaxy/src/a/Card.tsx', text: "'use client';\nimport type { Secret } from '../b/secret';\nimport { refresh } from './actions';\nexport const Card = () => <p />;\n" },
      { path: 'apps/galaxy/src/a/actions.ts', text: "'use server';\nimport { secret } from '../b/secret';\nexport async function refresh() { return secret(); }\n" },
      { path: 'apps/galaxy/src/b/secret.ts', text: marked },
    ];
    expect(foundIn(files)).toEqual([]);
  });

  it('counts an import whose names are all inline types as a runtime import: the syntax keeps it', () => {
    const files = [
      { path: 'apps/galaxy/src/a/Card.tsx', text: "'use client';\nimport { type Secret } from '../b/secret';\nexport const Card = () => <p />;\n" },
      { path: 'apps/galaxy/src/b/secret.ts', text: marked },
    ];
    expect(foundIn(files)).toEqual([
      'apps/galaxy/src/a/Card.tsx:2 a client module reaches a server-only module: apps/galaxy/src/a/Card.tsx → apps/galaxy/src/b/secret.ts',
    ]);
  });

  it('refuses an arcade source file that imports a Node built-in or the server environment module without the marker', () => {
    expect(found('apps/galaxy/src/a.ts', "import { readFileSync } from 'node:fs';\nexport const read = readFileSync;\n")).toEqual([
      '1 an arcade source file importing node:fs carries server-only',
    ]);
    expect(found('apps/galaxy/src/x/a.ts', "import { serverEnv } from '../env';\nexport const env = serverEnv;\n")).toEqual([
      '1 an arcade source file importing apps/galaxy/src/env.ts carries server-only',
    ]);
    expect(found('apps/galaxy/app/page.tsx', "const { readFile } = await import('node:fs/promises');\n")).toEqual([
      '1 an arcade source file importing node:fs/promises carries server-only',
    ]);
  });

  it('passes the marked file, a type-only import of the environment, the browser environment and a test', () => {
    expect(found('apps/galaxy/src/a.ts', "import 'server-only';\nimport { readFileSync } from 'node:fs';\nimport { serverEnv } from './env.ts';\n")).toEqual([]);
    expect(found('apps/galaxy/src/a.ts', "import type { OpenRouterEnv } from './env';\n")).toEqual([]);
    expect(found('apps/galaxy/src/a.ts', "import { publicEnv } from './env.client';\n")).toEqual([]);
    expect(found('apps/galaxy/src/a.test.ts', "import { readFileSync } from 'node:fs';\n")).toEqual([]);
  });

  it('exempts the arcade files that run at build time under plain Node, each by its rule', () => {
    for (const path of ['apps/galaxy/scripts/seed.ts', 'apps/galaxy/next.config.ts', 'apps/galaxy/artifact/build.ts', 'apps/galaxy/src/docs/diagrams.ts']) {
      expect(found(path, "import { readFileSync } from 'node:fs';\n")).toEqual([]);
    }
    expect(found('apps/galaxy/src/docs/other.ts', "import { readFileSync } from 'node:fs';\n")).toEqual(['1 an arcade source file importing node:fs carries server-only']);
  });
});

describe('the import guard, on fixtures: the cycle gate', () => {
  const dir = mkdtempSync(join(tmpdir(), 'import-guard-'));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads a cycle fallow finds', () => {
    writeFileSync(join(dir, 'package.json'), '{ "name": "cycle", "private": true, "type": "module", "main": "a.ts" }\n');
    writeFileSync(join(dir, 'a.ts'), "import { b } from './b.ts';\nexport const a = () => b;\n");
    writeFileSync(join(dir, 'b.ts'), "import { a } from './a.ts';\nexport const b = () => a;\n");
    expect(cycles(dir)).toEqual([['a.ts', 'b.ts']]);
  });
});

describe('the import guard, on the whole repository', () => {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean);

  it('finds no import the rule table, the client rule or the server marker refuses, in any file git tracks', () => {
    const files = tracked.filter(isChecked).map((path) => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));
    expect(files.length).toBeGreaterThan(1000);
    expect(findViolations(files, new Set(tracked)).map((v) => `${v.path}:${v.line}: ${v.rule}`)).toEqual([]);
  });

  it('finds the client modules it follows', () => {
    const files = tracked.filter(isChecked).map((path) => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));
    expect(files.filter((file) => isArcadeSource(file.path) && importsOf(file).directives.has('use client')).length).toBeGreaterThan(50);
  });

  it('names exempt build-time files that exist', () => {
    const exempt = BUILD_TIME.flatMap((rule) => rule.examples);
    expect(exempt.filter((path) => !tracked.includes(path))).toEqual([]);
  });

  it('finds no import cycle', () => {
    expect(cycles(repoRoot)).toEqual([]);
  });
});

type File = { path: string; text: string };
type Violation = { path: string; line: number; rule: string; text: string };

/** One import a file makes: what it names, on which line, and whether only types cross. */
type Import = { specifier: string; line: number; typeOnly: boolean };

/** A file's imports, its directive prologue, and whether it carries `import 'server-only'`. */
type Parsed = { imports: readonly Import[]; directives: ReadonlySet<string>; serverOnly: boolean };

// ---------------------------------------------------------------------------------------------
// Zones and the rule table (spec §1–§2).

/** The zones, from where a file sits: the first that matches names it. */
const ZONES = [
  { zone: "the kit's build scripts", pattern: /^kit\/(?:build\.ts$|release\/)/ },
  { zone: 'kit/lib', pattern: /^kit\/lib\// },
  { zone: 'kit/bin', pattern: /^kit\/bin\// },
  { zone: 'kit/test', pattern: /^kit\/test\// },
  { zone: 'game', pattern: /^game\// },
  { zone: 'scripts', pattern: /^scripts\// },
  { zone: 'apps/galaxy', pattern: /^apps\/galaxy\// },
  { zone: 'apps/omni-app', pattern: /^apps\/omni-app\// },
  { zone: 'packages/design', pattern: /^packages\/design\// },
  { zone: 'packages/galaxy', pattern: /^packages\/galaxy\// },
  { zone: 'the supabase types', pattern: /^supabase\/database\.types(?:\.ts)?$/ },
  { zone: 'the root manifest', pattern: /^package\.json$/ },
  // The repository's own configuration, its test runner's and its linter's, and Claude Code's hooks.
  { zone: 'the repository config', pattern: /^(?:eslint\.config\.ts|vitest\.config\.ts|\.claude\/)/ },
] as const;

type Zone = (typeof ZONES)[number]['zone'];

/** A zone a row may reach: all of it, or only the paths `only` matches; `byName` asks for the package name as the spelling. */
type Reach = { zone: Zone; only?: { pattern: RegExp; label: string }; byName?: true };

/** What a zone may import beyond itself, Node built-ins and npm packages: `anything`, or the zones listed. */
type Row = { may: 'anything' | readonly Reach[] };

const kitLib: Reach = { zone: 'kit/lib' };

/** The rule table, as the spec states it, and the rows it leaves implicit (the last four). */
const TABLE: Record<Zone, Row> = {
  'kit/lib': { may: [] },
  'kit/bin': { may: [kitLib] },
  "the kit's build scripts": { may: [kitLib, { zone: 'kit/bin' }] },
  game: {
    may: [
      { zone: 'kit/lib', only: { pattern: /^kit\/lib\/(?:ids\.ts$|ids\/|env\.ts$|env\/)/, label: 'kit/lib/ids, kit/lib/env' } },
      // The game's ledger lives in Supabase: its REST adapter types its rows from the generated types
      // (item s3-01 of PRD 1066, beyond the spec's table).
      { zone: 'the supabase types' },
    ],
  },
  'packages/galaxy': { may: [{ zone: 'game' }, { zone: 'packages/design' }, { zone: 'kit/lib', only: { pattern: /^kit\/lib\/(?:ids\.ts$|ids\/)/, label: 'kit/lib/ids' } }] },
  'packages/design': { may: [{ zone: 'kit/lib', byName: true }] },
  'apps/omni-app': { may: [kitLib, { zone: 'packages/design' }, { zone: 'the supabase types' }] },
  'apps/galaxy': { may: [kitLib, { zone: 'packages/design' }, { zone: 'packages/galaxy' }, { zone: 'game' }, { zone: 'the supabase types' }, { zone: 'the root manifest' }] },
  scripts: { may: 'anything' },
  // The kit's test fixtures are the kit's tests: they drive the kit, its library and its command line.
  'kit/test': { may: [kitLib, { zone: 'kit/bin' }] },
  // Generated by `supabase gen types`: it imports nothing.
  'the supabase types': { may: [] },
  // Not source: a manifest imports nothing.
  'the root manifest': { may: [] },
  // The repository's own configuration and hooks are repository tools, like the scripts.
  'the repository config': { may: 'anything' },
};

/** What a test may import beyond its zone's row: the kit's fixtures, and its command line to drive. */
const TEST_ALSO: readonly Reach[] = [{ zone: 'kit/test' }, { zone: 'kit/bin' }];

// ---------------------------------------------------------------------------------------------
// The arcade's client and server (spec §3).

/** The arcade's server environment module. */
const SERVER_ENV = 'apps/galaxy/src/env.ts';

/**
 * Arcade files that run at build time under plain Node, where `import 'server-only'` throws: they
 * import Node built-ins and carry no marker. Settled as item s1-01 of PRD 1066.
 */
const BUILD_TIME = [
  { pattern: /^apps\/galaxy\/scripts\//, examples: ['apps/galaxy/scripts/seed.ts'], reason: 'command-line scripts, run by node from a package script, never bundled by Next' },
  { pattern: /^apps\/galaxy\/next\.config\.ts$/, examples: ['apps/galaxy/next.config.ts'], reason: "Next's own configuration, read under plain Node before any bundle exists" },
  { pattern: /^apps\/galaxy\/artifact\/build\.ts$/, examples: ['apps/galaxy/artifact/build.ts'], reason: "the artifact's bundling script, run by node from the `artifact` script" },
  {
    pattern: /^apps\/galaxy\/src\/docs\/diagrams\.ts$/,
    examples: ['apps/galaxy/src/docs/diagrams.ts'],
    reason: '`source.config.ts` loads it while fumadocs-mdx compiles the guide under plain Node',
  },
] as const;

/** Files no person writes. */
const GENERATED = [/^supabase\/database\.types\.ts$/];

/** A test, or a file in a `test/` folder that serves tests only. */
const TEST = [/\.(?:test|spec)\.[cm]?tsx?$/, /(?:^|\/)test\//];

const TYPESCRIPT = /\.(?:[cm]?ts|tsx)$/;

/** Whether the guard reads a file's imports: TypeScript, not generated. Tests are read too: the table holds for them. */
function isChecked(path: string): boolean {
  return TYPESCRIPT.test(path) && !GENERATED.some((p) => p.test(path));
}

function isTest(path: string): boolean {
  return TEST.some((p) => p.test(path));
}

/** An arcade file that is neither a test nor run at build time. */
function isArcadeSource(path: string): boolean {
  return path.startsWith('apps/galaxy/') && !isTest(path) && !BUILD_TIME.some((rule) => rule.pattern.test(path));
}

function zoneOf(path: string): Zone | undefined {
  return ZONES.find((z) => z.pattern.test(path))?.zone;
}

// ---------------------------------------------------------------------------------------------
// Resolving a specifier to a path in the repository.

/** A workspace package: its folder (`''` for the root), its name, its exports and what it declares. */
type Manifest = { dir: string; name: string; exports: Record<string, string>; declares: ReadonlySet<string> };

/** The workspace packages, read once from their package.json files. */
const MANIFESTS: readonly Manifest[] = ['', 'apps/galaxy', 'apps/omni-app', 'packages/design', 'packages/galaxy'].map((dir) => {
  const json: unknown = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));
  return manifestOf(dir, json);
});

function manifestOf(dir: string, json: unknown): Manifest {
  const record = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? Object.fromEntries(Object.entries(value)) : {});
  const m = record(json);
  const exports: Record<string, string> = {};
  for (const [key, value] of Object.entries(record(m.exports))) {
    const target = typeof value === 'string' ? value : record(value).default;
    if (typeof target === 'string') exports[key] = target;
  }
  const declares = new Set([...Object.keys(record(m.dependencies)), ...Object.keys(record(m.devDependencies)), ...Object.keys(record(m.peerDependencies))]);
  return { dir, name: typeof m.name === 'string' ? m.name : dir, exports, declares };
}

/** The package a file belongs to: the deepest workspace folder holding it. */
function packageOf(path: string): Manifest | undefined {
  return MANIFESTS.filter((m) => m.dir === '' || path.startsWith(`${m.dir}/`)).sort((a, b) => b.dir.length - a.dir.length)[0];
}

/** Where a specifier lands in the repository, and how it was spelt; `undefined` for a built-in or an npm package. */
type Resolved = { path: string; byName?: Manifest };

function resolve(from: string, specifier: string, known: ReadonlySet<string>): Resolved | undefined {
  if (specifier.startsWith('./') || specifier.startsWith('../')) return { path: complete(posix.normalize(posix.join(posix.dirname(from), specifier)), known) };
  const manifest = MANIFESTS.find((m) => specifier === m.name || specifier.startsWith(`${m.name}/`));
  if (manifest === undefined) return undefined;
  const sub = specifier.slice(manifest.name.length);
  return { path: complete(posix.join(manifest.dir, exported(manifest, `.${sub}`)), known), byName: manifest };
}

/** A package subpath through its exports, `*` patterns included; a package with no exports map is read by path. */
function exported(manifest: Manifest, subpath: string): string {
  const exact = manifest.exports[subpath];
  if (exact !== undefined) return exact;
  for (const [key, target] of Object.entries(manifest.exports)) {
    const star = key.indexOf('*');
    if (star >= 0 && subpath.startsWith(key.slice(0, star)) && subpath.endsWith(key.slice(star + 1))) {
      return target.replace('*', subpath.slice(star, subpath.length - (key.length - star - 1)));
    }
  }
  return subpath;
}

/** The file a path names, extension or index added as the bundler and node would; the path itself when none is known. */
function complete(path: string, known: ReadonlySet<string>): string {
  const candidates = [path, `${path}.ts`, `${path}.tsx`, `${path}/index.ts`, `${path}/index.tsx`, path.replace(/\.js$/, '.ts'), path.replace(/\.jsx$/, '.tsx')];
  return candidates.find((candidate) => known.has(candidate)) ?? path;
}

// ---------------------------------------------------------------------------------------------
// Reading a file's imports from its syntax tree.

/** One node's module specifier, and whether only types cross. */
type ImportRead = { literal: ts.Node; typeOnly: boolean } | undefined;

/** Each way a node names a module, one check per kind of node. */
const IMPORT_READS: readonly ((node: ts.Node) => ImportRead)[] = [
  // `import … from 'x'`, `import type … from 'x'`, `import 'x'`
  (node) => (ts.isImportDeclaration(node) ? { literal: node.moduleSpecifier, typeOnly: node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword } : undefined),
  // `export … from 'x'`, `export type … from 'x'`
  (node) => (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined ? { literal: node.moduleSpecifier, typeOnly: node.isTypeOnly } : undefined),
  // `import x = require('x')`
  (node) => (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) ? { literal: node.moduleReference.expression, typeOnly: node.isTypeOnly } : undefined),
  // `import('x')`
  (node) => (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] !== undefined ? { literal: node.arguments[0], typeOnly: false } : undefined),
  // `typeof import('x')`
  (node) => (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) ? { literal: node.argument.literal, typeOnly: true } : undefined),
];

function importsOf(file: File): Parsed {
  const kind = file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
  const imports: Import[] = [];
  const add = (literal: ts.Node, typeOnly: boolean): void => {
    if (!ts.isStringLiteralLike(literal)) return;
    imports.push({ specifier: literal.text, line: source.getLineAndCharacterOfPosition(literal.getStart(source)).line + 1, typeOnly });
  };
  const visit = (node: ts.Node): void => {
    const read = IMPORT_READS.map((reads) => reads(node)).find((found) => found !== undefined);
    if (read !== undefined) add(read.literal, read.typeOnly);
    ts.forEachChild(node, visit);
  };
  visit(source);
  const directives = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    directives.add(statement.expression.text);
  }
  const serverOnly = source.statements.some((s) => ts.isImportDeclaration(s) && s.importClause === undefined && ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text === 'server-only');
  return { imports, directives, serverOnly };
}

// ---------------------------------------------------------------------------------------------
// The checks.

function findViolations(files: readonly File[], known: ReadonlySet<string> = new Set(files.map((f) => f.path))): Violation[] {
  const parsed = new Map(files.filter((file) => isChecked(file.path)).map((file) => [file.path, { file, parsed: importsOf(file) }]));
  const out: Violation[] = [];
  for (const { file, parsed: p } of parsed.values()) {
    const lines = file.text.split('\n');
    const flag = (line: number, rule: string): void => {
      out.push({ path: file.path, line, rule, text: lines[line - 1] ?? '' });
    };
    for (const finding of tableFindings(file.path, p, known)) flag(finding.line, finding.rule);
    for (const finding of markerFindings(file.path, p, known)) flag(finding.line, finding.rule);
    if (isArcadeSource(file.path) && p.directives.has('use client')) {
      for (const finding of clientFindings(file.path, parsed, known)) flag(finding.line, finding.rule);
    }
  }
  return out;
}

type Finding = { line: number; rule: string };

/** The rule table, the test allowance and the declared dependency, for each import of one file. */
function tableFindings(path: string, parsed: Parsed, known: ReadonlySet<string>): Finding[] {
  const zone = zoneOf(path);
  if (zone === undefined) return [];
  return parsed.imports.flatMap((imp) => {
    const target = resolve(path, imp.specifier, known);
    if (target === undefined) return [];
    return [declaredRule(path, target), zoneRule(path, zone, target)].flatMap((rule) => (rule === undefined ? [] : [{ line: imp.line, rule }]));
  });
}

/** An import by package name names a package the importing package declares. */
function declaredRule(path: string, target: Resolved): string | undefined {
  const owner = packageOf(path);
  if (target.byName === undefined || owner === undefined || owner === target.byName || owner.declares.has(target.byName.name)) return undefined;
  return `${owner.dir || 'the root package'} does not declare ${target.byName.name}`;
}

/** The zone's row of the table, and a test's allowance, decide whether `path` may import `target`. */
function zoneRule(path: string, zone: Zone, target: Resolved): string | undefined {
  const row = TABLE[zone];
  const targetZone = zoneOf(target.path);
  if (row.may === 'anything' || targetZone === zone) return undefined;
  const reaches = isTest(path) ? [...row.may, ...TEST_ALSO] : row.may;
  const covering = reaches.filter((r) => r.zone === targetZone && (r.only === undefined || r.only.pattern.test(target.path)));
  if (covering.some((r) => r.byName === undefined || target.byName !== undefined)) return undefined;
  const spelling = covering.length > 0 ? ' by a relative path' : '';
  return `${zone} may import ${mayLabel(row.may, isTest(path))}, not ${targetZone ?? target.path}${spelling}`;
}

function mayLabel(may: readonly Reach[], test: boolean): string {
  const label = may.length === 0 ? 'nothing beyond its zone' : may.map((r) => (r.only?.label ?? r.zone) + (r.byName ? ' (by package name)' : '')).join(', ');
  return test ? `${label} (a test also ${TEST_ALSO.map((r) => r.zone).join(', ')})` : label;
}

/** An arcade source file importing a Node built-in or the server environment module carries `server-only`; a type-only import does not count. */
function markerFindings(path: string, parsed: Parsed, known: ReadonlySet<string>): Finding[] {
  if (!isArcadeSource(path) || parsed.serverOnly) return [];
  return parsed.imports.flatMap((imp) => {
    if (imp.typeOnly) return [];
    const resolved = resolve(path, imp.specifier, known)?.path;
    const isServerEnv = resolved !== undefined && complete(resolved, new Set([SERVER_ENV])) === SERVER_ENV;
    const serverModule = imp.specifier.startsWith('node:') && isBuiltin(imp.specifier) ? imp.specifier : isServerEnv ? SERVER_ENV : undefined;
    return serverModule === undefined ? [] : [{ line: imp.line, rule: `an arcade source file importing ${serverModule} carries server-only` }];
  });
}

/**
 * From one `'use client'` file, every runtime import transitively, breadth first: each `server-only`
 * module reached is one finding on the first import of the chain, which the rule prints. A type-only
 * import is erased; a `'use server'` module is a server action, which the client calls by reference.
 */
function clientFindings(root: string, parsed: ReadonlyMap<string, { parsed: Parsed }>, known: ReadonlySet<string>): Finding[] {
  const out: Finding[] = [];
  const cameFrom = new Map<string, { from: string; line: number }>([[root, { from: '', line: 0 }]]);
  const queue = [root];
  for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
    for (const step of clientSteps(at, parsed, known)) {
      if (cameFrom.has(step.next)) continue;
      cameFrom.set(step.next, { from: at, line: step.line });
      if (step.serverOnly) out.push(chainFinding(step.next, cameFrom));
      else queue.push(step.next);
    }
  }
  return out;
}

/** The modules one file brings to the client: its runtime imports of repository files, server actions left out. */
function clientSteps(at: string, parsed: ReadonlyMap<string, { parsed: Parsed }>, known: ReadonlySet<string>): { next: string; line: number; serverOnly: boolean }[] {
  return (parsed.get(at)?.parsed.imports ?? []).flatMap((imp) => {
    const next = imp.typeOnly ? undefined : resolve(at, imp.specifier, known)?.path;
    const target = next === undefined ? undefined : parsed.get(next)?.parsed;
    if (next === undefined || target === undefined || target.directives.has('use server')) return [];
    return [{ next, line: imp.line, serverOnly: target.serverOnly }];
  });
}

function chainFinding(end: string, cameFrom: ReadonlyMap<string, { from: string; line: number }>): Finding {
  const chain = [end];
  let line = 0;
  for (let step = cameFrom.get(end); step !== undefined && step.from !== ''; step = cameFrom.get(step.from)) {
    chain.unshift(step.from);
    line = step.line;
  }
  return { line, rule: `a client module reaches a server-only module: ${chain.join(' → ')}` };
}

// ---------------------------------------------------------------------------------------------
// The cycle gate (spec §4): fallow's own circular-dependency check, on the whole tree.

/** Each import cycle fallow finds under `root`, as the files in it, relative to `root`. */
function cycles(root: string): string[][] {
  const fallow = join(repoRoot, 'node_modules', '.bin', 'fallow');
  let stdout: string;
  try {
    stdout = execFileSync(fallow, ['dead-code', '--circular-deps', '--format', 'json', '--quiet', '--root', root], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    // fallow exits non-zero when it finds one; its report is still on stdout.
    stdout = error instanceof Error && 'stdout' in error && typeof error.stdout === 'string' ? error.stdout : '';
  }
  const report = FallowReport.parse(JSON.parse(stdout));
  return [...report.circular_dependencies, ...report.re_export_cycles].map((cycle) => [...cycle.files].sort());
}

/** The part of fallow's JSON report the gate reads: each cycle, import or re-export, as its files. */
const Cycle = z.object({ files: z.array(z.string()) });
const FallowReport = z.object({ circular_dependencies: z.array(Cycle), re_export_cycles: z.array(Cycle) });

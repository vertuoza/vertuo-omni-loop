// PRD 1646 s1: which changed paths can change what each Vercel project deploys. The rules are proven
// on fixtures first, then galaxy's never list against the code: every file galaxy's source reaches,
// through relative imports and the workspace packages, must stay an input.
import { spawnSync } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { affects, GALAXY_NEVER, matches, packageJsonChangesBeyondVersion } from './vercel-inputs.ts';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const script = join(repoRoot, 'scripts', 'vercel-inputs.ts');
const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() ?? '', { recursive: true, force: true });
});

const VERSION_ONLY = '--- a/package.json\n+++ b/package.json\n@@ -1,3 +1,3 @@\n   "name": "x",\n-  "version": "0.0.337",\n+  "version": "0.0.338",\n';
const DEPS_TOO = `${VERSION_ONLY}-    "zod": "^4.0.0"\n+    "zod": "^4.1.0"\n`;

describe('the rules, on fixtures', () => {
  it('matches folders, exact files and suffixes, nothing looser', () => {
    expect(matches('scripts/', 'scripts/a.ts')).toBe(true);
    expect(matches('scripts/', 'kit/scripts/a.ts')).toBe(false);
    expect(matches('README.md', 'README.md')).toBe(true);
    expect(matches('README.md', 'apps/galaxy/README.md')).toBe(false);
    expect(matches('*.test.ts', 'kit/lib/a.test.ts')).toBe(true);
    expect(matches('*.test.ts', 'kit/lib/a.ts')).toBe(false);
  });

  it('galaxy skips only when every path is on its never list', () => {
    expect(affects('galaxy', ['.omni-loop/delivery/inbox/1/spec.md', 'apps/omni-app/src/a.ts', 'kit/lib/a.test.ts']).affects).toBe(false);
    expect(affects('galaxy', ['.omni-loop/delivery/inbox/1/spec.md', 'kit/lib/a.ts'])).toEqual({ affects: true, path: 'kit/lib/a.ts' });
    expect(affects('galaxy', ['package.json']).affects).toBe(true);
    expect(affects('galaxy', ['package.json', 'kit/dist/omni.mjs', 'kit/plugin/.claude-plugin/plugin.json'], { packageJsonDiff: VERSION_ONLY }).affects).toBe(false);
    expect(affects('galaxy', ['package.json'], { packageJsonDiff: DEPS_TOO }).affects).toBe(true);
    expect(affects('galaxy', ['.omni-loop/config.yml']).affects).toBe(true);
    expect(affects('galaxy', ['.omni-loop/knowledge/product/a.md']).affects).toBe(true);
    expect(affects('galaxy', ['docs/guide/a.md']).affects).toBe(true);
    expect(affects('galaxy', ['a/new/folder/x.ts']).affects).toBe(true);
  });

  it('omni-app builds only for its own files, the lockfile, and a package.json beyond the version', () => {
    expect(affects('omni-app', ['apps/omni-app/api/github.mjs']).affects).toBe(true);
    expect(affects('omni-app', ['pnpm-lock.yaml']).affects).toBe(true);
    expect(affects('omni-app', ['apps/galaxy/src/a.ts', 'kit/lib/a.ts']).affects).toBe(false);
    expect(affects('omni-app', ['package.json'], { packageJsonDiff: VERSION_ONLY }).affects).toBe(false);
    expect(affects('omni-app', ['package.json'], { packageJsonDiff: DEPS_TOO }).affects).toBe(true);
    expect(affects('omni-app', ['package.json']).affects).toBe(true);
  });

  it('on a branch, .omni-loop/ never counts, for both projects', () => {
    for (const project of ['galaxy', 'omni-app']) {
      expect(affects(project, ['.omni-loop/config.yml', '.omni-loop/knowledge/product/a.md'], { branch: true }).affects).toBe(false);
    }
    expect(affects('galaxy', ['.omni-loop/config.yml']).affects).toBe(true);
    expect(affects('galaxy', ['.omni-loop/config.yml', 'apps/galaxy/a.ts'], { branch: true }).path).toBe('apps/galaxy/a.ts');
  });

  it('answers yes when unsure: no paths, or an unknown project', () => {
    expect(affects('galaxy', []).affects).toBe(true);
    expect(affects('galaxy', ['', '  ']).affects).toBe(true);
    expect(affects('nope', ['README.md']).affects).toBe(true);
  });

  it('reads a package.json diff line by line', () => {
    expect(packageJsonChangesBeyondVersion(VERSION_ONLY)).toBe(false);
    expect(packageJsonChangesBeyondVersion(DEPS_TOO)).toBe(true);
    expect(packageJsonChangesBeyondVersion('')).toBe(false);
  });
});

describe('the command line', () => {
  const run = (args: string[], stdin: string) => spawnSync(process.execPath, [script, ...args], { input: stdin, encoding: 'utf8' });

  it('prints its answer and exits 0 for yes, 1 for no, 2 for a usage error', () => {
    const yes = run(['galaxy', 'main'], 'kit/lib/a.ts\n');
    expect(yes.status).toBe(0);
    expect(yes.stdout.trim()).toBe('vercel-inputs: galaxy yes: kit/lib/a.ts');
    const no = run(['omni-app', 'branch'], 'apps/galaxy/a.ts\n.omni-loop/config.yml\n');
    expect(no.status).toBe(1);
    expect(no.stdout.trim()).toBe('vercel-inputs: omni-app no: none');
    expect(run(['other', 'main'], '').status).toBe(2);
    expect(run(['galaxy'], '').status).toBe(2);
  });

  it('reads the package.json diff from a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vercel-inputs-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'diff'), VERSION_ONLY);
    expect(run(['omni-app', 'main', '--package-json-diff', join(dir, 'diff')], 'package.json\n').status).toBe(1);
    writeFileSync(join(dir, 'diff'), DEPS_TOO);
    expect(run(['omni-app', 'main', '--package-json-diff', join(dir, 'diff')], 'package.json\n').status).toBe(0);
  });
});

// Every file galaxy's source reaches: relative imports, `<the root package>/<path>` (its name read from package.json)
// and `@omni/<package>[/<path>]` (packages/<package>), followed transitively from every non-test
// source file under apps/galaxy.
/** The root package's name: a specifier under it reads a file from the repository root. */
const ROOT_PACKAGE = String((JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { name: unknown }).name);
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
const EXTENSIONS = ['', '.ts', '.tsx', '.mts', '.mjs', '/index.ts', '/index.tsx'];

function existingFile(base: string): string | null {
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('.')) return existingFile(join(dirname(fromFile), specifier));
  if (specifier.startsWith(`${ROOT_PACKAGE}/`)) return existingFile(join(repoRoot, specifier.slice(ROOT_PACKAGE.length + 1)));
  const pkg = /^@omni\/([^/]+)(?:\/(.*))?$/.exec(specifier);
  if (pkg?.[1]) return existingFile(join(repoRoot, 'packages', pkg[1], pkg[2] ?? 'src/index.ts'));
  return null;
}

/** The workspace files `file` imports, resolved. */
function importsOf(file: string): string[] {
  if (!/\.(ts|tsx|mts|mjs)$/.test(file)) return [];
  return [...readFileSync(file, 'utf8').matchAll(SPECIFIER)].flatMap((match) => {
    const target = match[1] ? resolveSpecifier(file, match[1]) : null;
    return target ? [target] : [];
  });
}

function galaxySources(): string[] {
  return execFileSync('git', ['ls-files', 'apps/galaxy'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter((p) => /\.(ts|tsx|mts)$/.test(p) && !/\.test\.tsx?$/.test(p))
    .map((p) => join(repoRoot, p));
}

function reachedFromGalaxy(): Set<string> {
  const seen = new Set<string>();
  const queue = galaxySources();
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    const rel = relative(repoRoot, file);
    if (seen.has(rel) || rel.startsWith('..') || rel.includes('node_modules')) continue;
    seen.add(rel);
    queue.push(...importsOf(file));
  }
  return seen;
}

describe('galaxy\'s never list, against the code', () => {
  it('names no file galaxy\'s source reaches', () => {
    const reached = reachedFromGalaxy();
    expect(reached.size).toBeGreaterThan(100);
    expect([...reached].filter((p) => !/\.test\.tsx?$/.test(p) && !affects('galaxy', [p]).affects)).toEqual([]);
  });

  it('keeps the files galaxy reads at build and run time without importing them', () => {
    const nextConfig = readFileSync(join(repoRoot, 'apps/galaxy/next.config.ts'), 'utf8');
    const traced = [...nextConfig.matchAll(/'\.\.\/\.\.\/([^'*]+)/g)].flatMap((m) => (m[1] ? [m[1]] : []));
    expect(traced.length).toBeGreaterThan(0);
    for (const prefix of traced) expect(GALAXY_NEVER.some((rule) => matches(rule, `${prefix}x.md`) || matches(rule, prefix))).toBe(false);
    expect(readFileSync(join(repoRoot, 'apps/galaxy/source.config.ts'), 'utf8')).toContain("'../../docs/guide'");
    expect(affects('galaxy', ['docs/guide/index.md']).affects).toBe(true);
    expect(affects('galaxy', ['kit/plugin/skills/plan/SKILL.md']).affects).toBe(true);
    expect(affects('galaxy', ['supabase/database.types.ts']).affects).toBe(true);
  });
});

// The suite's time limits (#570). Tests that build git repositories and run child processes slow down
// with the machine's load, so a limit sized for a quiet machine fails a correct test on a busy one.
// The limit is one generous value in vitest.config.ts, meant to catch a hang; a test that sets its own
// brings the flake back one file at a time, which is how #570 grew. This file holds both.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config, { TEST_TIMEOUT_MS } from '../vitest.config.ts';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const SELF = 'scripts/test-timeouts.test.ts';

// A test's own limit: a number of 1000 or more after an `it`/`test` body (`}, 20_000);`, while a timer's
// short delay, `}, 50);`, is not one), a `{ timeout: … }` option on a `describe`, `it` or `test`, or
// `vi.setConfig({ testTimeout: … })`. A name after a test body (`}, SPAWNS_MS);`) is one when the file
// sets that name to such a number (`const SPAWNS_MS = 30000;`).
const OWN_LIMIT = [/^\s*\}\s*,\s*\d[\d_]{3,}\s*\)\s*;?\s*$/m, /\b(?:describe|it|test)(?:\.\w+)*\([^\n]*\{\s*timeout\s*:/, /\bvi\.setConfig\(\s*\{[^}]*\b(?:test|hook)Timeout\b/];
const NAMED_LIMIT = /^[ \t]*\}[ \t]*,[ \t]*([A-Za-z_$][\w$]*)\s*\)\s*;?\s*$/gm;

/** The whole line of `source` around `index`, trimmed. */
function lineAt(source: string, index: number) {
  const start = source.lastIndexOf('\n', index) + 1;
  const end = source.indexOf('\n', index);
  return source.slice(start, end === -1 ? undefined : end).trim();
}

/** The first line of `source` that sets a test's own time limit, or `null`. */
export function ownLimit(source: string) {
  for (const pattern of OWN_LIMIT) {
    const match = pattern.exec(source);
    if (match) return lineAt(source, match.index);
  }
  for (const match of source.matchAll(NAMED_LIMIT)) {
    const name = match[1] as string;
    if (new RegExp(`\\b(?:const|let|var)\\s+${name.replace(/\$/g, '\\$')}\\s*=\\s*\\d[\\d_]{3,}\\s*;?\\s*$`, 'm').test(source)) {
      return lineAt(source, match.index);
    }
  }
  return null;
}

function testFiles() {
  return execFileSync('git', ['ls-files', '-z', '--', '*.test.mjs', '*.test.ts'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    // This file's own examples of a limit are strings under test, never a limit it sets.
    .filter((path) => path !== '' && !path.includes('node_modules/') && path !== SELF);
}

describe('the suite\'s time limits', () => {
  it('are one generous value, for a test and for a hook alike', () => {
    expect(TEST_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
    expect(config.test.testTimeout).toBe(TEST_TIMEOUT_MS);
    expect(config.test.hookTimeout).toBe(TEST_TIMEOUT_MS);
  });

  it('are set by no test of its own', () => {
    const offenders = testFiles()
      .map((path) => [path, ownLimit(readFileSync(join(repoRoot, path), 'utf8'))])
      .filter(([, line]) => line !== null)
      .map(([path, line]) => `${path}: ${line}`);
    expect(offenders).toEqual([]);
  });
});

describe('ownLimit', () => {
  it('finds a number after a test body, a timeout option, and a setConfig', () => {
    expect(ownLimit("it('a', () => {\n  run();\n}, 20_000);\n")).toBe('}, 20_000);');
    expect(ownLimit("  it('a', async () => {\n  }, 30000);\n")).toBe('}, 30000);');
    expect(ownLimit("describe('a', { timeout: 20_000 }, () => {\n});\n")).toBe("describe('a', { timeout: 20_000 }, () => {");
    expect(ownLimit("it.concurrent('a', { timeout: 5 }, () => {});\n")).toBe("it.concurrent('a', { timeout: 5 }, () => {});");
    expect(ownLimit('vi.setConfig({ testTimeout: 1000 });\n')).toBe('vi.setConfig({ testTimeout: 1000 });');
  });

  it('finds a named limit after a test body, when the file sets that name to 1000 or more', () => {
    expect(ownLimit("const SPAWNS_MS = 30000;\nit('a', () => {\n  run();\n}, SPAWNS_MS);\n")).toBe('}, SPAWNS_MS);');
    expect(ownLimit("const LIMIT = 20_000;\n  it('a', async () => {\n  }, LIMIT)\n")).toBe('}, LIMIT)');
  });

  it('lets a timer pass with a named short delay, or a name the file never sets to a number', () => {
    expect(ownLimit('const SHORT = 50;\nsetTimeout(() => {\n  done();\n}, SHORT);\n')).toBeNull();
    expect(ownLimit("it('a', () => {\n  run();\n}, options);\n")).toBeNull();
  });

  it('lets a test body, a timer, and a timeout value under test pass', () => {
    expect(ownLimit("it('a', () => {\n  run();\n});\n")).toBeNull();
    expect(ownLimit('setTimeout(() => {\n  done();\n}, 50);\n')).toBeNull();
    expect(ownLimit("expect(calls[0].options.timeout).toBe(5000);\nconst hook = { timeout: 600 };\n")).toBeNull();
  });
});

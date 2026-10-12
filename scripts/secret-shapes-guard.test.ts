// The secret shapes guard (PRD 1717, s1): no tracked file holds a literal credential. This repository
// is public, and GitHub's push protection refuses a push that adds a string shaped like a real
// credential, fake or not. So a fake one (a masking test's token, a fixture's private key) is
// assembled when the code runs ('ghp_' + 'a'.repeat(36), a PEM header joined from its parts), never
// written out whole, and this guard refuses any literal one, naming the file, the line and the shape.
// A shape needs its body: a bare prefix (a doc naming `ghp_`) and a regular expression (as in
// apps/galaxy/src/jev/mask.ts) are not literals. The lockfile and the built bundles are not read: the
// lockfile holds integrity hashes, and the bundles are built from sources this guard reads. The rules
// are proven on planted lines first, each planted line itself assembled at runtime, then the guard
// runs on every file git tracks.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** The shapes, by name. Each needs its body after the prefix; none matches inside a longer word. */
const SHAPES: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'GitHub token', pattern: /(?<![A-Za-z0-9_])gh[pousr]_[A-Za-z0-9_]{16,}/g },
  { name: 'GitHub fine-grained token', pattern: /(?<![A-Za-z0-9_])github_pat_[A-Za-z0-9_]{16,}/g },
  { name: 'Anthropic key', pattern: /(?<![A-Za-z0-9_])sk-ant-[A-Za-z0-9_-]{16,}/g },
  { name: 'AWS access key id', pattern: /(?<![A-Za-z0-9_])AKIA[0-9A-Z]{16}(?![A-Za-z0-9_])/g },
  { name: 'Supabase secret key', pattern: /(?<![A-Za-z0-9_])sb_secret_[A-Za-z0-9_-]{16,}/g },
  { name: 'Slack token', pattern: /(?<![A-Za-z0-9_])xox[abpr]-[A-Za-z0-9-]{10,}/g },
  { name: 'webhook secret', pattern: /(?<![A-Za-z0-9_])whsec_[A-Za-z0-9+/=]{16,}/g },
  // The header, then its body: on the next line, or after an escaped `\n` (or `\\n`) in a string.
  { name: 'PEM private key', pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----(?:\r?\n|(?:\\)+n)[ \t]*[A-Za-z0-9+/=]/g },
];

/** Paths never read: the lockfile and the bundles built from the sources this guard reads. */
const SKIPPED = [/^pnpm-lock\.yaml$/, /^kit\/dist\//, /^apps\/omni-app\/api\//];

interface Literal {
  path: string;
  line: number;
  shape: string;
}

/** Every literal credential shape in `files`, with the line it starts on. */
function findLiterals(files: ReadonlyArray<{ path: string; text: string }>): Literal[] {
  const found: Literal[] = [];
  for (const { path, text } of files) {
    if (SKIPPED.some((skip) => skip.test(path))) continue;
    for (const { name, pattern } of SHAPES) {
      for (const match of text.matchAll(pattern)) {
        const line = text.slice(0, match.index).split('\n').length;
        found.push({ path, line, shape: name });
      }
    }
  }
  return found.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}

const shapesIn = (text: string): string[] => findLiterals([{ path: 'kit/lib/a.ts', text }]).map((l) => l.shape);

// Each planted literal is assembled here, so this file holds none.
const PLANTED: ReadonlyArray<[string, string]> = [
  ['GitHub token', 'gh' + 'p_' + 'a'.repeat(36)],
  ['GitHub token', 'gh' + 'o_' + 'b'.repeat(36)],
  ['GitHub token', 'gh' + 'u_' + 'user_token_never_kept'],
  ['GitHub token', 'gh' + 's_' + 'secret_installation_token'],
  ['GitHub token', 'gh' + 'r_' + 'C'.repeat(36)],
  ['GitHub fine-grained token', 'github' + '_pat_' + '11ABCDEFG0123456789_' + 'x'.repeat(30)],
  ['Anthropic key', 'sk-' + 'ant-' + 'api03-' + 'abcdefghijklmnopqrstuvwxyz'],
  ['AWS access key id', 'AK' + 'IA' + 'IOSFODNN7EXAMPLE'],
  ['Supabase secret key', 'sb_' + 'secret_' + 'd'.repeat(32)],
  ['Slack token', 'xo' + 'xb-' + '1234567890-' + 'e'.repeat(24)],
  ['webhook secret', 'wh' + 'sec_' + 'f'.repeat(32)],
  ['PEM private key', ['-----BEGIN', 'RSA', 'PRIVATE', 'KEY-----'].join(' ') + '\nMIIEabc\n'],
  ['PEM private key', ['-----BEGIN', 'PRIVATE', 'KEY-----'].join(' ') + '\\nabc\\n'],
  ['PEM private key', ['-----BEGIN', 'EC', 'PRIVATE', 'KEY-----'].join(' ') + '\\\\nabc\\\\n'],
];

describe('the secret shapes guard, on planted lines', () => {
  it('catches each shape with its body, naming the file, the line and the shape', () => {
    for (const [shape, literal] of PLANTED) {
      expect(findLiterals([{ path: 'kit/lib/a.test.ts', text: `const ok = 1;\nconst token = '${literal}';\n` }])).toEqual([
        { path: 'kit/lib/a.test.ts', line: 2, shape },
      ]);
    }
  });

  it('lets a bare prefix through: a doc naming the shape is no credential', () => {
    const prefixes = ['gh' + 'p_', 'gh' + 's_…', 'github' + '_pat_', 'sk-' + 'ant-api03-…', 'sb_' + 'secret_', 'xo' + 'xb-', 'wh' + 'sec_'];
    for (const prefix of prefixes) expect(shapesIn(`A token starts with \`${prefix}\`.\n`)).toEqual([]);
    expect(shapesIn(`'sk-` + `ant-api03-abcd…wxyz'\n`)).toEqual([]);
    expect(shapesIn(['-----BEGIN', 'RSA', 'PRIVATE', 'KEY-----'].join(' ') + ' is the header a key starts with.\n')).toEqual([]);
  });

  it('lets a regular expression through, as the mask writes them', () => {
    const mask = readFileSync(join(repoRoot, 'apps/galaxy/src/jev/mask.ts'), 'utf8');
    expect(findLiterals([{ path: 'apps/galaxy/src/jev/mask.ts', text: mask }])).toEqual([]);
    expect(shapesIn('/\\bgh[pousr]_[A-Za-z0-9]{16,}/g\n/\\bAKIA[0-9A-Z]{16}\\b/g\n/\\bsk-ant-[A-Za-z0-9_-]{16,}/g\n')).toEqual([]);
  });

  it('lets a shape assembled with + through', () => {
    expect(shapesIn("const token = 'ghp_' + 'a'.repeat(36);\nconst key = 'AKIA' + 'IOSFODNN7EXAMPLE';\n")).toEqual([]);
    expect(shapesIn("const pem = ['-----BEGIN', 'RSA', 'PRIVATE', 'KEY-----'].join(' ') + '\\nabc';\n")).toEqual([]);
  });

  it('reads no shape inside a longer word', () => {
    expect(shapesIn('x' + 'gh' + 'p_' + 'a'.repeat(36) + '\n')).toEqual([]);
    expect(shapesIn('X' + 'AK' + 'IA' + 'IOSFODNN7EXAMPLE' + '\n')).toEqual([]);
  });

  it('does not read the lockfile or the built bundles', () => {
    const text = `const token = '${'gh' + 'p_' + 'a'.repeat(36)}';\n`;
    for (const path of ['pnpm-lock.yaml', 'kit/dist/omni.mjs', 'apps/omni-app/api/outbox.mjs']) {
      expect(findLiterals([{ path, text }])).toEqual([]);
    }
    expect(findLiterals([{ path: 'kit/lib/omni.mjs', text }])).toHaveLength(1);
  });
});

describe('the secret shapes guard, on every tracked file', () => {
  it('finds no literal credential shape', () => {
    const paths = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' })
      .split('\0')
      .filter((path) => path && !SKIPPED.some((skip) => skip.test(path)));
    const files: Array<{ path: string; text: string }> = [];
    for (const path of paths) {
      let buffer: Buffer;
      try {
        buffer = readFileSync(join(repoRoot, path));
      } catch {
        continue; // a tracked path deleted in the working tree, or a submodule
      }
      if (buffer.includes(0)) continue; // binary
      files.push({ path, text: buffer.toString('utf8') });
    }
    const found = findLiterals(files).map((l) => `${l.path}:${l.line} ${l.shape}`);
    expect(found, 'build each fake credential at runtime (\'ghp_\' + \'a\'.repeat(36)), never write it out whole').toEqual([]);
  });
});

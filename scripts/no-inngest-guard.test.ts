// The removed-service guard (PRD omni-loop-5, s3): the code base names the removed background-job service
// nowhere, so a copied comment or a restored file is refused in a pull request. Any tracked file
// (`git ls-files`) whose text names it, case-insensitively, fails here, naming the file and the line.
// The history folders are left out: the delivery folder (PRDs, plans, outbox items) and the decision
// records, which say what was decided. Binary files are skipped. The rule is proven on a fixture built
// at runtime first, so this file never spells the word itself, then the guard runs on every tracked file.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** The name, assembled from parts so that this file does not contain it. */
const NAME = ['In', 'ngest'].join('');
const NAMED = new RegExp(NAME, 'i');

/** The history folders: where the name stays, as the record of what was done. */
const HISTORY: readonly string[] = ['.omni-loop/delivery/', '.omni-loop/knowledge/adr/'];

type Violation = { path: string; line: number; text: string };
type File = { path: string; text: string };

describe('the removed-service guard, on a fixture', () => {
  it('refuses a file that names the service, naming the file and the line', () => {
    const text = `export const a = 1;\n// runs on ${NAME.toUpperCase()} jobs\n`;
    expect(findViolations([{ path: 'apps/omni-app/src/a.ts', text }])).toEqual([
      { path: 'apps/omni-app/src/a.ts', line: 2, text: `// runs on ${NAME.toUpperCase()} jobs` },
    ]);
  });

  it('refuses the name in any case, in any kind of file', () => {
    expect(findViolations([{ path: 'docs/a.md', text: `${NAME.toLowerCase()}\n` }])).toHaveLength(1);
    expect(findViolations([{ path: 'package.json', text: `"${NAME}": "1"\n` }])).toHaveLength(1);
  });

  it('lets the history folders name it, and a file that does not', () => {
    const text = `${NAME}\n`;
    for (const path of ['.omni-loop/delivery/inbox/omni-loop-4/spec.md', '.omni-loop/knowledge/adr/0001-app.md']) {
      expect(findViolations([{ path, text }])).toEqual([]);
    }
    expect(findViolations([{ path: '.omni-loop/knowledge/adr-notes.md', text }])).toHaveLength(1);
    expect(findViolations([{ path: 'docs/guide/a.md', text: 'no such word here\n' }])).toEqual([]);
  });
});

describe('the removed-service guard, on the whole repository', () => {
  it('finds no tracked file outside the history folders that names the service', () => {
    const paths = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean);
    const files = paths.filter((path) => !isHistory(path)).flatMap((path) => readText(path));
    expect(files.length).toBeGreaterThan(500);
    expect(findViolations(files).map((v) => `${v.path}:${v.line}: ${v.text.trim()}`)).toEqual([]);
  });
});

/** Whether a path sits in a history folder. */
function isHistory(path: string): boolean {
  return HISTORY.some((folder) => path.startsWith(folder));
}

/** A file's text, read once, or nothing when it is binary (a NUL byte in its first 8 KiB). */
function readText(path: string): File[] {
  const buffer = readFileSync(join(repoRoot, path));
  if (buffer.subarray(0, 8192).includes(0)) return [];
  return [{ path, text: buffer.toString('utf8') }];
}

function findViolations(files: readonly File[]): Violation[] {
  return files
    .filter((file) => !isHistory(file.path))
    .flatMap((file) =>
      file.text
        .split('\n')
        .map((text, index) => ({ path: file.path, line: index + 1, text }))
        .filter((row) => NAMED.test(row.text)),
    );
}

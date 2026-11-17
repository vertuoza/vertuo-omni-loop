#!/usr/bin/env node
// node scripts/design-detect.ts [<path>…] — impeccable's detector over the app pages, reported and
// never blocking (PRD omni-loop-11). It runs `impeccable detect` (a dev dependency, Apache-2.0, run
// and never copied in: L-LICENSE-1) over apps/galaxy/src/, the arcade (arcade/, play-dock/) and HOME
// (home/) left out, with no model call and no network (its telemetry is switched off). It prints its
// findings under a `design detector (report only)` heading.
//
// Exit codes: always 0. A detector that cannot start prints one line saying so.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const HEADING = 'design detector (report only)';
const ROOT = 'apps/galaxy/src';
/** The arcade and HOME keep their own surface tokens: the detector never reads them. */
const OUT = ['arcade', 'play-dock', 'home'];
const SHOWN = 40;

export interface Finding {
  antipattern: string;
  file: string;
  line: number;
  snippet?: string;
}

export interface Run {
  status: number | null;
  stdout: string;
  error?: string;
}

export interface Deps {
  /** The entries of apps/galaxy/src/ (names). */
  list: () => string[];
  /** Runs the detector on the targets and returns what it printed. */
  run: (targets: string[]) => Run;
}

/** The targets: the given paths, else every entry of apps/galaxy/src/ but the arcade and HOME. */
export function targetsOf(argv: string[], entries: string[]): string[] {
  if (argv.length > 0) return argv;
  return entries
    .filter((name) => !OUT.includes(name))
    .sort()
    .map((name) => `${ROOT}/${name}`);
}

/** Whether a parsed value is one finding: a rule, a file and a line. */
function isFinding(value: unknown): value is Finding {
  if (typeof value !== 'object' || value === null) return false;
  const fields = new Map<string, unknown>(Object.entries(value));
  return (
    typeof fields.get('antipattern') === 'string' &&
    typeof fields.get('file') === 'string' &&
    typeof fields.get('line') === 'number'
  );
}

/** The findings of `impeccable detect --json`, or null when its output is not a list of them. */
function parseFindings(stdout: string): Finding[] | null {
  try {
    const parsed: unknown = JSON.parse(stdout);
    return Array.isArray(parsed) && parsed.every(isFinding) ? parsed : null;
  } catch {
    return null;
  }
}

/** The report: a heading, the count per rule, then the first findings. */
function report(findings: Finding[], cwd = ''): string[] {
  const lines = [HEADING];
  if (findings.length === 0) return [...lines, 'no finding'];
  const perRule = new Map<string, number>();
  for (const { antipattern } of findings) perRule.set(antipattern, (perRule.get(antipattern) ?? 0) + 1);
  lines.push(`${findings.length} finding${findings.length === 1 ? '' : 's'}`);
  for (const [rule, count] of [...perRule].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    lines.push(`  ${rule}: ${count}`);
  }
  const prefix = cwd ? `${cwd}/` : '';
  for (const f of findings.slice(0, SHOWN)) lines.push(`${f.file.replace(prefix, '')}:${f.line} ${f.antipattern}`);
  if (findings.length > SHOWN) lines.push(`… and ${findings.length - SHOWN} more`);
  return lines;
}

/** Always 0: what it prints is the report, or one line saying the detector could not start. */
export function main(argv: string[], deps: Deps, cwd = ''): { code: 0; lines: string[] } {
  const targets = targetsOf(argv, deps.list());
  const run = deps.run(targets);
  const findings = run.error === undefined ? parseFindings(run.stdout) : null;
  if (findings === null) {
    const why = run.error ?? `unreadable output (exit ${String(run.status)})`;
    return { code: 0, lines: [`${HEADING}: the detector could not start (${why})`] };
  }
  return { code: 0, lines: report(findings, cwd) };
}

function realDeps(): Deps {
  return {
    list: () => readdirSync(ROOT),
    run: (targets) => {
      const bin = join(dirname(createRequire(import.meta.url).resolve('impeccable/package.json')), 'cli', 'bin', 'cli.js');
      const run = spawnSync(process.execPath, [bin, 'detect', '--json', '--no-config', ...targets], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, IMPECCABLE_NO_TELEMETRY: '1', DO_NOT_TRACK: '1' },
      });
      // Exit 2 is "primary findings found": a report, not a failure; 0 is a clean scan.
      if (run.error) return { status: null, stdout: '', error: run.error.message };
      if (run.status !== 0 && run.status !== 2) return { status: run.status, stdout: '', error: `exit ${String(run.status)}` };
      return { status: run.status, stdout: run.stdout };
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    for (const line of main(process.argv.slice(2), realDeps(), process.cwd()).lines) console.log(line);
  } catch (error) {
    console.log(`${HEADING}: the detector could not start (${error instanceof Error ? error.message : String(error)})`);
  }
  process.exit(0);
}

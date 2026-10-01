// What `omni init` reads from a repository's own files: the commands it runs (package.json,
// composer.json or a Makefile — the first that exists wins) and where its laws live.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Context } from '../context.ts';
import { readRegisters } from '../knowledge/registers.ts';
import type { ConfigValues, InitCommands } from './config-text.ts';
import { ScriptsFileSchema } from './schema.ts';

export const COMMAND_KEYS = Object.freeze(['test', 'preflight', 'preflightFull'] as const);

const NONE: Readonly<InitCommands> = Object.freeze({ test: null, preflight: null, preflightFull: null });

/** A package.json's or composer.json's scripts by name: none when the file is missing, not JSON or of another shape. */
function readScripts(file: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
  const parsed = ScriptsFileSchema.safeParse(value);
  return parsed.success ? (parsed.data.scripts ?? {}) : {};
}

/** The package manager a lockfile names, npm when none does. */
function packageManager(root: string): string {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(root, 'bun.lockb')) || existsSync(join(root, 'bun.lock'))) return 'bun';
  return 'npm';
}

function fromPackageJson(root: string): InitCommands {
  const scripts = readScripts(join(root, 'package.json'));
  const pm = packageManager(root);
  const has = (name: string): boolean => Object.hasOwn(scripts, name);
  const test = has('test') ? `${pm} test` : null;
  const preflightScript = ['preflight', 'quality:preflight'].find(has);
  const preflight = preflightScript ? `${pm} run ${preflightScript}` : test;
  const preflightFull = has('preflight:full') ? `${pm} run preflight:full` : preflight;
  return { test, preflight, preflightFull };
}

function fromComposer(root: string): InitCommands {
  const scripts = readScripts(join(root, 'composer.json'));
  const test = Object.hasOwn(scripts, 'test') ? 'composer test' : null;
  const preflight = Object.hasOwn(scripts, 'preflight') ? 'composer preflight' : test;
  return { test, preflight, preflightFull: preflight };
}

function fromMakefile(root: string): InitCommands {
  const text = readFileSync(join(root, 'Makefile'), 'utf8');
  // A rule `name:` (or `name: deps`), never a `name := value` assignment.
  const target = (name: string): boolean => new RegExp(`^${name}\\s*:(?!=)`, 'm').test(text);
  const test = target('test') ? 'make test' : null;
  const preflight = target('preflight') ? 'make preflight' : test;
  return { test, preflight, preflightFull: preflight };
}

const SOURCES: { file: string; read: (root: string) => InitCommands }[] = [
  { file: 'package.json', read: fromPackageJson },
  { file: 'composer.json', read: fromComposer },
  { file: 'Makefile', read: fromMakefile },
];

/** `{ test, preflight, preflightFull }` from the first source file that exists, each `null` when unknown. */
export function detectCommands(root: string): InitCommands {
  const source = SOURCES.find(({ file }) => existsSync(join(root, file)));
  return source ? source.read(root) : { ...NONE };
}

/**
 * `knowledge` when the knowledge registers hold at least one principle, rule or invariant — not
 * when the folder merely exists, since every install lays down the forms and empty registers there —
 * else `claudeMdInvariants` when CLAUDE.md carries the invariants heading, else `none`. `ctx` carries
 * the schema's defaults.
 */
export function detectLawsSource({ ctx }: { ctx: Context }): ConfigValues['lawsSource'] {
  const { principles, rules, invariants } = readRegisters({ ctx });
  if (principles.length + rules.length + invariants.length > 0) return 'knowledge';
  const claudeMd = join(ctx.root, 'CLAUDE.md');
  const heading = ctx.config.laws.claudeMdHeading;
  if (existsSync(claudeMd) && readFileSync(claudeMd, 'utf8').split('\n').some((line) => line.trim() === heading)) {
    return 'claudeMdInvariants';
  }
  return 'none';
}

// @ts-nocheck
// What `omni init` reads from a repository's own files: the commands it runs (package.json,
// composer.json or a Makefile — the first that exists wins) and where its laws live.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readRegisters } from '../knowledge/registers.ts';

export const COMMAND_KEYS = Object.freeze(['test', 'preflight', 'preflightFull']);

const NONE = Object.freeze({ test: null, preflight: null, preflightFull: null });

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

/** The package manager a lockfile names, npm when none does. */
function packageManager(root) {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(root, 'bun.lockb')) || existsSync(join(root, 'bun.lock'))) return 'bun';
  return 'npm';
}

function fromPackageJson(root) {
  const scripts = readJson(join(root, 'package.json')).scripts ?? {};
  const pm = packageManager(root);
  const has = (name) => Object.hasOwn(scripts, name);
  const test = has('test') ? `${pm} test` : null;
  const preflightScript = ['preflight', 'quality:preflight'].find(has);
  const preflight = preflightScript ? `${pm} run ${preflightScript}` : test;
  const preflightFull = has('preflight:full') ? `${pm} run preflight:full` : preflight;
  return { test, preflight, preflightFull };
}

function fromComposer(root) {
  const scripts = readJson(join(root, 'composer.json')).scripts ?? {};
  const test = Object.hasOwn(scripts, 'test') ? 'composer test' : null;
  const preflight = Object.hasOwn(scripts, 'preflight') ? 'composer preflight' : test;
  return { test, preflight, preflightFull: preflight };
}

function fromMakefile(root) {
  const text = readFileSync(join(root, 'Makefile'), 'utf8');
  // A rule `name:` (or `name: deps`), never a `name := value` assignment.
  const target = (name) => new RegExp(`^${name}\\s*:(?!=)`, 'm').test(text);
  const test = target('test') ? 'make test' : null;
  const preflight = target('preflight') ? 'make preflight' : test;
  return { test, preflight, preflightFull: preflight };
}

const SOURCES = [
  { file: 'package.json', read: fromPackageJson },
  { file: 'composer.json', read: fromComposer },
  { file: 'Makefile', read: fromMakefile },
];

/** `{ test, preflight, preflightFull }` from the first source file that exists, each `null` when unknown. */
export function detectCommands(root) {
  const source = SOURCES.find(({ file }) => existsSync(join(root, file)));
  return source ? source.read(root) : { ...NONE };
}

/**
 * `knowledge` when the knowledge registers hold at least one principle, rule or invariant — not
 * when the folder merely exists, since every install lays down the forms and empty registers there —
 * else `claudeMdInvariants` when CLAUDE.md carries the invariants heading, else `none`. `ctx` carries
 * the schema's defaults.
 */
export function detectLawsSource({ ctx }) {
  const { principles, rules, invariants } = readRegisters({ ctx });
  if (principles.length + rules.length + invariants.length > 0) return 'knowledge';
  const claudeMd = join(ctx.root, 'CLAUDE.md');
  const heading = ctx.config.laws.claudeMdHeading;
  if (existsSync(claudeMd) && readFileSync(claudeMd, 'utf8').split('\n').some((line) => line.trim() === heading)) {
    return 'claudeMdInvariants';
  }
  return 'none';
}

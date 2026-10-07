// PRD 1138: a `generated` list that lies is red. What `omni check config` refuses in the config's
// `generated` section: a path or a `from` prefix that matches nothing tracked, and a build whose first
// word is neither a script of the root package.json (behind a script runner) nor a tracked file
// (behind `node`, or run itself). One line per refusal, naming the entry.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { trackedFiles } from '../check-report.ts';
import { covers } from '../inbox/territory.ts';
import type { GeneratedEntry } from './stale.ts';

/** What the repository holds: its tracked files and the root package.json's script names. */
export type GeneratedGround = { readonly tracked: readonly string[]; readonly scripts: readonly string[] };

/** The commands that run a script of the root package.json: `pnpm build`, `npm run build`… */
const SCRIPT_RUNNERS: ReadonlySet<string> = new Set(['pnpm', 'npm', 'yarn', 'bun']);
/** The words before a script's name that name no script: `npm run build`. */
const RUN_WORDS: ReadonlySet<string> = new Set(['run', 'run-script']);
const NODE = 'node';

/** The words of a command after its first, flags left out. */
function operands(words: readonly string[]): string[] {
  return words.slice(1).filter((word) => !word.startsWith('-'));
}

function scriptProblem(words: readonly string[], scripts: readonly string[]): string | null {
  const rest = operands(words);
  const script = RUN_WORDS.has(rest[0] ?? '') ? rest[1] : rest[0];
  if (script === undefined) return 'names no script of the root package.json';
  return scripts.includes(script) ? null : `${script} is no script of the root package.json`;
}

function nodeProblem(words: readonly string[], tracked: readonly string[]): string | null {
  const file = operands(words)[0];
  if (file === undefined) return 'names no tracked file';
  return tracked.includes(file.replace(/^\.\//, '')) ? null : `${file} is not a tracked file`;
}

/** Why a build cannot run here, or `null` when its first word is a script runner, node or a file. */
function buildProblem(build: string, { tracked, scripts }: GeneratedGround): string | null {
  const words = build.trim().split(/\s+/);
  const first = words[0] ?? '';
  if (SCRIPT_RUNNERS.has(first)) return scriptProblem(words, scripts);
  if (first === NODE) return nodeProblem(words, tracked);
  if (tracked.includes(first.replace(/^\.\//, ''))) return null;
  return `${first} is neither a package.json script runner, node <file>, nor a tracked file`;
}

function entryViolations(entry: GeneratedEntry, index: number, ground: GeneratedGround): string[] {
  const name = `generated.${index} (${entry.path})`;
  const matchesNothing = (prefix: string) => !ground.tracked.some((file) => covers([prefix], file));
  const out: string[] = [];
  if (matchesNothing(entry.path)) out.push(`${name}: path ${entry.path} matches no tracked file`);
  for (const prefix of entry.from.filter(matchesNothing)) out.push(`${name}: from ${prefix} matches no tracked file`);
  const problem = buildProblem(entry.build, ground);
  if (problem !== null) out.push(`${name}: build ${entry.build} — ${problem}`);
  return out;
}

const PACKAGE_FILE = 'package.json';

/** The script names of `<root>/package.json`; none when there is no such file or no scripts in it. */
function rootScripts(root: string): string[] {
  const file = join(root, PACKAGE_FILE);
  if (!existsSync(file)) return [];
  const manifest: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const scripts = manifest !== null && typeof manifest === 'object' && 'scripts' in manifest ? manifest.scripts : null;
  return scripts !== null && typeof scripts === 'object' ? Object.keys(scripts) : [];
}

/** What the repository at `root` holds, read from git and its root package.json. */
export function readGround(root: string): GeneratedGround {
  return { tracked: trackedFiles({ root }), scripts: rootScripts(root) };
}

/** Every refusal of the section, entry by entry, in config order; none when every entry holds. */
export function generatedViolations(entries: readonly GeneratedEntry[], ground: GeneratedGround): string[] {
  return entries.flatMap((entry, index) => entryViolations(entry, index, ground));
}

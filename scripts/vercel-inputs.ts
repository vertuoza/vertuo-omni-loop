// Which changed paths can change what a Vercel project deploys (PRD 1646). The ignore step
// (scripts/vercel-ignore.sh) and the preview debounce (scripts/preview-debounce.ts) both ask it.
//
// - galaxy builds unless every changed path is on its never list: a deny list, so a folder galaxy
//   starts reading builds by default. .omni-loop/config.yml and the knowledge registers it serves at
//   runtime stay inputs. The release commit's stamps (kit/dist/, the plugin manifests) are not, and the
//   root package.json counts only beyond its "version": the sidebar shows that version, so after a
//   merge that changes nothing galaxy deploys, it lags until the next one that does (PRD 1646).
// - omni-app builds only when a path on its list changed: an allow list, exact because its functions
//   are the committed bundles under apps/omni-app/api/, which src/vercel-functions.test.ts keeps equal
//   to a fresh build.
// - For both, the root package.json counts only when a line other than "version" changed.
// - On any branch but main, every path under .omni-loop/ is never an input, for both projects.
//
// It runs in Vercel's ignore step, before any install: Node built-ins only.
//
// `node scripts/vercel-inputs.ts <galaxy|omni-app> <main|branch> [--package-json-diff <file>]` reads the
// changed paths on stdin, one per line, prints `vercel-inputs: <project> <yes|no>: <path or none>`,
// and exits 0 for yes, 1 for no, 2 for a usage error.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECTS: readonly string[] = ['galaxy', 'omni-app'];

/** A path rule: a folder (ending in `/`), an exact file, or a file-name suffix (starting with `*`). */
type Rule = string;

/** Paths whose change never reaches what galaxy deploys. */
export const GALAXY_NEVER: readonly Rule[] = [
  '.omni-loop/delivery/',
  '.omni-loop/knowledge/adr/',
  '.omni-loop/knowledge/playbook/',
  '.omni-loop/knowledge/README.md',
  'apps/omni-app/',
  'kit/dist/',
  '*/.claude-plugin/plugin.json',
  '.github/',
  'mutation/',
  'fallow/',
  'layering/',
  'docs/superpowers/',
  'scripts/',
  'README.md',
  'eslint.config.ts',
  'vitest.config.ts',
  'stryker.config.ts',
  'stryker.config.vitest.ts',
  '.fallowrc.jsonc',
  '*.test.ts',
  '*.test.mjs',
];

/** Paths whose change can reach what omni-app deploys. */
const OMNI_APP_INPUTS: readonly Rule[] = ['apps/omni-app/', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'];

/** On a branch other than main, a change here never previews. */
const BRANCH_NEVER: readonly Rule[] = ['.omni-loop/'];

export function matches(rule: Rule, path: string): boolean {
  if (rule.startsWith('*')) return path.endsWith(rule.slice(1));
  if (rule.endsWith('/')) return path.startsWith(rule);
  return path === rule;
}

const onList = (rules: readonly Rule[], path: string): boolean => rules.some((rule) => matches(rule, path));

/** True when a unified diff of package.json changes a line other than its "version". */
export function packageJsonChangesBeyondVersion(diff: string): boolean {
  return diff
    .split('\n')
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)( |$)/.test(line))
    .some((line) => !/^[+-]\s*"version"\s*:/.test(line));
}

export interface Answer {
  affects: boolean;
  /** The first path that made it yes, or null. */
  path: string | null;
}

export interface Options {
  /** On a branch other than main: `.omni-loop/` never counts. */
  branch?: boolean;
  /** The package.json diff, when package.json is among the paths; without it, package.json counts. */
  packageJsonDiff?: string | undefined;
}

/** Whether `paths` can change what `project` deploys. An empty list answers yes: unsure builds. */
export function affects(project: string, paths: readonly string[], options: Options = {}): Answer {
  const changed = paths.map((p) => p.trim()).filter((p) => p !== '');
  if (changed.length === 0) return { affects: true, path: null };
  const relevant = options.branch ? changed.filter((p) => !onList(BRANCH_NEVER, p)) : changed;
  const packageJsonCounts = options.packageJsonDiff === undefined || packageJsonChangesBeyondVersion(options.packageJsonDiff);
  const counts = (p: string): boolean => (p === 'package.json' ? packageJsonCounts : true);
  if (project === 'galaxy') {
    const hit = relevant.find((p) => !onList(GALAXY_NEVER, p) && counts(p));
    return { affects: hit !== undefined, path: hit ?? null };
  }
  if (project === 'omni-app') {
    const hit = relevant.find((p) => (onList(OMNI_APP_INPUTS, p) || p === 'package.json') && counts(p));
    return { affects: hit !== undefined, path: hit ?? null };
  }
  return { affects: true, path: null };
}

/** The `--package-json-diff <file>` option: the file's text, undefined without it, null when misused. */
function packageJsonDiffOption(rest: readonly string[]): string | undefined | null {
  const at = rest.indexOf('--package-json-diff');
  if (at === -1) return undefined;
  const file = rest[at + 1];
  if (!file) return null;
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

function cli(argv: readonly string[], stdin: string): { code: number; line: string } {
  const [project, scope, ...rest] = argv;
  const packageJsonDiff = packageJsonDiffOption(rest);
  if (!project || !PROJECTS.includes(project) || (scope !== 'main' && scope !== 'branch') || packageJsonDiff === null) {
    return { code: 2, line: 'usage: vercel-inputs.ts <galaxy|omni-app> <main|branch> [--package-json-diff <file>]' };
  }
  const answer = affects(project, stdin.split('\n'), { branch: scope === 'branch', packageJsonDiff });
  return {
    code: answer.affects ? 0 : 1,
    line: `vercel-inputs: ${project} ${answer.affects ? 'yes' : 'no'}: ${answer.path ?? 'none'}`,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let stdin = '';
  try {
    stdin = readFileSync(0, 'utf8');
  } catch {
    stdin = '';
  }
  const { code, line } = cli(process.argv.slice(2), stdin);
  console.log(line);
  process.exit(code);
}


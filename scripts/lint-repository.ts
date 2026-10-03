// What `pnpm lint` does (PRD 976), run by scripts/lint.ts: eslint.config.ts over every TypeScript
// file git tracks, each finding and the count per rule printed, and a failure on any finding at all.
// Nothing is held at a ceiling. Given path prefixes, only the tracked files under them are linted.
// `--shard <i>/<n>` (PRD 1042) lints every n-th of those files, from the i-th: CI runs the n shards
// side by side, and together they lint every file exactly once.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** One finding of the linter: where it is and which rule it breaks. */
export type Finding = { path: string; line: number; rule: string };

/** Lints the files (paths from the root): every finding, and the findings as a person reads them. */
export type Linter = (files: readonly string[]) => Promise<{ findings: Finding[]; text: string }>;

function trackedTypeScript(): string[] {
  const out = execFileSync('git', ['ls-files', '-z', '--', '*.ts', '*.tsx', '*.mts', '*.cts'], { cwd: root, encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

const eslintFiles: Linter = async (files) => {
  // Loaded here, not at the top, so a test that hands in its own linter never loads ESLint.
  const { ESLint } = await import('eslint');
  // Node strips the config's types itself: no loader to install.
  const eslint = new ESLint({ cwd: root, flags: ['unstable_native_nodejs_ts_config'], warnIgnored: false });
  const results = await eslint.lintFiles([...files]);
  const findings = results.flatMap((result) =>
    result.messages.map((message) => ({
      path: result.filePath.slice(root.length),
      line: message.line,
      rule: message.ruleId ?? 'parse',
    })),
  );
  const formatter = await eslint.loadFormatter('stylish');
  return { findings, text: await formatter.format(results) };
};

function perRule(findings: readonly Finding[]): string {
  const counts = new Map<string, number>();
  for (const finding of findings) counts.set(finding.rule, (counts.get(finding.rule) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([rule, n]) => `${String(n).padStart(6)}  ${rule}`).join('\n');
}

const shardUsage = 'pnpm lint: --shard <i>/<n> takes two whole numbers, 1 <= i <= n\n';

/** A shard `i` of `n`, from `1/1` up: the files at positions i-1, i-1+n, i-1+2n… */
type Shard = { index: number; count: number };

/** Splits the arguments into path prefixes and an optional shard; `null` when the shard is malformed. */
function parseArgs(args: readonly string[]): { prefixes: string[]; shard: Shard | undefined } | null {
  const prefixes: string[] = [];
  let shard: Shard | undefined;
  for (let k = 0; k < args.length; k += 1) {
    const arg = args[k] ?? '';
    let value: string | undefined;
    if (arg === '--shard') {
      k += 1;
      value = args[k];
    } else if (arg.startsWith('--shard=')) {
      value = arg.slice('--shard='.length);
    } else {
      prefixes.push(arg);
      continue;
    }
    const match = /^(\d+)\/(\d+)$/.exec(value ?? '');
    if (!match) return null;
    const index = Number(match[1]);
    const count = Number(match[2]);
    if (index < 1 || index > count) return null;
    shard = { index, count };
  }
  return { prefixes, shard };
}

/**
 * Lints every tracked file, or only those under the path prefixes among `args` when any are given,
 * and only the shard `--shard <i>/<n>` names when it is given. Exit code 0 only with no finding at
 * all, 2 for a malformed shard; the report prints each finding, then the count per rule.
 */
export async function lintRepository(
  args: readonly string[],
  { tracked = trackedTypeScript, lint = eslintFiles }: { tracked?: () => string[]; lint?: Linter } = {},
): Promise<{ exitCode: number; report: string }> {
  const parsed = parseArgs(args);
  if (!parsed) return { exitCode: 2, report: shardUsage };
  const { prefixes, shard } = parsed;
  const all = tracked();
  const scoped = prefixes.length > 0 ? all.filter((path) => prefixes.some((prefix) => path.startsWith(prefix))) : all;
  const files = shard ? scoped.filter((_, position) => position % shard.count === shard.index - 1) : scoped;
  const { findings, text } = await lint(files);
  const of = shard ? ` (shard ${String(shard.index)}/${String(shard.count)})` : '';
  const report = `${text}\n${perRule(findings)}\npnpm lint: ${String(findings.length)} findings in ${String(files.length)} files${of}\n`;
  return { exitCode: findings.length === 0 ? 0 : 1, report };
}

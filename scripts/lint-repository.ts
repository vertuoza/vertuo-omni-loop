// What `pnpm lint` does (PRD 976), run by scripts/lint.ts: eslint.config.ts over every TypeScript
// file git tracks, each finding and the count per rule printed, and a failure on any finding at all.
// Nothing is held at a ceiling. Given path prefixes, only the tracked files under them are linted.
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

/**
 * Lints every tracked file, or only those under `prefixes` when any are given. Exit code 0 only with
 * no finding at all; the report prints each finding, then the count per rule.
 */
export async function lintRepository(
  prefixes: readonly string[],
  { tracked = trackedTypeScript, lint = eslintFiles }: { tracked?: () => string[]; lint?: Linter } = {},
): Promise<{ exitCode: number; report: string }> {
  const all = tracked();
  const files = prefixes.length > 0 ? all.filter((path) => prefixes.some((prefix) => path.startsWith(prefix))) : all;
  const { findings, text } = await lint(files);
  const report = `${text}\n${perRule(findings)}\npnpm lint: ${findings.length} findings in ${files.length} files\n`;
  return { exitCode: findings.length === 0 ? 0 : 1, report };
}
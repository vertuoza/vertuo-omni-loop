// `pnpm lint` (PRD 976): runs eslint.config.ts over every TypeScript file git tracks and holds each
// area's count of findings at its ceiling in scripts/lint-ceilings/ (scripts/lint-areas.ts).
//
// `pnpm lint <prefix>…` lints only the tracked files under those prefixes and prints each finding,
// then the count per rule, with no ceiling: what a slice clearing a folder reads.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { type Area, type Finding, CEILINGS_DIR, ceilingProblems, countByArea, readArea } from './lint-areas.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

function trackedTypeScript(): string[] {
  const out = execFileSync('git', ['ls-files', '-z', '--', '*.ts', '*.tsx', '*.mts', '*.cts'], { cwd: root, encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

async function lint(files: readonly string[]): Promise<{ findings: Finding[]; text: string }> {
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
}

function readAreas(): { areas: Area[]; problems: string[] } {
  const dir = join(root, CEILINGS_DIR);
  const areas: Area[] = [];
  const problems: string[] = [];
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json')).sort()) {
    const read = readArea(file.slice(0, -'.json'.length), readFileSync(join(dir, file), 'utf8'));
    if ('problem' in read) problems.push(read.problem);
    else areas.push(read.value);
  }
  return { areas, problems };
}

function perRule(findings: readonly Finding[]): string {
  const counts = new Map<string, number>();
  for (const finding of findings) counts.set(finding.rule, (counts.get(finding.rule) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([rule, n]) => `${String(n).padStart(6)}  ${rule}`).join('\n');
}

async function main(prefixes: readonly string[]): Promise<number> {
  const tracked = trackedTypeScript();
  if (prefixes.length > 0) {
    const files = tracked.filter((path) => prefixes.some((prefix) => path.startsWith(prefix)));
    const { findings, text } = await lint(files);
    process.stdout.write(`${text}\n${perRule(findings)}\n${findings.length} findings in ${files.length} files\n`);
    return findings.length === 0 ? 0 : 1;
  }
  const { areas, problems: unread } = readAreas();
  if (unread.length > 0) {
    process.stderr.write(`${unread.join('\n')}\n`);
    return 1;
  }
  const { findings } = await lint(tracked);
  const { counts } = countByArea(findings, areas);
  for (const area of areas) process.stdout.write(`${area.name}: ${counts.get(area.name) ?? 0} / ${area.ceiling}\n`);
  const problems = ceilingProblems(findings, areas);
  if (problems.length > 0) {
    process.stderr.write(`\npnpm lint: ${problems.length} problems\n${problems.join('\n')}\n`);
    return 1;
  }
  process.stdout.write(`pnpm lint: ${findings.length} findings, every area at its ceiling\n`);
  return 0;
}

process.exitCode = await main(process.argv.slice(2));

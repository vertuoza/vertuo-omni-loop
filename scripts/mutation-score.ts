// `node scripts/mutation-score.ts [--report <path>] [--floor <path>]` (PRD 1072): scores each module of
// Stryker's JSON report (`reports/mutation/mutation.json` by default) against `mutation/floor.json`,
// prints the table, and lists each survivor of a module below its floor. Exits 1 then, 0 otherwise.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { judge, parseFloors, parseReport, renderJudgement, scoreModules } from './mutation-report.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

/** The value after `--<name>` (or in `--<name>=`), else `fallback`, from the repository's root. */
function option(argv: readonly string[], name: string, fallback: string): string {
  const at = argv.indexOf(`--${name}`);
  const inline = argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  return resolve(root, (at >= 0 ? argv[at + 1] : undefined) ?? inline ?? fallback);
}

const argv = process.argv.slice(2);
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const judgement = judge(
  scoreModules(parseReport(readJson(option(argv, 'report', 'reports/mutation/mutation.json')))),
  parseFloors(readJson(option(argv, 'floor', 'mutation/floor.json'))),
);
process.stdout.write(renderJudgement(judgement));
process.exitCode = judgement.passed ? 0 : 1;

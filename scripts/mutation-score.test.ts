// The mutation score (PRD 1072), proven on fixture reports: never by running Stryker. Killed and timed
// out over killed, timed out, survived and not covered, per module; a mutant that does not compile is
// left out; a module below its floor fails and names each survivor; a module with no floor is reported.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { judge, moduleOf, parseReport, renderJudgement, scoreModules } from './mutation-report.ts';

type Status = 'Killed' | 'Timeout' | 'Survived' | 'NoCoverage' | 'CompileError' | 'RuntimeError' | 'Ignored';

/** One mutant of a fixture report, on `line`. */
const mutant = (status: Status, line = 1, mutatorName = 'BooleanLiteral', replacement = 'false') => ({
  id: `${status}-${String(line)}`,
  mutatorName,
  replacement,
  status,
  location: { start: { line, column: 1 }, end: { line, column: 5 } },
});

/** A fixture report in Stryker's JSON shape: each file with its mutants. */
const report = (files: Record<string, ReturnType<typeof mutant>[]>) => ({
  schemaVersion: '1.0',
  thresholds: { high: 80, low: 60 },
  files: Object.fromEntries(Object.entries(files).map(([path, mutants]) => [path, { language: 'typescript', source: '', mutants }])),
});

describe('the module a file belongs to', () => {
  it('is its folder under kit/lib, or its own name for a file at the top', () => {
    expect(moduleOf('kit/lib/outbox/gate/rank.ts')).toBe('outbox');
    expect(moduleOf('kit/lib/env/read.ts')).toBe('env');
    expect(moduleOf('kit/lib/board.ts')).toBe('board');
    expect(moduleOf('kit/lib/ids.ts')).toBe('ids');
  });
});

describe('the score of each module', () => {
  it('counts killed and timed out over killed, timed out, survived and not covered', () => {
    const scores = scoreModules(
      parseReport(
        report({
          'kit/lib/outbox/a.ts': [mutant('Killed'), mutant('Killed'), mutant('Timeout'), mutant('Survived', 7)],
          'kit/lib/outbox/b.ts': [mutant('NoCoverage', 3), mutant('CompileError'), mutant('CompileError')],
          'kit/lib/ids.ts': [mutant('Killed'), mutant('RuntimeError'), mutant('Ignored')],
        }),
      ),
    );
    const outbox = scores.find((score) => score.module === 'outbox');
    expect(outbox).toMatchObject({ killed: 2, timedOut: 1, survived: 1, noCoverage: 1, compileErrors: 2 });
    expect(outbox?.score).toBeCloseTo(60);
    expect(scores.find((score) => score.module === 'ids')?.score).toBe(100);
  });

  it('leaves non-compiling mutants out of the score, never counted as survived', () => {
    const [ids] = scoreModules(parseReport(report({ 'kit/lib/ids.ts': [mutant('Killed'), mutant('CompileError'), mutant('CompileError')] })));
    expect(ids?.score).toBe(100);
  });

  it('keeps each survivor and each uncovered mutant with its file, line and mutation', () => {
    const [layout] = scoreModules(
      parseReport(report({ 'kit/lib/layout.ts': [mutant('Survived', 12, 'ConditionalExpression', 'true'), mutant('NoCoverage', 30, 'StringLiteral', '""'), mutant('Killed', 4)] })),
    );
    expect(layout?.survivors).toEqual([
      { file: 'kit/lib/layout.ts', line: 12, mutator: 'ConditionalExpression', replacement: 'true', status: 'Survived' },
      { file: 'kit/lib/layout.ts', line: 30, mutator: 'StringLiteral', replacement: '""', status: 'NoCoverage' },
    ]);
  });

  it('gives a module with no valid mutant no score', () => {
    const [ids] = scoreModules(parseReport(report({ 'kit/lib/ids.ts': [mutant('CompileError')] })));
    expect(ids?.score).toBeNull();
  });

  it('refuses a report that is not in Stryker’s shape', () => {
    expect(() => parseReport({ files: { 'kit/lib/ids.ts': { mutants: [{ status: 'Exploded' }] } } })).toThrow();
    expect(() => parseReport([])).toThrow();
  });
});

describe('the judgement against the floors', () => {
  const scores = () =>
    scoreModules(
      parseReport(
        report({
          'kit/lib/ids.ts': [mutant('Killed'), mutant('Killed'), mutant('Killed'), mutant('Survived', 9)],
          'kit/lib/board.ts': [mutant('Killed'), mutant('Survived', 5, 'EqualityOperator', 'a !== b'), mutant('NoCoverage', 8)],
        }),
      ),
    );

  it('passes when every module is at or above its floor', () => {
    const judgement = judge(scores(), { ids: 75, board: 30 });
    expect(judgement.passed).toBe(true);
    expect(judgement.rows.map((row) => [row.module, row.verdict])).toEqual([
      ['board', 'pass'],
      ['ids', 'pass'],
    ]);
  });

  it('fails when one module is below its floor, and lists that module’s survivors only', () => {
    const judgement = judge(scores(), { ids: 75, board: 34 });
    expect(judgement.passed).toBe(false);
    const text = renderJudgement(judgement);
    expect(text).toContain('board');
    expect(text).toContain('kit/lib/board.ts:5 EqualityOperator → a !== b (survived)');
    expect(text).toContain('kit/lib/board.ts:8');
    expect(text).not.toContain('kit/lib/ids.ts:9');
  });

  it('reports a module with no floor, without failing on it', () => {
    const judgement = judge(scores(), { ids: 75 });
    expect(judgement.passed).toBe(true);
    expect(judgement.rows.find((row) => row.module === 'board')?.verdict).toBe('no floor');
    expect(renderJudgement(judgement)).toMatch(/board .*no floor/);
  });

  it('names a floor whose module the report does not hold', () => {
    const judgement = judge(scores(), { ids: 75, board: 30, policy: 70 });
    expect(judgement.absent).toEqual(['policy']);
    expect(renderJudgement(judgement)).toContain('policy');
  });

  it('prints the table: each module with its score, its counts and its floor', () => {
    const text = renderJudgement(judge(scores(), { ids: 75, board: 30 }));
    expect(text).toContain('| module | score | floor | killed | timed out | survived | no coverage | compile error | verdict |');
    expect(text).toContain('| ids | 75.00 | 75 | 3 | 0 | 1 | 0 | 0 | pass |');
    expect(text).toContain('| board | 33.33 | 30 | 1 | 0 | 1 | 1 | 0 | pass |');
  });
});

describe('pnpm’s scorer, run as a command', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  const script = fileURLToPath(new URL('mutation-score.ts', import.meta.url));

  /** Runs the scorer on a fixture report and floor file; answers its exit code and output. */
  function run(floors: Record<string, number>) {
    const dir = mkdtempSync(join(tmpdir(), 'omni-mutation-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'mutation.json'), JSON.stringify(report({ 'kit/lib/ids.ts': [mutant('Killed'), mutant('Survived', 4)] })));
    writeFileSync(join(dir, 'floor.json'), JSON.stringify(floors));
    const result = spawnSync(process.execPath, [script, '--report', join(dir, 'mutation.json'), '--floor', join(dir, 'floor.json')], { encoding: 'utf8' });
    return { code: result.status, out: result.stdout + result.stderr };
  }

  it('exits 0 when every module holds its floor', () => {
    expect(run({ ids: 50 })).toMatchObject({ code: 0 });
  });

  it('exits 1 when a module is below its floor, naming the survivor’s file and line', () => {
    const { code, out } = run({ ids: 51 });
    expect(code).toBe(1);
    expect(out).toContain('kit/lib/ids.ts:4');
  });
});

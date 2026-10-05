// The mutation score of the delivery core (PRD 1072), read from Stryker's JSON report: per module, killed
// and timed out over killed, timed out, survived and not covered. A mutant that does not compile (or
// errors at run time, or is ignored) is left out, never counted as survived. Judged against
// `mutation/floor.json`, one floor per module, which only goes up.
import { z } from 'zod';

const STATUSES = ['Killed', 'Timeout', 'Survived', 'NoCoverage', 'CompileError', 'RuntimeError', 'Ignored', 'Pending'] as const;

const MutantSchema = z.object({
  mutatorName: z.string(),
  replacement: z.string().optional(),
  status: z.enum(STATUSES),
  location: z.object({ start: z.object({ line: z.number().int(), column: z.number().int() }) }),
});

/** Stryker's JSON report (mutation-testing-report-schema), as far as the score reads it. */
const ReportSchema = z.object({
  files: z.record(z.string(), z.object({ mutants: z.array(MutantSchema) })),
});

type Report = z.infer<typeof ReportSchema>;

/** Parses a report read from disk: anything not in Stryker's shape throws, naming the field. */
export function parseReport(data: unknown): Report {
  return ReportSchema.parse(data);
}

/** One floor per module, a score from 0 to 100. */
const FloorsSchema = z.record(z.string(), z.number().min(0).max(100));

export type Floors = z.infer<typeof FloorsSchema>;

/** Parses `mutation/floor.json`. */
export function parseFloors(data: unknown): Floors {
  return FloorsSchema.parse(data);
}

/**
 * The module a mutated file belongs to: its folder under `kit/lib` (`kit/lib/outbox/gate.ts` is
 * `outbox`), or, for a file at the top of it, its own name (`kit/lib/board.ts` is `board`).
 */
export function moduleOf(path: string): string {
  const inside = path.startsWith('kit/lib/') ? path.slice('kit/lib/'.length) : path;
  const [first = inside] = inside.split('/');
  return first.replace(/\.[cm]?tsx?$/, '');
}

/** A mutant the tests let through: it survived, or no test reached it. */
export type Survivor = { file: string; line: number; mutator: string; replacement: string; status: 'Survived' | 'NoCoverage' };

/** One module's counts, its score (`null` with no valid mutant) and its survivors, in file and line order. */
export type ModuleScore = {
  module: string;
  killed: number;
  timedOut: number;
  survived: number;
  noCoverage: number;
  compileErrors: number;
  score: number | null;
  survivors: Survivor[];
};

/** The counts of a set of mutants: what was detected and what was not. */
export function tally(mutants: readonly z.infer<typeof MutantSchema>[]) {
  const count = (status: (typeof STATUSES)[number]) => mutants.filter((m) => m.status === status).length;
  return { killed: count('Killed'), timedOut: count('Timeout'), survived: count('Survived'), noCoverage: count('NoCoverage'), compileErrors: count('CompileError') };
}

/** Each module's score, sorted by module name. */
export function scoreModules(report: Report): ModuleScore[] {
  const byModule = new Map<string, string[]>();
  for (const file of Object.keys(report.files).sort()) {
    const name = moduleOf(file);
    byModule.set(name, [...(byModule.get(name) ?? []), file]);
  }
  return [...byModule.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, files]) => {
      const mutants = files.flatMap((file) => report.files[file]?.mutants ?? []);
      const counts = tally(mutants);
      const detected = counts.killed + counts.timedOut;
      const valid = detected + counts.survived + counts.noCoverage;
      return { module: name, ...counts, score: valid === 0 ? null : (detected / valid) * 100, survivors: survivorsOf(report, files) };
    });
}

/** The survivors of `files`, in file then line order. */
export function survivorsOf(report: Report, files: readonly string[]): Survivor[] {
  return files.flatMap((file) =>
    (report.files[file]?.mutants ?? [])
      .flatMap((m): Survivor[] =>
        m.status === 'Survived' || m.status === 'NoCoverage'
          ? [{ file, line: m.location.start.line, mutator: m.mutatorName, replacement: m.replacement ?? '', status: m.status }]
          : [],
      )
      .sort((a, b) => a.line - b.line),
  );
}

export type Verdict = 'pass' | 'below' | 'no floor';

type Row = ModuleScore & { floor: number | null; verdict: Verdict };

/** The modules judged against their floors, the floors no module of the report answered, and the verdict. */
export type Judgement = { rows: Row[]; absent: string[]; passed: boolean };

/**
 * Each module against its floor: below it fails the run; a module with no floor is reported, never
 * passed silently, but does not fail it; a module with no valid mutant passes. A floor whose module the
 * report does not hold (a partial run) is named.
 */
export function judge(scores: readonly ModuleScore[], floors: Floors): Judgement {
  const rows = scores.map((score): Row => {
    const floor = floors[score.module] ?? null;
    const verdict: Verdict = floor === null ? 'no floor' : score.score !== null && score.score < floor ? 'below' : 'pass';
    return { ...score, floor, verdict };
  });
  const present = new Set(scores.map((score) => score.module));
  const absent = Object.keys(floors)
    .filter((name) => !present.has(name))
    .sort();
  return { rows, absent, passed: rows.every((row) => row.verdict !== 'below') };
}

const percent = (score: number | null) => (score === null ? '—' : score.toFixed(2));

const statusWord = { Survived: 'survived', NoCoverage: 'no coverage' } as const;

/** One survivor, as `file:line Mutator → replacement (status)`. */
export function survivorLine(survivor: Survivor): string {
  return `${survivor.file}:${String(survivor.line)} ${survivor.mutator} → ${survivor.replacement} (${statusWord[survivor.status]})`;
}

/** The judgement as Markdown: the table, then the survivors of each module below its floor. */
export function renderJudgement({ rows, absent, passed }: Judgement): string {
  const lines = [
    '| module | score | floor | killed | timed out | survived | no coverage | compile error | verdict |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((row) =>
      [
        '',
        row.module,
        percent(row.score),
        row.floor === null ? '—' : String(row.floor),
        String(row.killed),
        String(row.timedOut),
        String(row.survived),
        String(row.noCoverage),
        String(row.compileErrors),
        row.verdict,
        '',
      ]
        .join(' | ')
        .trim(),
    ),
    '',
  ];
  for (const row of rows.filter((r) => r.verdict === 'no floor')) {
    lines.push(`${row.module} has no floor in mutation/floor.json: add one at its score, rounded down.`);
  }
  for (const name of absent) lines.push(`${name} has a floor but no mutant in this report.`);
  for (const row of rows.filter((r) => r.verdict === 'below')) {
    lines.push('', `${row.module} is below its floor (${percent(row.score)} < ${String(row.floor)}): ${String(row.survivors.length)} mutants the tests let through:`);
    lines.push(...row.survivors.map((survivor) => `- ${survivorLine(survivor)}`));
  }
  lines.push('', passed ? 'mutation score: every module holds its floor.' : 'mutation score: a module is below its floor.');
  return `${lines.join('\n')}\n`;
}

/** A floor the change lowers, or a module it removes (`to` is then `null`). */
export type Lowering = { module: string; from: number; to: number | null };

/** What `current` lowers or removes from `previous` (the default branch's copy); raising one is fine. */
export function floorLowerings(previous: Floors, current: Floors): Lowering[] {
  return Object.entries(previous)
    .flatMap(([name, from]): Lowering[] => {
      const to = current[name];
      if (to === undefined) return [{ module: name, from, to: null }];
      return to < from ? [{ module: name, from, to }] : [];
    })
    .sort((a, b) => a.module.localeCompare(b.module));
}

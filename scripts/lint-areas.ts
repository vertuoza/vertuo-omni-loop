/**
 * **The lint ratchet** (PRD 976): while the findings are cleared folder by folder, each area's count
 * of findings equals its ceiling, one file per area under `scripts/lint-ceilings/`. An area above or
 * below its ceiling fails, naming the number to write, and so does a finding no area claims. The
 * last slice of the PRD deletes the folder and this file: from then on, `pnpm lint` fails on any
 * finding at all.
 *
 * Pure: the files are read and the linter is run by `scripts/lint.ts`.
 */

export const CEILINGS_DIR = 'scripts/lint-ceilings';

/** One finding of the linter: where it is and which rule it breaks. */
export type Finding = { path: string; line: number; rule: string };

/** An area: its name (the ceiling file's, without `.json`), the path prefixes it holds, its ceiling. */
export type Area = { name: string; paths: string[]; ceiling: number };

type Read<T> = { value: T } | { problem: string };

/** One ceiling file read as an area, or the one line that says why it does not read. */
export function readArea(name: string, text: string): Read<Area> {
  const problem = (why: string) => ({ problem: `${CEILINGS_DIR}/${name}.json: ${why}` });
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return problem('not JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return problem('not an object of paths and ceiling');
  }
  const extra = Object.keys(parsed).filter((key) => key !== 'paths' && key !== 'ceiling');
  if (extra.length > 0) return problem(`${extra.join(', ')} is no field (paths, ceiling)`);
  const paths: unknown = Reflect.get(parsed, 'paths');
  const ceiling: unknown = Reflect.get(parsed, 'ceiling');
  if (!Array.isArray(paths) || paths.length === 0 || !paths.every((p): p is string => typeof p === 'string' && p !== '')) {
    return problem('paths must be a list of path prefixes');
  }
  if (typeof ceiling !== 'number' || !Number.isInteger(ceiling) || ceiling < 0) {
    return problem(`ceiling must be a whole number of findings, not ${JSON.stringify(ceiling)}`);
  }
  return { value: { name, paths, ceiling } };
}

/** The area a path counts toward: the one holding the longest prefix of it, or none. */
export function areaOf(path: string, areas: readonly Area[]): Area | undefined {
  let best: { area: Area; length: number } | undefined;
  for (const area of areas) {
    for (const prefix of area.paths) {
      if (path.startsWith(prefix) && (!best || prefix.length > best.length)) best = { area, length: prefix.length };
    }
  }
  return best?.area;
}

/** A prefix two areas both hold: which area counts its findings would be a guess. */
function sharedPrefixes(areas: readonly Area[]): string[] {
  const owner = new Map<string, string>();
  const problems: string[] = [];
  for (const area of areas) {
    for (const prefix of area.paths) {
      const first = owner.get(prefix);
      if (first === undefined) owner.set(prefix, area.name);
      else problems.push(`${prefix}: held by both ${first} and ${area.name} in ${CEILINGS_DIR}/ — keep it in one`);
    }
  }
  return problems;
}

/** Each area's count of findings, every area listed, and the findings no area holds. */
export function countByArea(findings: readonly Finding[], areas: readonly Area[]): { counts: Map<string, number>; outside: Finding[] } {
  const counts = new Map(areas.map((area) => [area.name, 0]));
  const outside: Finding[] = [];
  for (const finding of findings) {
    const area = areaOf(finding.path, areas);
    if (area) counts.set(area.name, (counts.get(area.name) ?? 0) + 1);
    else outside.push(finding);
  }
  return { counts, outside };
}

/** Every area whose count differs from its ceiling, and every finding outside every area, each with what to do. */
export function ceilingProblems(findings: readonly Finding[], areas: readonly Area[]): string[] {
  const { counts, outside } = countByArea(findings, areas);
  const problems = sharedPrefixes(areas);
  for (const area of areas) {
    const n = counts.get(area.name) ?? 0;
    const file = `${CEILINGS_DIR}/${area.name}.json`;
    if (n > area.ceiling) {
      problems.push(
        `${area.name}: ${n} findings, ceiling ${area.ceiling} — clear the ${n - area.ceiling} new, or write ${n} in ${file} and say why in the pull request`,
      );
    }
    if (n < area.ceiling) problems.push(`${area.name}: ${n} findings, ceiling ${area.ceiling} — write ${n} in ${file}`);
  }
  for (const finding of outside) {
    problems.push(`${finding.path}:${finding.line} ${finding.rule}: outside every area in ${CEILINGS_DIR}/ — clear it`);
  }
  return problems;
}

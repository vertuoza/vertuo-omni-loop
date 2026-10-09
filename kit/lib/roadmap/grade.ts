/**
 * **A roadmap is graded** (PRD 1162, slice s4): whether a parsed roadmap's rows hold together. Pure:
 * the roadmap, what each PRD's spec says, and — in a plan repository — its targets in; every
 * violation out, each naming the row or the question it is about.
 *
 * What it refuses: an id used twice; a blocker that is not a row; a cycle; a wave that does not
 * follow its blockers (1 with none, else one more than the highest blocker's); a blocker without its
 * `why`; a row whose PRD has no folder, or whose spec's `blocked-by` differs from the row's blockers;
 * a question blocking a row that does not exist; a prerequisite (PRD 1218) whose `blocks` names no
 * row, whose check names no base check, with a fix on a row that is not `agent` or naming no base
 * fix, an `agent` row without a fix, a `check` or `person` row without its card or with a card
 * missing one of its four lines. Outside a plan repository, a `repos` column. In a
 * plan repository: a row with no repo, a repo outside `plan.targets`, a `readOnly` repo, and a PRD
 * changing a consumer target in a wave not after a PRD it waits on (directly or not) that changes a
 * target it consumes.
 */
import type { PrdNumber } from '../ids.ts';
import { CARD_LINES } from './parse.ts';
import type { Roadmap, RoadmapPrerequisite, RoadmapRow } from './parse.ts';

/** What a PRD's folder says: its spec's `blocked-by`, or that it has no folder or no readable spec. */
export type PrdFacts = { blockedBy: 'none' | readonly PrdNumber[] } | 'no-folder' | 'unreadable';

/** A plan repository's target, as the roadmap rules read it. */
export type RoadmapTarget = { repo: string; readOnly?: boolean | undefined; consumes?: readonly string[] | undefined };

/** What the grade reads beside the roadmap. `targets` is `null` outside a plan repository. */
export type RoadmapFacts = { prdFacts: (prd: PrdNumber) => PrdFacts; targets: readonly RoadmapTarget[] | null };

const shortName = (slug: string): string => slug.slice(slug.indexOf('/') + 1);

/**
 * The base checks a prerequisite may name as `base:<name>` (spec section 2). The catalog that runs
 * them (`prereqs/`) is keyed by these names.
 */
export const PREREQUISITE_BASE_CHECKS = ['gh-auth', 'node', 'pnpm', 'npm', 'yarn', 'install', 'registry', 'docker', 'labels', 'env-file', 'omni-signin'] as const;

/** The base checks the agent may also fix itself: only what is in the repository and can be undone. */
export const PREREQUISITE_BASE_FIXES = ['install', 'labels', 'env-file'] as const;

const BASE = /^base:(.*)$/;

/** Each id listed twice, once. */
function duplicateIds(roadmap: Roadmap): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const { id } of [...roadmap.prds, ...roadmap.questions, ...(roadmap.prerequisites ?? [])]) {
    if (seen.has(id)) twice.add(id);
    seen.add(id);
  }
  return [...twice].map((id) => `${id}: the id is used twice.`);
}

/** Each blocker that names no row. */
function unknownBlockers(roadmap: Roadmap, rows: ReadonlyMap<string, RoadmapRow>): string[] {
  return roadmap.prds.flatMap((row) =>
    row.blockedBy.filter((blocker) => !rows.has(blocker)).map((blocker) => `${row.id}: blocked by ${blocker}, which is not a row of the roadmap.`),
  );
}

/** Each cycle among the blockers, once, as the ids it runs through. */
function cycles(roadmap: Roadmap, rows: ReadonlyMap<string, RoadmapRow>): string[] {
  const found: string[] = [];
  const seenCycles = new Set<string>();
  const done = new Set<string>();
  const walk = (id: string, path: string[]): void => {
    const start = path.indexOf(id);
    if (start !== -1) {
      const loop = path.slice(start);
      const key = [...loop].sort().join(',');
      if (!seenCycles.has(key)) {
        seenCycles.add(key);
        found.push(`${loop[0]}: a cycle — ${[...loop, id].join(' → ')}.`);
      }
      return;
    }
    if (done.has(id)) return;
    for (const blocker of rows.get(id)?.blockedBy ?? []) walk(blocker, [...path, id]);
    done.add(id);
  };
  for (const row of roadmap.prds) walk(row.id, []);
  return found;
}

/** Each row whose wave is not 1 with no blocker, or one more than its highest blocker's. */
function waveOrder(roadmap: Roadmap, rows: ReadonlyMap<string, RoadmapRow>): string[] {
  const violations: string[] = [];
  for (const row of roadmap.prds) {
    const blockers = row.blockedBy.flatMap((id) => rows.get(id) ?? []);
    const expected = blockers.length === 0 ? 1 : Math.max(...blockers.map((blocker) => blocker.wave)) + 1;
    if (row.wave === expected) continue;
    const reason = blockers.length === 0 ? 'it has no blocker' : `its highest blocker, ${blockers.find((blocker) => blocker.wave === expected - 1)?.id}, is in wave ${expected - 1}`;
    violations.push(`${row.id}: in wave ${row.wave}, but ${reason}, so its wave is ${expected}.`);
  }
  return violations;
}

/** Each row with a blocker and no `why`. */
function missingWhy(roadmap: Roadmap): string[] {
  return roadmap.prds
    .filter((row) => row.blockedBy.length > 0 && row.why === null)
    .map((row) => `${row.id}: blocked by ${row.blockedBy.join(', ')} with no why — every blocker says why it blocks.`);
}

const prdList = (prds: readonly PrdNumber[]): string => (prds.length === 0 ? 'none' : prds.map((prd) => `#${prd}`).join(', '));

/** Each row whose PRD has no folder, or whose spec's `blocked-by` is not the row's blockers' PRDs. */
function specAgreement(roadmap: Roadmap, rows: ReadonlyMap<string, RoadmapRow>, prdFacts: RoadmapFacts['prdFacts']): string[] {
  const violations: string[] = [];
  for (const row of roadmap.prds) {
    const facts = prdFacts(row.prd);
    if (facts === 'no-folder') {
      violations.push(`${row.id}: PRD #${row.prd} has no inbox or shipped folder.`);
      continue;
    }
    if (facts === 'unreadable') {
      violations.push(`${row.id}: PRD #${row.prd}'s spec does not parse, so its blocked-by cannot be compared.`);
      continue;
    }
    const wanted = [...new Set(row.blockedBy.flatMap((id) => rows.get(id)?.prd ?? []))].sort((a, b) => a - b);
    const declared = [...new Set(facts.blockedBy === 'none' ? [] : facts.blockedBy)].sort((a, b) => a - b);
    if (wanted.join(',') === declared.join(',')) continue;
    violations.push(`${row.id}: PRD #${row.prd}'s spec is blocked by ${prdList(declared)}, but its row by ${prdList(wanted)}.`);
  }
  return violations;
}

/** Each question blocking a row that does not exist. */
function unknownQuestionRows(roadmap: Roadmap, rows: ReadonlyMap<string, RoadmapRow>): string[] {
  return roadmap.questions.flatMap((question) =>
    question.blocks.filter((id) => !rows.has(id)).map((id) => `${question.id}: blocks ${id}, which is not a row of the roadmap.`),
  );
}

/** A base name the cell names (`base:<name>`), or `null` when the cell is a shell command or empty. */
function baseName(cell: string | null): string | null {
  return cell === null ? null : (BASE.exec(cell)?.[1] ?? null);
}

/** A prerequisite's fault when its check names a base check the catalog does not have. */
function checkFaults({ id, check }: RoadmapPrerequisite): string[] {
  const name = baseName(check);
  const known: readonly string[] = PREREQUISITE_BASE_CHECKS;
  if (name === null || known.includes(name)) return [];
  return [`${id}: checks ${check}, which is no base check (${PREREQUISITE_BASE_CHECKS.join(', ')}).`];
}

/** A prerequisite's faults of its fix: only an agent row has one, and it names a base fix. */
function fixFaults({ id, fix, who }: RoadmapPrerequisite): string[] {
  if (fix === null) return who === 'agent' ? [`${id}: is an agent row without a fix; an agent row names the base fix it runs.`] : [];
  if (who !== 'agent') return [`${id}: has the fix ${fix}, but only an agent row has a fix.`];
  const known: readonly string[] = PREREQUISITE_BASE_FIXES;
  return known.includes(baseName(fix) ?? '') ? [] : [`${id}: has the fix ${fix}, which is no base fix (${PREREQUISITE_BASE_FIXES.join(', ')}).`];
}

/** One prerequisite's faults of its card: none for an agent row, else one with its four lines. */
function cardFaults({ id, who, card }: RoadmapPrerequisite): string[] {
  if (who === 'agent') return [];
  if (card === null) return [`${id}: has no card; a check or person row has a "### ${id}" card under the table.`];
  return CARD_LINES.filter(([field]) => card[field] === null || card[field] === '').map(([, label]) => `${id}: its card has no "${label}" line.`);
}

/** Every prerequisite's faults: what it blocks, its check, its fix and its card. */
function prerequisiteViolations(roadmap: Roadmap, rows: ReadonlyMap<string, RoadmapRow>): string[] {
  return (roadmap.prerequisites ?? []).flatMap((prerequisite) => [
    ...(prerequisite.blocks === 'all' ? [] : prerequisite.blocks)
      .filter((id) => !rows.has(id))
      .map((id) => `${prerequisite.id}: blocks ${id}, which is not a row of the roadmap.`),
    ...checkFaults(prerequisite),
    ...fixFaults(prerequisite),
    ...cardFaults(prerequisite),
  ]);
}

/** Every row a row waits on, directly or through others. */
function upstream(row: RoadmapRow, rows: ReadonlyMap<string, RoadmapRow>): RoadmapRow[] {
  const found = new Map<string, RoadmapRow>();
  const queue = [...row.blockedBy];
  while (queue.length > 0) {
    const id = queue.shift() ?? '';
    const blocker = rows.get(id);
    if (blocker === undefined || found.has(id) || id === row.id) continue;
    found.set(id, blocker);
    queue.push(...blocker.blockedBy);
  }
  return [...found.values()];
}

/** What a plan repository's rules read of its targets: their short names, the read-only ones, and
 * what each consumes. */
type TargetRules = { names: string[]; readOnly: ReadonlySet<string>; consumes: ReadonlyMap<string, readonly string[]> };

/** A row naming no repository, or naming one that is no target or a read-only one. */
function rowRepoViolations(row: RoadmapRow, { names, readOnly }: TargetRules): string[] {
  const repos = row.repos ?? [];
  if (repos.length === 0) return [`${row.id}: names no repository.`];
  return repos.flatMap((repo) => {
    if (!names.includes(repo)) return [`${row.id}: ${repo} is not a target of plan.targets (${names.join(', ')}).`];
    return readOnly.has(repo) ? [`${row.id}: ${repo} is a read-only target — no roadmap row may name it.`] : [];
  });
}

/** Each repository of `row` consuming one that `blocker` changes, when `row` is not in a later wave. */
function consumerViolations(row: RoadmapRow, blocker: RoadmapRow, consumes: TargetRules['consumes']): string[] {
  if (blocker.wave < row.wave) return [];
  return (row.repos ?? []).flatMap((consumer) => {
    const provider = (blocker.repos ?? []).find((repo) => consumes.get(consumer)?.includes(repo) === true);
    if (provider === undefined) return [];
    return [
      `${row.id}: changes ${consumer}, which consumes ${provider}, in wave ${row.wave}, not after ${blocker.id} (wave ${blocker.wave}) that changes ${provider} and that it waits on.`,
    ];
  });
}

/** A plan repository's rules: every repo a target, none read-only, a consumer after its provider. */
function targetViolations(roadmap: Roadmap, rows: ReadonlyMap<string, RoadmapRow>, targets: readonly RoadmapTarget[]): string[] {
  if (!roadmap.repos) return ['PRDs: the table has no "repos" column; in a plan repository each row names its repositories.'];
  const rules: TargetRules = {
    names: targets.map((target) => shortName(target.repo)),
    readOnly: new Set(targets.filter((target) => target.readOnly === true).map((target) => shortName(target.repo))),
    consumes: new Map(targets.map((target) => [shortName(target.repo), target.consumes ?? []])),
  };
  return roadmap.prds.flatMap((row) => [
    ...rowRepoViolations(row, rules),
    ...upstream(row, rows).flatMap((blocker) => consumerViolations(row, blocker, rules.consumes)),
  ]);
}

/** Every violation of a parsed roadmap, each naming its row or its question. */
export function gradeRoadmap(roadmap: Roadmap, { prdFacts, targets }: RoadmapFacts): string[] {
  const rows = new Map<string, RoadmapRow>();
  for (const row of roadmap.prds) if (!rows.has(row.id)) rows.set(row.id, row);
  const repoRule =
    targets === null
      ? roadmap.repos
        ? ['PRDs: a repos column needs a plan repository (a config with plan.targets).']
        : []
      : targetViolations(roadmap, rows, targets);
  return [
    ...duplicateIds(roadmap),
    ...unknownBlockers(roadmap, rows),
    ...cycles(roadmap, rows),
    ...waveOrder(roadmap, rows),
    ...missingWhy(roadmap),
    ...specAgreement(roadmap, rows, prdFacts),
    ...unknownQuestionRows(roadmap, rows),
    ...prerequisiteViolations(roadmap, rows),
    ...repoRule,
  ];
}

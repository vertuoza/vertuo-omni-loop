// The plan grading `omni plan check <prd>` prints, as a pure function of a plan's Markdown and the
// repository's config (PRD 675): no file read, no print, no exit code. The omni-loop App grades a
// phase-0 PR's plan with it, and the command calls it.
//
// It runs `parsePlanSlices`, `sameWaveCollisions` and `collisionRows` (`./territory.ts`) over the
// slice table, then three checks that module does not carry: every `blocked by` id must name a slice
// in this same plan, no slice may be blocked by one in its own wave or a later one, and no id may be
// used twice. In a plan repository (a config with a `plan` section, PRD 549) each slice names the
// repository it lands in, in a `repo` column, and a `## Repositories` table records each one: this
// grades both, every refusal naming its field first, and gives the collision matrix per repository.
// Outside one, either table is refused.
//
// A plan may deliver its PRD in several landings: a `landing` column puts each slice in one, and a
// `## Landings` table may name each landing and say what must be true before it is merged. Waves
// are counted within a landing, a slice is never blocked by a slice of another landing (the landing
// order carries that), and landing numbers run from 1 with no gap. A plan with no `landing` column
// has one landing and grades as it always did. When the config declares `landings.alone` patterns,
// a slice touching a path one of them matches touches nothing else, and a landing holding such a
// slice holds only such slices: a migration reaches the default branch in a pull request of its own.
import { defined, messageOf } from '../narrow.ts';
import type { Config, Slice } from '../types.ts';
import { collisionRows, parsePlanLandings, parsePlanRepositories, parsePlanSlices, sameWaveCollisions } from './territory.ts';
import type { Collision, PlanLanding, PlanRepository } from './territory.ts';

/** What the grading reads of a config: its `plan` section, when it is a plan repository, its slug,
 * and the paths that land alone. */
export type GradeConfig = Pick<Config, 'plan' | 'repo' | 'landings'>;

/** One repository's collision matrix: `repo` is `null` for an ordinary plan. */
export type CollisionMatrix = { repo: string | null; rows: ReturnType<typeof collisionRows> };

/** One landing of a plan, as the grading reads it: its number, its name (`landing-<n>` when the
 * plan has no `## Landings` row for it), what must be true before it is merged (`null` when nothing
 * says), the ids of its slices in plan order, and its waves. */
export type GradedLanding = { landing: number; name: string; mergeWhen: string | null; slices: string[]; waves: (number | null)[] };

/** A plan's grading, as `gradePlan` returns it. */
export type PlanGrade = {
  slices: Slice[];
  repositories: PlanRepository[];
  /** Every landing in order: one, landing 1, for a plan with no `landing` column. */
  landings: GradedLanding[];
  waves: (number | null)[];
  multi: boolean;
  collisions: (Collision & { wave: number | null | undefined })[];
  matrices: CollisionMatrix[];
  violations: string[];
  parseError: string | null;
};

type Owners = Map<string, string[]>;

/** A full 40-character commit, as a target's `read at` must be. */
const COMMIT = /^[0-9a-f]{40}$/;
/** The plan repository's own `read at`: nothing, an em dash. */
const NO_COMMIT = /^[—–-]$/;

/** Every id used by more than one slice row, each reported once. */
function duplicateIds(slices: readonly Slice[]): string[] {
  const counts = new Map<string, number>();
  for (const slice of slices) counts.set(slice.id, (counts.get(slice.id) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}

/** Every `blocked by` violation: an id naming no slice in this plan, a blocker in another landing,
 * or a blocker in the same wave or a later one than the slice it blocks. A blocker may sit in another
 * repository. */
function blockedByViolations(slices: readonly Slice[]): string[] {
  const waveOf = new Map(slices.map((slice) => [slice.id, slice.wave]));
  const landingOf = new Map(slices.map((slice) => [slice.id, slice.landing]));
  const violations: string[] = [];
  for (const slice of slices) {
    for (const blocker of slice.blockedBy) {
      if (!waveOf.has(blocker)) {
        violations.push(`${slice.id} is blocked by "${blocker}", which names no slice in this plan.`);
        continue;
      }
      const blockerLanding = landingOf.get(blocker);
      if (blockerLanding !== slice.landing) {
        violations.push(
          `blocked by: ${slice.id} (landing ${slice.landing}) is blocked by ${blocker} (landing ${blockerLanding}) — a landing waits for the one before it by its order alone, never by a blocker.`,
        );
        continue;
      }
      const blockerWave = waveOf.get(blocker);
      // `Number` keeps JavaScript's comparison: a `null` wave reads as 0, an unreadable one as NaN.
      if (Number(blockerWave) >= Number(slice.wave)) {
        violations.push(
          `${slice.id} (wave ${slice.wave}) is blocked by ${blocker} (wave ${blockerWave}) — a blocker must sit in an earlier wave.`,
        );
      }
    }
  }
  return violations;
}

/** A landing number a plan may use: a whole number from 1. */
function isLandingNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

/** A landing's name: one kebab-case word or more, as a branch and a title carry it. */
const LANDING_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** What a plan gets wrong about its landings, each line naming its field first: a `landing` cell
 * that is no whole number from 1, a gap in the numbers, and a `## Landings` table that does not name
 * exactly the landings the slice table uses. */
function landingViolations(slices: readonly Slice[], rows: readonly PlanLanding[]): string[] {
  const used = [...new Set(slices.map((slice) => slice.landing).filter(isLandingNumber))].sort((a, b) => a - b);
  return [
    ...slices
      .filter((slice) => !isLandingNumber(slice.landing))
      .map((slice) => `landing: ${slice.id} reads "${slice.landing}", not a whole number from 1.`),
    ...gapViolations(used),
    ...(rows.length === 0 ? [] : landingTableViolations(rows, used)),
  ];
}

/** Each landing number missing below the highest one the slice table uses. */
function gapViolations(used: readonly number[]): string[] {
  const missing = Array.from({ length: used.at(-1) ?? 0 }, (_, index) => index + 1).filter((landing) => !used.includes(landing));
  return missing.map((landing) => `landing: no slice sits in landing ${landing} — landings run from 1 with no gap, and this plan uses ${used.join(', ')}.`);
}

/** What a `## Landings` table gets wrong against the landings the slice table uses. */
function landingTableViolations(rows: readonly PlanLanding[], used: readonly number[]): string[] {
  const violations: string[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    if (!isLandingNumber(row.landing)) {
      violations.push(`## Landings: a row reads "${row.landing}", not a whole number from 1.`);
      continue;
    }
    if (seen.has(row.landing)) violations.push(`## Landings: landing ${row.landing} has more than one row.`);
    seen.add(row.landing);
    if (!used.includes(row.landing)) violations.push(`## Landings: landing ${row.landing} has a row and holds no slice.`);
    if (!LANDING_NAME.test(row.name)) violations.push(`## Landings: landing ${row.landing} is named "${row.name}", not one kebab-case name.`);
  }
  return [...violations, ...used.filter((landing) => !seen.has(landing)).map((landing) => `## Landings: landing ${landing} holds slices and has no row.`)];
}

/** A slice's territory split by `alone`: the prefixes a land-alone pattern matches, and the rest. */
function aloneSplit(slice: Slice, alone: readonly RegExp[]): { alone: string[]; other: string[] } {
  const matches = (prefix: string) => alone.some((pattern) => pattern.test(prefix));
  return { alone: slice.territory.filter(matches), other: slice.territory.filter((prefix) => !matches(prefix)) };
}

/** The land-alone rule, when the config declares patterns: a slice touching a land-alone path touches
 * nothing else, and a landing holding a land-alone slice holds no slice that touches none. A slice
 * that mixes the two is refused once, by the first rule. `[]` with no pattern. */
function landAloneViolations(slices: readonly Slice[], patterns: readonly string[]): string[] {
  if (patterns.length === 0) return [];
  const alone = patterns.map((source) => new RegExp(source));
  const split = new Map(slices.map((slice) => [slice.id, aloneSplit(slice, alone)]));
  const violations: string[] = [];
  for (const slice of slices) {
    const { alone: aloneGround, other } = split.get(slice.id) ?? { alone: [], other: [] };
    if (aloneGround.length > 0 && other.length > 0) {
      violations.push(
        `landing: ${slice.id} (landing ${slice.landing}) touches ${aloneGround.join(', ')}, which lands alone, and also ${other.join(', ')} — a slice touching a land-alone path touches nothing else.`,
      );
    }
  }
  for (const landing of new Set(slices.map((slice) => slice.landing))) {
    const members = slices.filter((slice) => slice.landing === landing);
    const lone = members.filter((slice) => split.get(slice.id)?.other.length === 0 && slice.territory.length > 0);
    const rest = members.filter((slice) => split.get(slice.id)?.alone.length === 0);
    if (lone.length > 0 && rest.length > 0) {
      violations.push(
        `landing: landing ${landing} holds ${lone.map((slice) => slice.id).join(', ')}, which land alone, and ${rest.map((slice) => slice.id).join(', ')}, which do not — a landing holding a land-alone slice holds only land-alone slices.`,
      );
    }
  }
  return violations;
}

/** The distinct waves of `slices`, in order. */
function wavesOf(slices: readonly Slice[]): (number | null)[] {
  return [...new Set(slices.map((slice) => slice.wave))].sort((a, b) => Number(a) - Number(b));
}

/** Every landing the slice table uses, in order, with its row's name and merge condition. Exported
 * for the board, which reads a plan's landings without grading it. */
export function gradedLandings(slices: readonly Slice[], rows: readonly PlanLanding[]): GradedLanding[] {
  const numbers = [...new Set(slices.map((slice) => slice.landing))].sort((a, b) => a - b);
  return numbers.map((landing) => {
    const row = rows.find((candidate) => candidate.landing === landing);
    const members = slices.filter((slice) => slice.landing === landing);
    return {
      landing,
      name: row?.name || `landing-${landing}`,
      mergeWhen: row?.mergeWhen || null,
      slices: members.map((slice) => slice.id),
      waves: wavesOf(members),
    };
  });
}

/** The part of an `owner/name` slug after the `/`: the name a plan's `repo` column uses. */
function shortName(slug: string): string {
  return slug.slice(slug.indexOf('/') + 1);
}

/**
 * What a plan repository's plan gets wrong about its repositories, each line naming its field
 * first. `planSlug` is the plan repository's own slug, `targets` its config's `plan.targets`.
 */
function repositoryViolations(
  slices: readonly Slice[],
  repositories: readonly PlanRepository[],
  { planSlug, targets }: { planSlug: string; targets: readonly { repo: string }[] },
): string[] {
  if (slices.every((slice) => slice.repo === null)) {
    return ['repo: the slice table has no repo column — in a plan repository each slice names the repository it lands in.'];
  }
  const owners = ownersByShortName([...targets.map((target) => target.repo), planSlug]);
  return [
    ...shortNameClashes(owners),
    ...unknownRepoViolations(slices, owners),
    ...missingRowViolations(slices, repositories, owners),
    ...repositoryRowViolations(slices, repositories, { owners, planName: shortName(planSlug) }),
  ];
}

/** Each short name, with the slugs that share it. */
function ownersByShortName(slugs: readonly string[]): Owners {
  const owners: Owners = new Map();
  for (const slug of slugs) {
    const name = shortName(slug);
    owners.set(name, [...(owners.get(name) ?? []), slug]);
  }
  return owners;
}

function shortNameClashes(owners: Owners): string[] {
  return [...owners]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([name, slugs]) => `repo: "${name}" is the short name of ${slugs.join(' and ')} — a slice could not say which.`);
}

function unknownRepoViolations(slices: readonly Slice[], owners: Owners): string[] {
  return slices
    .filter((slice) => slice.repo === null || !owners.has(slice.repo))
    .map(
      (slice) =>
        `repo: ${slice.id} names "${slice.repo}", which is neither a target nor this plan repository (${[...owners.keys()].join(', ')}).`,
    );
}

function missingRowViolations(slices: readonly Slice[], repositories: readonly PlanRepository[], owners: Owners): string[] {
  const rows = new Set(repositories.map((row) => row.repo));
  const named = new Set(slices.map((slice) => slice.repo).filter((name): name is string => name !== null && owners.has(name)));
  return [...named].filter((repo) => !rows.has(repo)).map((repo) => `## Repositories: ${repo} holds slices and has no row.`);
}

function repositoryRowViolations(
  slices: readonly Slice[],
  repositories: readonly PlanRepository[],
  { owners, planName }: { owners: Owners; planName: string },
): string[] {
  const violations: string[] = [];
  for (const row of repositories) {
    const violation = rowViolation(row, slices, { owners, planName });
    if (violation) violations.push(violation);
  }
  return violations;
}

/** One `## Repositories` row's fault, or null. */
function rowViolation(
  row: PlanRepository,
  slices: readonly Slice[],
  { owners, planName }: { owners: Owners; planName: string },
): string | null {
  if (!slices.some((slice) => slice.repo === row.repo)) {
    return `## Repositories: the row ${row.repo} names no slice's repository.`;
  }
  if (row.repo === planName) {
    return NO_COMMIT.test(row.readAt) ? null : `read at: ${row.repo} is the plan repository and reads "${row.readAt}", not —.`;
  }
  if (owners.has(row.repo) && !COMMIT.test(row.readAt)) {
    return `read at: ${row.repo} reads "${row.readAt}", not the full 40-character commit its clone was read at.`;
  }
  return null;
}

/** What an ordinary repository's plan may not carry: either table of a plan repository. */
function notPlanRepositoryViolations(slices: readonly Slice[], repositories: readonly PlanRepository[]): string[] {
  const violations: string[] = [];
  if (slices.some((slice) => slice.repo !== null)) violations.push('repo: a repo column needs a plan repository.');
  if (repositories.length > 0) violations.push('## Repositories: a Repositories table needs a plan repository.');
  return violations;
}

/** The slices grouped by repository, in the order each repository first appears. */
function byRepository(slices: readonly Slice[]): Map<string | null, Slice[]> {
  const groups = new Map<string | null, Slice[]>();
  for (const slice of slices) groups.set(slice.repo, [...(groups.get(slice.repo) ?? []), slice]);
  return groups;
}

/**
 * Grades one plan. Returns `{ slices, repositories, landings, waves, multi, collisions, matrices, violations,
 * parseError }`: `parseError` is `null`, or the reason the slice table could not be read, which is
 * then the only violation. Never throws on a plan's content.
 *
 * @param {string} markdown   the plan's `plan.md`
 * @param {{ config: object }} options   the parsed config (`plan`, `repo.slug` and `landings.alone` are read)
 */
export function gradePlan(markdown: string, { config }: { config: GradeConfig }): PlanGrade {
  let slices: Slice[];
  try {
    slices = parsePlanSlices(markdown);
  } catch (error) {
    return {
      slices: [],
      repositories: [],
      landings: [],
      waves: [],
      multi: false,
      collisions: [],
      matrices: [],
      violations: [messageOf(error)],
      parseError: messageOf(error),
    };
  }
  const repositories = parsePlanRepositories(markdown);
  const landingRows = parsePlanLandings(markdown);
  const planSection = config.plan ?? null;
  const multi = planSection !== null && slices.some((slice) => slice.repo !== null);
  const repoOf = new Map(slices.map((slice) => [slice.id, slice.repo]));
  const collisions = sameWaveCollisions(slices);
  const landings = gradedLandings(slices, landingRows);
  const ofLanding = (id: string) => (landings.length > 1 ? ` of landing ${slices.find((slice) => slice.id === id)?.landing}` : '');

  const violations = [
    ...(planSection === null
      ? notPlanRepositoryViolations(slices, repositories)
      : repositoryViolations(slices, repositories, { planSlug: defined(config.repo.slug, "the plan repository's repo.slug"), targets: planSection.targets })), // a plan repository with no repo.slug throws here, as it always has (PRD 725 outbox item s10-01-plan-repo-without-slug-still-crashes)
    ...duplicateIds(slices).map((id) => `id "${id}" is used by more than one slice row.`),
    ...landingViolations(slices, landingRows),
    ...landAloneViolations(slices, config.landings.alone),
    ...blockedByViolations(slices),
    ...collisions.map(
      (collision) =>
        `${collision.left} and ${collision.right} share ${collision.shared.join(', ')} and both sit in wave ${collision.wave}${ofLanding(collision.left)}${multi ? ` of ${repoOf.get(collision.left)}` : ''} — two slices in one wave may never share territory.`,
    ),
  ];

  const waves = wavesOf(slices);
  const matrices = multi
    ? [...byRepository(slices)].map(([repo, group]) => ({ repo, rows: collisionRows(group) }))
    : [{ repo: null, rows: collisionRows(slices) }];
  return { slices, repositories, landings, waves, multi, collisions, matrices, violations, parseError: null };
}

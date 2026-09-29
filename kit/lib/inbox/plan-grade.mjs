// The plan grading `omni plan check <prd>` prints, as a pure function of a plan's Markdown and the
// repository's config (PRD 675): no file read, no print, no exit code. The omni-loop App grades a
// phase-0 PR's plan with it, and the command calls it.
//
// It runs `parsePlanSlices`, `sameWaveCollisions` and `collisionRows` (`./territory.mjs`) over the
// slice table, then three checks that module does not carry: every `blocked by` id must name a slice
// in this same plan, no slice may be blocked by one in its own wave or a later one, and no id may be
// used twice. In a plan repository (a config with a `plan` section, PRD 549) each slice names the
// repository it lands in, in a `repo` column, and a `## Repositories` table records each one: this
// grades both, every refusal naming its field first, and gives the collision matrix per repository.
// Outside one, either table is refused.
import { collisionRows, parsePlanRepositories, parsePlanSlices, sameWaveCollisions } from './territory.mjs';

/** A full 40-character commit, as a target's `read at` must be. */
const COMMIT = /^[0-9a-f]{40}$/;
/** The plan repository's own `read at`: nothing, an em dash. */
const NO_COMMIT = /^[—–-]$/;

/** Every id used by more than one slice row, each reported once. */
function duplicateIds(slices) {
  const counts = new Map();
  for (const slice of slices) counts.set(slice.id, (counts.get(slice.id) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}

/** Every `blocked by` violation: an id naming no slice in this plan, or a blocker in the same wave
 * or a later one than the slice it blocks. A blocker may sit in another repository. */
function blockedByViolations(slices) {
  const waveOf = new Map(slices.map((slice) => [slice.id, slice.wave]));
  const violations = [];
  for (const slice of slices) {
    for (const blocker of slice.blockedBy ?? []) {
      if (!waveOf.has(blocker)) {
        violations.push(`${slice.id} is blocked by "${blocker}", which names no slice in this plan.`);
        continue;
      }
      const blockerWave = waveOf.get(blocker);
      if (blockerWave >= slice.wave) {
        violations.push(
          `${slice.id} (wave ${slice.wave}) is blocked by ${blocker} (wave ${blockerWave}) — a blocker must sit in an earlier wave.`,
        );
      }
    }
  }
  return violations;
}

/** The part of an `owner/name` slug after the `/`: the name a plan's `repo` column uses. */
function shortName(slug) {
  return slug.slice(slug.indexOf('/') + 1);
}

/**
 * What a plan repository's plan gets wrong about its repositories, each line naming its field
 * first. `planSlug` is the plan repository's own slug, `targets` its config's `plan.targets`.
 */
function repositoryViolations(slices, repositories, { planSlug, targets }) {
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
function ownersByShortName(slugs) {
  const owners = new Map();
  for (const slug of slugs) {
    const name = shortName(slug);
    owners.set(name, [...(owners.get(name) ?? []), slug]);
  }
  return owners;
}

function shortNameClashes(owners) {
  return [...owners]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([name, slugs]) => `repo: "${name}" is the short name of ${slugs.join(' and ')} — a slice could not say which.`);
}

function unknownRepoViolations(slices, owners) {
  return slices
    .filter((slice) => !owners.has(slice.repo))
    .map(
      (slice) =>
        `repo: ${slice.id} names "${slice.repo}", which is neither a target nor this plan repository (${[...owners.keys()].join(', ')}).`,
    );
}

function missingRowViolations(slices, repositories, owners) {
  const rows = new Set(repositories.map((row) => row.repo));
  const named = new Set(slices.map((slice) => slice.repo).filter((name) => owners.has(name)));
  return [...named].filter((repo) => !rows.has(repo)).map((repo) => `## Repositories: ${repo} holds slices and has no row.`);
}

function repositoryRowViolations(slices, repositories, { owners, planName }) {
  const violations = [];
  for (const row of repositories) {
    const violation = rowViolation(row, slices, { owners, planName });
    if (violation) violations.push(violation);
  }
  return violations;
}

/** One `## Repositories` row's fault, or null. */
function rowViolation(row, slices, { owners, planName }) {
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
function notPlanRepositoryViolations(slices, repositories) {
  const violations = [];
  if (slices.some((slice) => slice.repo !== null)) violations.push('repo: a repo column needs a plan repository.');
  if (repositories.length > 0) violations.push('## Repositories: a Repositories table needs a plan repository.');
  return violations;
}

/** The slices grouped by repository, in the order each repository first appears. */
function byRepository(slices) {
  const groups = new Map();
  for (const slice of slices) groups.set(slice.repo, [...(groups.get(slice.repo) ?? []), slice]);
  return groups;
}

/**
 * Grades one plan. Returns `{ slices, repositories, waves, multi, collisions, matrices, violations,
 * parseError }`: `parseError` is `null`, or the reason the slice table could not be read, which is
 * then the only violation. Never throws on a plan's content.
 *
 * @param {string} markdown   the plan's `plan.md`
 * @param {{ config: object }} options   the parsed config (`plan` and `repo.slug` are read)
 */
export function gradePlan(markdown, { config }) {
  let slices;
  try {
    slices = parsePlanSlices(markdown);
  } catch (error) {
    return {
      slices: [],
      repositories: [],
      waves: [],
      multi: false,
      collisions: [],
      matrices: [],
      violations: [error.message],
      parseError: error.message,
    };
  }
  const repositories = parsePlanRepositories(markdown);
  const planSection = config.plan ?? null;
  const multi = planSection !== null && slices.some((slice) => slice.repo !== null);
  const repoOf = new Map(slices.map((slice) => [slice.id, slice.repo]));
  const collisions = sameWaveCollisions(slices);

  const violations = [
    ...(planSection === null
      ? notPlanRepositoryViolations(slices, repositories)
      : repositoryViolations(slices, repositories, { planSlug: config.repo.slug, targets: planSection.targets })),
    ...duplicateIds(slices).map((id) => `id "${id}" is used by more than one slice row.`),
    ...blockedByViolations(slices),
    ...collisions.map(
      (collision) =>
        `${collision.left} and ${collision.right} share ${collision.shared.join(', ')} and both sit in wave ${collision.wave}${multi ? ` of ${repoOf.get(collision.left)}` : ''} — two slices in one wave may never share territory.`,
    ),
  ];

  const waves = [...new Set(slices.map((slice) => slice.wave))].sort((a, b) => a - b);
  const matrices = multi
    ? [...byRepository(slices)].map(([repo, group]) => ({ repo, rows: collisionRows(group) }))
    : [{ repo: null, rows: collisionRows(slices) }];
  return { slices, repositories, waves, multi, collisions, matrices, violations, parseError: null };
}

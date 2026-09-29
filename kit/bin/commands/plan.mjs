// `omni plan check <prd>` — grades a PRD's own `plan.md` before anyone builds off it. Runs
// `parsePlanSlices`, `sameWaveCollisions` and `collisionRows` (`kit/lib/inbox/territory.mjs`) over
// the slice table, then three checks that module does not carry: every `blocked by` id must name a
// slice in this same plan, no slice may be blocked by one in its own wave or a later one, and no id
// may be used twice. Prints the slice count, the waves and the collision matrix, then every
// violation; exits 1 on any.
//
// In a plan repository (a config with a `plan` section, PRD 549) each slice names the repository it
// lands in, in a `repo` column, and a `## Repositories` table records each one: this grades both,
// every refusal naming its field first, and prints the waves and the collision matrix per
// repository. Outside one, either table is refused, and every other plan grades as before.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatFailure, formatPass } from '../../lib/check-report.mjs';
import {
  collisionRows,
  parsePlanRepositories,
  parsePlanSlices,
  sameWaveCollisions,
} from '../../lib/inbox/territory.mjs';
import { parseArgs, positiveInt, println, usageError } from '../args.mjs';

const USAGE = 'usage: omni plan check <prd>';

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
  const violations = [];

  const owners = new Map();
  for (const slug of [...targets.map((target) => target.repo), planSlug]) {
    const name = shortName(slug);
    owners.set(name, [...(owners.get(name) ?? []), slug]);
  }
  for (const [name, slugs] of owners) {
    if (slugs.length > 1) {
      violations.push(`repo: "${name}" is the short name of ${slugs.join(' and ')} — a slice could not say which.`);
    }
  }

  for (const slice of slices) {
    if (!owners.has(slice.repo)) {
      violations.push(
        `repo: ${slice.id} names "${slice.repo}", which is neither a target nor this plan repository (${[...owners.keys()].join(', ')}).`,
      );
    }
  }

  const rows = new Set(repositories.map((row) => row.repo));
  for (const repo of new Set(slices.map((slice) => slice.repo).filter((name) => owners.has(name)))) {
    if (!rows.has(repo)) violations.push(`## Repositories: ${repo} holds slices and has no row.`);
  }
  const planName = shortName(planSlug);
  for (const row of repositories) {
    if (!slices.some((slice) => slice.repo === row.repo)) {
      violations.push(`## Repositories: the row ${row.repo} names no slice's repository.`);
    } else if (row.repo === planName) {
      if (!NO_COMMIT.test(row.readAt)) {
        violations.push(`read at: ${row.repo} is the plan repository and reads "${row.readAt}", not —.`);
      }
    } else if (owners.has(row.repo) && !COMMIT.test(row.readAt)) {
      violations.push(`read at: ${row.repo} reads "${row.readAt}", not the full 40-character commit its clone was read at.`);
    }
  }
  return violations;
}

/** What an ordinary repository's plan may not carry: either table of a plan repository. */
function notPlanRepositoryViolations(slices, repositories) {
  const violations = [];
  if (slices.some((slice) => slice.repo !== null)) violations.push('repo: a repo column needs a plan repository.');
  if (repositories.length > 0) violations.push('## Repositories: a Repositories table needs a plan repository.');
  return violations;
}

/** `count` and its noun, singular for one. */
function counted(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** The slices grouped by repository, in the order each repository first appears. */
function byRepository(slices) {
  const groups = new Map();
  for (const slice of slices) groups.set(slice.repo, [...(groups.get(slice.repo) ?? []), slice]);
  return groups;
}

function checkPlan(prd, { ctx }) {
  const planPath = ctx.layout.planPath(prd);
  if (planPath === null) throw usageError(`omni plan check: PRD ${prd} has no inbox or shipped folder.`);

  let markdown;
  try {
    markdown = readFileSync(join(ctx.root, planPath), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') throw usageError(`omni plan check: no plan at ${planPath}.`);
    throw error;
  }

  let slices;
  try {
    slices = parsePlanSlices(markdown);
  } catch (error) {
    throw usageError(`omni plan check: ${planPath}: ${error.message}`);
  }
  const repositories = parsePlanRepositories(markdown);
  const planSection = ctx.config.plan ?? null;
  const multi = planSection !== null && slices.some((slice) => slice.repo !== null);
  const repoOf = new Map(slices.map((slice) => [slice.id, slice.repo]));

  const violations = [
    ...(planSection === null
      ? notPlanRepositoryViolations(slices, repositories)
      : repositoryViolations(slices, repositories, { planSlug: ctx.config.repo.slug, targets: planSection.targets })),
    ...duplicateIds(slices).map((id) => `id "${id}" is used by more than one slice row.`),
    ...blockedByViolations(slices),
    ...sameWaveCollisions(slices).map(
      (collision) =>
        `${collision.left} and ${collision.right} share ${collision.shared.join(', ')} and both sit in wave ${collision.wave}${multi ? ` of ${repoOf.get(collision.left)}` : ''} — two slices in one wave may never share territory.`,
    ),
  ];

  const waves = [...new Set(slices.map((slice) => slice.wave))].sort((a, b) => a - b);
  const matrices = multi
    ? [...byRepository(slices)].map(([repo, group]) => ({ repo, rows: collisionRows(group) }))
    : [{ repo: null, rows: collisionRows(slices) }];
  return { planPath, slices, waves, multi, matrices, violations };
}

export const plan = {
  async run(args, { ctx, stdout }) {
    const [sub, ...rest] = args;
    if (sub !== 'check') throw usageError(USAGE);
    const { positional } = parseArgs('plan check', rest);
    if (positional.length !== 1) throw usageError(USAGE);
    const prd = positiveInt('plan check', '<prd>', positional[0]);

    const { planPath, slices, waves, multi, matrices, violations } = checkPlan(prd, { ctx });

    println(
      stdout,
      `omni plan check — PRD ${prd}: ${slices.length} slice(s) across wave(s) ${waves.join(', ')} (${planPath}).`,
    );
    if (multi) {
      const repos = new Set(slices.map((slice) => slice.repo)).size;
      println(
        stdout,
        `omni plan check — ${counted(slices.length, 'slice', 'slices')} · ${counted(waves.length, 'wave', 'waves')} · ${counted(repos, 'repository', 'repositories')}:`,
      );
      for (const wave of waves) {
        const members = slices.filter((slice) => slice.wave === wave).map((slice) => `${slice.id} (${slice.repo})`);
        println(stdout, `  wave ${wave}: ${members.join(', ')}`);
      }
    }
    for (const { repo, rows } of matrices) {
      if (rows.length === 0) continue;
      const where = repo === null ? '' : `, ${repo}`;
      println(stdout, `omni plan check — collision matrix${where} (${rows.length} pair(s) sharing ground):`);
      for (const row of rows) println(stdout, `  ${row.pair}: ${row.shared} — ${row.resolved}`);
    }

    if (violations.length > 0) {
      println(stdout, formatFailure(`omni plan check — PRD ${prd}: violation(s):`, violations));
      return 1;
    }
    println(
      stdout,
      formatPass(`omni plan check — PRD ${prd}: ${slices.length} slice(s), all territories and blocks well-formed.`),
    );
    return 0;
  },
};

// @ts-nocheck
// The timeline (PRD 72, "The facts, and what makes a finding"): when the feature PR opened, was
// marked ready and merged; per slice, when its sub-PR opened (the claim) and merged; the waves as
// planned and as merged. A finding when a slice took more than `THRESHOLDS.slowSliceFactor` times the
// median slice time.
//
// `gather` reads the feature PR's issue events, for the moment it was marked ready; the sub-PRs come
// from the retro's shared step "gather-pulls". `detect` and `describe` are pure.
import { parsePlanSlices } from 'vertuo-omni-plan/kit/lib/inbox/territory.ts';
import { THRESHOLDS } from '../rules.ts';
import { PER_PAGE, paginate } from '../github.ts';

const MINUTE = 60 * 1000;

/** @type {import('./index.ts').Kind} */
export const timeline = Object.freeze({
  id: 'timeline',
  section: 'Timeline',
  runs: Object.freeze(['merge']),

  async gather(octokit, { owner, repo, pr }) {
    let events;
    try {
      events = await paginate((page) =>
        octokit
          .request('GET /repos/{owner}/{repo}/issues/{issue_number}/events', {
            owner,
            repo,
            issue_number: pr.number,
            per_page: PER_PAGE,
            page,
          })
          .then(({ data }) => data),
      );
    } catch (error) {
      // Events this installation cannot read leave the ready time unknown; anything else is retried.
      if (error?.status === 404 || error?.status === 403) return { readyAt: null };
      throw error;
    }
    const ready = events.filter((event) => event.event === 'ready_for_review').map((event) => event.created_at);
    return { readyAt: ready.length > 0 ? ready.sort().at(-1) : null };
  },

  detect(records, { pr, prd, config, pulls }) {
    const planned = plannedWaves(prd.plan);
    const sliceTemplate = config.branches.slice.replace('{topic}', prd.topic);
    const subs = pulls
      .map((pull) => ({ pull, slice: sliceOf(pull.headRef, sliceTemplate) }))
      .filter(({ slice }) => slice !== null);
    const merged = wavesAsMerged(subs.map(({ pull }) => pull));

    const slices = subs.map(({ pull, slice }, index) => ({
      slice,
      pr: pull.number,
      url: pull.url,
      openedAt: pull.openedAt,
      mergedAt: pull.mergedAt,
      closedAt: pull.closedAt,
      minutes: pull.mergedAt ? minutesBetween(pull.openedAt, pull.mergedAt) : null,
      plannedWave: planned?.get(slice) ?? null,
      mergedWave: merged[index],
    }));

    const times = slices.filter((slice) => slice.minutes !== null).map((slice) => slice.minutes);
    const medianMinutes = median(times);
    const slowFactor = THRESHOLDS.slowSliceFactor;

    const facts = {
      featurePr: {
        number: pr.number,
        url: pr.url,
        openedAt: pr.openedAt,
        readyAt: records?.readyAt ?? null,
        mergedAt: pr.mergedAt,
        minutes: minutesBetween(pr.openedAt, pr.mergedAt),
      },
      slices,
      sliceCount: new Set(slices.map((slice) => slice.slice)).size,
      waves: {
        planned: planned ? new Set(planned.values()).size : null,
        merged: merged.length > 0 ? Math.max(...merged) : 0,
      },
      medianMinutes,
      slowFactor,
    };

    const findings =
      medianMinutes === null || medianMinutes === 0
        ? []
        : slices
            .filter((slice) => slice.minutes !== null && slice.minutes > slowFactor * medianMinutes)
            .map((slice) => ({
              id: `slow-slice:${slice.slice}`,
              kind: 'slow-slice',
              title: `Slice ${slice.slice} took far longer than the others`,
              happened: `Slice ${slice.slice} took ${slice.minutes} minutes from its claim to its merge, against a median of ${medianMinutes} minutes; the rules flag a slice slower than ${slowFactor} times the median.`,
              evidence: [{ label: `#${slice.pr}`, url: slice.url }],
            }));

    return { facts, findings };
  },

  describe(facts) {
    if (!facts) return null;
    const { featurePr, waves } = facts;
    const planned = waves.planned === null ? 'not known' : waves.planned;
    const lines = [
      `- Feature PR [#${featurePr.number}](${featurePr.url}): opened \`${featurePr.openedAt}\`, ${
        featurePr.readyAt ? `ready \`${featurePr.readyAt}\`` : 'ready: not known'
      }, merged \`${featurePr.mergedAt}\`, ${featurePr.minutes} minutes in all.`,
      `- ${facts.sliceCount} slices; waves: ${planned} planned, ${waves.merged} as merged; median slice: ${
        facts.medianMinutes === null ? 'not known' : `${facts.medianMinutes} minutes`
      } from its claim to its merge.`,
    ];
    if (facts.slices.length > 0) {
      lines.push(
        '',
        '| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        ...facts.slices.map(
          (slice) =>
            `| ${slice.slice} | [#${slice.pr}](${slice.url}) | \`${slice.openedAt}\` | ${
              slice.mergedAt ? `\`${slice.mergedAt}\`` : 'not merged'
            } | ${slice.minutes ?? '—'} | ${slice.plannedWave ?? '—'} | ${slice.mergedWave} |`,
        ),
      );
    }
    return lines;
  },
});

/**
 * The wave each sub-PR merged in, in the order given (oldest claim first): a sub-PR starts a new wave
 * when it was claimed after every sub-PR of the current wave had closed; otherwise it joins it.
 * @param {{ openedAt: string, closedAt: string | null }[]} pulls
 * @returns {number[]}
 */
export function wavesAsMerged(pulls) {
  const waves = [];
  let wave = 0;
  let open = [];
  for (const pull of pulls) {
    const allClosed = open.every((closedAt) => closedAt !== null && closedAt <= pull.openedAt);
    if (wave === 0 || allClosed) {
      wave += 1;
      open = [];
    }
    open.push(pull.closedAt);
    waves.push(wave);
  }
  return waves;
}

/** The slice id a head branch names through `branches.slice` (its topic filled), or `null`. */
function sliceOf(headRef, template) {
  const [prefix, suffix = ''] = template.split('{slice}');
  if (!headRef.startsWith(prefix) || !headRef.endsWith(suffix)) return null;
  const slice = headRef.slice(prefix.length, headRef.length - suffix.length);
  return slice && !slice.includes('/') ? slice : null;
}

/** Each planned slice's wave, from the plan's slice table, or `null` when the plan has none. */
function plannedWaves(plan) {
  if (!plan) return null;
  try {
    return new Map(parsePlanSlices(plan).map((slice) => [slice.id, Number.isFinite(slice.wave) ? slice.wave : null]));
  } catch {
    return null;
  }
}

function minutesBetween(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / MINUTE);
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

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
import type { Kind, RetroPull } from './index.ts';
import { IssueEventSchema } from './schema.ts';

const MINUTE = 60 * 1000;

type Records = { readyAt: string | null };

type SliceTime = {
  slice: string;
  pr: number;
  url: string | null;
  openedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  minutes: number | null;
  plannedWave: number | null;
  mergedWave: number | undefined;
};

type Facts = {
  featurePr: { number: number; url: string | null; openedAt: string; readyAt: string | null; mergedAt: string | null; minutes: number };
  slices: SliceTime[];
  sliceCount: number;
  waves: { planned: number | null; merged: number };
  medianMinutes: number | null;
  slowFactor: number;
};

export const timeline: Kind<Records, Facts> = Object.freeze({
  id: 'timeline',
  section: 'Timeline',
  runs: Object.freeze(['merge'] as const),

  async gather(octokit, { owner, repo, pr }) {
    let events: unknown[];
    try {
      events = await paginate((page: number) =>
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
      const status = statusOf(error);
      if (status === 404 || status === 403) return { readyAt: null };
      throw error;
    }
    const ready = events.map((event) => IssueEventSchema.parse(event)).filter((event) => event.event === 'ready_for_review').map((event) => event.created_at);
    return { readyAt: ready.length > 0 ? (ready.sort().at(-1) ?? null) : null };
  },

  detect(records, { pr, prd, config, pulls }) {
    const planned = plannedWaves(prd.plan);
    const sliceTemplate = config.branches.slice.replace('{topic}', prd.topic);
    const subs = pulls
      .map((pull) => ({ pull, slice: sliceOf(pull.headRef, sliceTemplate) }))
      .filter((sub): sub is { pull: RetroPull; slice: string } => sub.slice !== null);
    const merged = wavesAsMerged(subs.map(({ pull }) => pull));

    const slices: SliceTime[] = subs.map(({ pull, slice }, index) => ({
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

    const times = slices.flatMap((slice) => (slice.minutes === null ? [] : [slice.minutes]));
    const medianMinutes = median(times);
    const slowFactor = THRESHOLDS.slowSliceFactor;

    const facts: Facts = {
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
 */
export function wavesAsMerged(pulls: readonly { openedAt: string; closedAt: string | null }[]): number[] {
  const waves: number[] = [];
  let wave = 0;
  let open: (string | null)[] = [];
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
function sliceOf(headRef: string, template: string): string | null {
  const [prefix = '', suffix = ''] = template.split('{slice}');
  if (!headRef.startsWith(prefix) || !headRef.endsWith(suffix)) return null;
  const slice = headRef.slice(prefix.length, headRef.length - suffix.length);
  return slice && !slice.includes('/') ? slice : null;
}

/** Each planned slice's wave, from the plan's slice table, or `null` when the plan has none. */
function plannedWaves(plan: string | null | undefined): Map<string, number | null> | null {
  if (!plan) return null;
  try {
    return new Map(parsePlanSlices(plan).map((slice) => [slice.id, slice.wave !== null && Number.isFinite(slice.wave) ? slice.wave : null]));
  } catch {
    return null;
  }
}

function minutesBetween(from: string, to: string | null): number {
  return Math.round((Date.parse(to ?? '') - Date.parse(from)) / MINUTE);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const at = (index: number): number => sorted[index] ?? 0;
  return sorted.length % 2 === 1 ? at(middle) : Math.round((at(middle - 1) + at(middle)) / 2);
}

/** The HTTP status a failed request carries, when it carries one. */
function statusOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
}

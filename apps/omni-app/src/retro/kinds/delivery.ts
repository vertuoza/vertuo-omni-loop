// How the delivery went (PRD 72, slice s5): territory breaches through the kit's `breaches`,
// needs-fix and stuck slices and second claims, decisions from the settled file (drift, rework, a
// merge under the override label), and review findings left red or unresolved at merge. Its findings
// carry the kinds `override`, `drift`, `review`, `friction` and `territory`, which `rules` ranks.
//
// `gather` reads, for every sub-PR, its comments and label events; for each merged sub-PR, its
// changed paths; for the feature PR and each merged sub-PR, its reviews and review threads
// (`delivery.reads.mjs`). The plan and the settled file come from `qualify`, through the context.
// `detect` (`delivery.facts.mjs`) and `describe` are pure.
import {
  decisionFacts,
  frictionFacts,
  mergedSlicePulls,
  overrideFacts,
  plural,
  repoLinks,
  reviewFacts,
  slicePulls,
  territoryFacts,
} from './delivery.facts.ts';
import type { DecisionFacts, FrictionFacts, Reads, ReviewFacts, TerritoryFacts } from './delivery.facts.ts';
import { listChangedPaths, listLabelAdds, listReviewThreads, listReviews, listStuckComments, readOrNull } from './delivery.reads.ts';
import type { PullReads } from './delivery.reads.ts';
import type { Kind } from './index.ts';

type Records = { pulls: Reads };

type Facts = {
  decisions: DecisionFacts;
  override: { label: string; mergedUnder: boolean };
  territory: TerritoryFacts;
  friction: FrictionFacts;
  review: ReviewFacts;
};

export const delivery: Kind<Records, Facts> = Object.freeze({
  id: 'delivery',
  section: 'Decisions',
  runs: Object.freeze(['merge'] as const),

  async gather(octokit, { owner, repo, pr, prd, config, pulls }) {
    const subs = slicePulls(pulls, config, prd.topic);
    const merged = new Set(mergedSlicePulls(subs).map(({ pull }) => pull.number));
    const read: Record<string, PullReads> = {};
    const at = (number: number): PullReads => (read[number] ??= {});

    for (const { pull } of subs) {
      const ref = { owner, repo, number: pull.number };
      const [files, stuck, needsFix] = await Promise.all([
        merged.has(pull.number) ? readOrNull(() => listChangedPaths(octokit, ref)) : undefined,
        readOrNull(() => listStuckComments(octokit, ref)),
        readOrNull(() => listLabelAdds(octokit, { ...ref, label: config.labels.needsFix })),
      ]);
      if (files !== undefined) at(pull.number).files = files;
      Object.assign(at(pull.number), { stuck, needsFix });
    }

    for (const number of [pr.number, ...merged]) {
      const ref = { owner, repo, number };
      const [reviews, threads] = await Promise.all([
        readOrNull(() => listReviews(octokit, ref)),
        readOrNull(() => listReviewThreads(octokit, ref)),
      ]);
      Object.assign(at(number), { reviews, threads });
    }

    return { pulls: read };
  },

  detect(records, { pr, prd, config, pulls }) {
    const subs = slicePulls(pulls, config, prd.topic);
    const read = records?.pulls ?? {};
    const decisions = decisionFacts({ prd, config, links: repoLinks(pr) });
    const override = overrideFacts({ pr, config });
    const territory = territoryFacts({ prd, config, subs, read });
    const friction = frictionFacts({ subs, read, config });
    const review = reviewFacts({ pr, subs, read });
    return {
      facts: {
        decisions: decisions.facts,
        override: override.facts,
        territory: territory.facts,
        friction: friction.facts,
        review: review.facts,
      },
      // In the rules' order, so the kind's own findings read worst first.
      findings: [override, decisions, review, friction, territory].flatMap((part) => part.findings),
    };
  },

  describe(facts) {
    if (!facts) return null;
    return [
      decisionsLine(facts.decisions),
      overrideLine(facts.override),
      territoryLine(facts.territory),
      frictionLine(facts.friction),
      reviewLine(facts.review),
    ];
  },
});

function decisionsLine(decisions: DecisionFacts): string {
  if (!decisions.file) return '- Decisions: no settled file at the merge, so no decision is counted.';
  const drifted =
    decisions.drifted > 0 ? `${decisions.drifted} drifted, ${decisions.reworked} of them reworked` : `${decisions.drifted} drifted`;
  const ranks = Object.entries(decisions.byRank).map(([rank, count]) => `${count} ${rank}`);
  return `- Decisions: ${decisions.raised} raised and settled — ${decisions.adopted} adopted, ${decisions.agreed} agreed, ${drifted}${
    ranks.length > 0 ? `; by rank: ${ranks.join(', ')}` : ''
  }.`;
}

function overrideLine(override: Facts['override']): string {
  return `- The feature PR merged ${override.mergedUnder ? 'under' : 'without'} the override label \`${override.label}\`.`;
}

function territoryLine(territory: TerritoryFacts): string {
  if (territory.reason) return `- Territory: not graded — ${territory.reason}.`;
  const { graded, breaches, shared, unread, unplanned } = territory.counts;
  const notes: string[] = [];
  if (unread > 0) notes.push(`the files of ${plural(unread, 'more sub-PR')} could not be read`);
  if (unplanned > 0) notes.push(`${plural(unplanned, 'more sub-PR')} ${unplanned === 1 ? 'names a slice' : 'name slices'} the plan does not hold`);
  const outside = breaches === 0 ? 'no path' : plural(breaches, 'path');
  return `- Territory: ${plural(graded, 'merged sub-PR')} graded against the plan — ${outside} outside a slice’s territory${
    shared > 0 ? `, ${shared} more on shared ground` : ''
  }${notes.map((note) => `; ${note}`).join('')}.`;
}

function frictionLine(friction: FrictionFacts): string {
  const { stuck, needsFix, reclaimed, commentsUnread, eventsUnread } = friction.counts;
  const notes: string[] = [];
  if (commentsUnread > 0) notes.push(`the comments of ${plural(commentsUnread, 'sub-PR')} could not be read`);
  if (eventsUnread > 0) notes.push(`the label events of ${plural(eventsUnread, 'sub-PR')} could not be read, so only the labels they carry now count`);
  return `- Friction: ${plural(stuck, 'slice')} stuck, ${needsFix} labelled \`${friction.label}\`, ${reclaimed} claimed more than once${notes
    .map((note) => `; ${note}`)
    .join('')}.`;
}

function reviewLine(review: ReviewFacts): string {
  const c = review.counts;
  const reviewsRead = c.pulls - c.reviewsUnread;
  const threadsRead = c.pulls - c.threadsUnread;
  const parts: string[] = [];
  if (reviewsRead > 0) parts.push(`${plural(c.reviews, 'review')}${c.reviews > 0 ? ` (${c.reviewsByPeople} by people, ${c.reviewsByBots} by bots)` : ''}`);
  if (threadsRead > 0) parts.push(`${plural(c.threads, 'review thread')}${c.threads > 0 ? ` (${c.threadsByPeople} by people, ${c.threadsByBots} by bots)` : ''}`);
  if (reviewsRead > 0 || threadsRead > 0) parts.push(plural(c.red, 'red-circle bot finding'));
  if (threadsRead > 0) parts.push(`${plural(c.unresolved, 'thread')} unresolved at the merge`);
  const unread: string[] = [];
  if (c.reviewsUnread > 0) unread.push(`the reviews of ${c.reviewsUnread}`);
  if (c.threadsUnread > 0) unread.push(`the review threads of ${c.threadsUnread}`);
  return `- Review: ${plural(c.pulls, 'pull request')}${parts.length > 0 ? ` — ${parts.join(', ')}` : ''}${
    unread.length > 0 ? `; ${unread.join(' and ')} could not be read` : ''
  }.`;
}

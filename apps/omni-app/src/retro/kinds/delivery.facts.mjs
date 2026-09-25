// The detectors of the delivery kind (PRD 72, "The facts, and what makes a finding"): decisions and
// the override label, territory, agent friction and review. Pure: plain records and the PRD's plan
// and settled file in, facts and findings out. They reuse the kit unchanged: `parsePlanSlices`,
// `collisions` and `breaches` for territories, `parseSettledEntries` and `reworkPullRequest` for
// decisions.
//
//   Decisions   the settled file: raised, adopted, agreed and drifted, by rank; a drift closed as
//               reworked. A finding for any drift.
//   Override    a feature PR merged carrying `labels.outboxGo`. A finding.
//   Territory   paths a merged sub-PR changed outside its slice's territory. The PRD's own outbox
//               folder (its items and accounts) is every slice's ground, and a path on shared ground
//               (ground two slices' territories both cover, as the kit computes it) is counted, never
//               flagged. A finding for any other path.
//   Friction    `labels.needsFix` added, "Stuck after N attempts" comments, a slice claimed by more
//               than one sub-PR. A finding for a stuck or needs-fix slice; a second claim is counted,
//               and named in that finding.
//   Review      reviews and review threads by author kind, red-circle bot findings, threads left
//               unresolved at the merge. A finding for a pull request carrying either.
//
// A record GitHub would not give (`null`) is counted as unknown, never as none.
import { breaches, collisions, covers, parsePlanSlices } from 'vertuo-omni-plan/kit/lib/inbox/territory.mjs';
import { foldersLayout } from 'vertuo-omni-plan/kit/lib/layout.mjs';
import { makeMarkers } from 'vertuo-omni-plan/kit/lib/markers.mjs';
import { RANK_VALUES, SETTLED_FILE } from 'vertuo-omni-plan/kit/lib/outbox/outbox.mjs';
import { parseSettledEntries } from 'vertuo-omni-plan/kit/lib/outbox/settle.mjs';
import { reworkPullRequest } from 'vertuo-omni-plan/kit/lib/policy/rework.mjs';

/** The heading of the comment `/omni:pr` posts when a pull request is stuck: "## Stuck after 3 attempts". */
const STUCK = /^#{1,6}\s*Stuck after (\d+) attempts?\b/m;
/** A review bot marks its most severe findings with a red circle. */
const RED_CIRCLE = /🔴|:red_circle:/u;

/** The attempts a "Stuck after N attempts" comment names, or `null` for any other comment. */
export function stuckAttempts(body) {
  const match = STUCK.exec(body ?? '');
  return match ? Number(match[1]) : null;
}

export function hasRedCircle(body) {
  return typeof body === 'string' && RED_CIRCLE.test(body);
}

/** GitHub names an app's account `<name>[bot]`. */
export function isBotLogin(login) {
  return typeof login === 'string' && login.endsWith('[bot]');
}

/** The slice id a head branch names through `branches.slice` (its topic filled), or `null`. */
export function sliceOf(headRef, template) {
  const [prefix, suffix = ''] = template.split('{slice}');
  if (!headRef.startsWith(prefix) || !headRef.endsWith(suffix)) return null;
  const slice = headRef.slice(prefix.length, headRef.length - suffix.length);
  return slice && !slice.includes('/') ? slice : null;
}

/** The pull requests into the feature branch that are sub-PRs of a slice, oldest claim first. */
export function slicePulls(pulls, config, topic) {
  const template = config.branches.slice.replace('{topic}', topic);
  return pulls.map((pull) => ({ pull, slice: sliceOf(pull.headRef, template) })).filter(({ slice }) => slice !== null);
}

/** The sub-PRs that merged: the ones whose diffs, reviews and threads the retro reads. */
export function mergedSlicePulls(subs) {
  return subs.filter(({ pull }) => Boolean(pull.mergedAt));
}

/** Where the settled file of the PRD lives at the merge: in its shipped folder, or in the outbox. */
export function settledPath(prd, config) {
  return prd.state === 'shipped' ? `${prd.folder}/outbox/${SETTLED_FILE}` : `${outboxFolder(prd, config)}/${SETTLED_FILE}`;
}

function outboxFolder(prd, config) {
  return `${foldersLayout('', config.paths).dirs.outbox}/${prd.folder.split('/').at(-1)}`;
}

/** Links into the repository, from the feature PR's own URL; `null` links when it has none. */
export function repoLinks(pr) {
  const base = typeof pr.url === 'string' ? pr.url.replace(/\/pull\/\d+$/, '') : null;
  return {
    pull: (number) => (base ? `${base}/pull/${number}` : null),
    blob: (path) => (base && pr.mergeSha ? `${base}/blob/${pr.mergeSha}/${path}` : null),
    ref: (reference) => (/^#\d+$/.test(reference) ? (base ? `${base}/pull/${reference.slice(1)}` : null) : reference),
  };
}

// ---- decisions and the override label ------------------------------------------------------------

/** The settled decisions, by verdict and by rank; a finding for each drift. */
export function decisionFacts({ prd, config, links }) {
  if (typeof prd.settled !== 'string') {
    return { facts: { file: null, raised: 0, adopted: 0, agreed: 0, drifted: 0, reworked: 0, byRank: {}, drifts: [] }, findings: [] };
  }
  const entries = parseSettledEntries(prd.settled, makeMarkers(config.markers.prefix));
  const file = settledPath(prd, config);
  const verdicts = (verdict) => entries.filter((entry) => entry.verdict === verdict).length;
  const drifts = entries
    .filter((entry) => entry.verdict === 'drifted')
    .map((entry) => ({ id: entry.id, rank: entry.fields.Rank ?? null, slice: entry.fields.Slice ?? null, reworkedBy: reworkPullRequest(entry) }));

  const facts = {
    file,
    raised: entries.length,
    adopted: verdicts('adopted'),
    agreed: verdicts('agreed'),
    drifted: drifts.length,
    reworked: drifts.filter((drift) => drift.reworkedBy).length,
    byRank: byRank(entries),
    drifts,
  };

  const findings = drifts.map((drift) => {
    const about = [drift.rank && `rank ${drift.rank}`, drift.slice && `slice ${drift.slice}`].filter(Boolean).join(', ');
    const rework = drift.reworkedBy
      ? `${drift.reworkedBy.startsWith('#') ? `rework ${drift.reworkedBy}` : 'a rework'} brought the build back in line`
      : 'no rework had closed it at the merge';
    const evidence = [{ label: SETTLED_FILE, url: links.blob(file) }];
    if (drift.reworkedBy) evidence.push({ label: drift.reworkedBy.startsWith('#') ? drift.reworkedBy : 'rework', url: links.ref(drift.reworkedBy) });
    return {
      id: `drift:${drift.id}`,
      kind: 'drift',
      title: drift.slice ? `A decision of slice ${drift.slice} drifted` : 'A decision drifted',
      happened: `The answer to decision \`${drift.id}\`${about ? ` (${about})` : ''} disagreed with what was built; ${rework}.`,
      evidence: withUrls(evidence),
    };
  });
  return { facts, findings };
}

/** Each rank's count, the kit's ranks first. */
function byRank(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const rank = entry.fields.Rank ?? 'unknown';
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  const order = (rank) => (RANK_VALUES.includes(rank) ? RANK_VALUES.indexOf(rank) : RANK_VALUES.length);
  return Object.fromEntries([...counts].sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b)));
}

/** Whether the feature PR merged carrying the override label; a finding when it did. */
export function overrideFacts({ pr, config }) {
  const label = config.labels.outboxGo;
  const mergedUnder = (pr.labels ?? []).includes(label);
  const findings = mergedUnder
    ? [
        {
          id: `override:#${pr.number}`,
          kind: 'override',
          title: 'The feature PR merged under the override label',
          happened: `Feature PR #${pr.number} merged carrying \`${label}\`, the label that lets a merge through while the outbox gate is red.`,
          evidence: withUrls([{ label: `#${pr.number}`, url: pr.url }]),
        },
      ]
    : [];
  return { facts: { label, mergedUnder }, findings };
}

// ---- territory ----------------------------------------------------------------------------------

/** Each merged sub-PR's changed paths against its slice's territory; a finding per slice that breached it. */
export function territoryFacts({ prd, config, subs, read }) {
  const counts = { graded: 0, breaches: 0, shared: 0, unread: 0, unplanned: 0 };
  const ungraded = (reason) => ({ facts: { reason, sharedGround: [], counts, pulls: [] }, findings: [] });
  if (typeof prd.plan !== 'string') return ungraded('no plan at the merge');
  let slices;
  try {
    slices = parsePlanSlices(prd.plan);
  } catch (error) {
    return ungraded(firstClause(error.message));
  }

  const sharedGround = [...new Set(collisions(slices).flatMap((pair) => pair.shared))];
  const ownOutbox = [`${outboxFolder(prd, config)}/`, `${prd.folder}/outbox/`];

  const pulls = mergedSlicePulls(subs).map(({ pull, slice }) => {
    const base = { slice, pr: pull.number, url: pull.url };
    const files = read[pull.number]?.files ?? null;
    if (files === null) return { ...base, status: 'unread', files: null, breaches: null, shared: null };
    const paths = [...new Set(files)];
    const planned = slices.find((candidate) => candidate.id === slice);
    if (!planned) return { ...base, status: 'unplanned', files: paths.length, breaches: null, shared: null };
    const off = breaches(paths, [...planned.territory, ...ownOutbox]);
    return {
      ...base,
      status: 'graded',
      files: paths.length,
      breaches: off.filter((path) => !covers(sharedGround, path)),
      shared: off.filter((path) => covers(sharedGround, path)),
    };
  });

  for (const pull of pulls) {
    if (pull.status === 'graded') {
      counts.graded += 1;
      counts.breaches += pull.breaches.length;
      counts.shared += pull.shared.length;
    } else counts[pull.status] += 1;
  }

  const bySlice = groupBy(
    pulls.filter((pull) => pull.status === 'graded' && pull.breaches.length > 0),
    (pull) => pull.slice,
  );
  const findings = [...bySlice].map(([slice, own]) => {
    const paths = [...new Set(own.flatMap((pull) => pull.breaches))];
    return {
      id: `territory:${slice}`,
      kind: 'territory',
      title: `Slice ${slice} changed files outside its territory`,
      happened: `Slice ${slice} changed ${plural(paths.length, 'path')} outside its territory and off the plan’s shared ground: ${paths.map(code).join(', ')}.`,
      evidence: withUrls(own.map((pull) => ({ label: `#${pull.pr}`, url: pull.url ? `${pull.url}/files` : null }))),
    };
  });

  return { facts: { reason: null, sharedGround, counts, pulls }, findings };
}

/** "No slice table was found in this plan; its slices…" → "no slice table was found in this plan". */
function firstClause(message) {
  const clause = String(message).split(/;|\.(\s|$)/)[0].trim();
  return clause.charAt(0).toLowerCase() + clause.slice(1);
}

// ---- friction -----------------------------------------------------------------------------------

/** Per slice: its claims, its stuck comments and when needs-fix was added; a finding per stuck or needs-fix slice. */
export function frictionFacts({ subs, read, config }) {
  const label = config.labels.needsFix;
  const counts = { stuck: 0, needsFix: 0, reclaimed: 0, commentsUnread: 0, eventsUnread: 0 };
  const urls = new Map(subs.map(({ pull }) => [pull.number, pull.url]));
  const slices = new Map();

  for (const { pull, slice } of subs) {
    if (!slices.has(slice)) slices.set(slice, { slice, prs: [], claims: 0, stuck: [], needsFix: [] });
    const entry = slices.get(slice);
    entry.prs.push(pull.number);
    entry.claims += 1;

    const records = read[pull.number] ?? {};
    const stuck = records.stuck ?? null;
    if (stuck === null) counts.commentsUnread += 1;
    else entry.stuck.push(...stuck.map((comment) => ({ pr: pull.number, ...comment })));

    const added = records.needsFix ?? null;
    if (added === null) counts.eventsUnread += 1;
    if (added && added.length > 0) entry.needsFix.push(...added.map((at) => ({ pr: pull.number, at })));
    else if (pull.labels?.includes(label)) entry.needsFix.push({ pr: pull.number, at: null });
  }

  const all = [...slices.values()];
  counts.stuck = all.filter((entry) => entry.stuck.length > 0).length;
  counts.needsFix = all.filter((entry) => entry.needsFix.length > 0).length;
  counts.reclaimed = all.filter((entry) => entry.claims > 1).length;

  const findings = all
    .filter((entry) => entry.stuck.length > 0 || entry.needsFix.length > 0)
    .map((entry) => {
      const parts = [];
      if (entry.needsFix.length > 0) parts.push(`was labelled \`${label}\``);
      if (entry.stuck.length === 1) parts.push(`went stuck after ${plural(entry.stuck[0].attempts, 'attempt')}`);
      if (entry.stuck.length > 1) parts.push(`went stuck ${entry.stuck.length} times`);
      if (entry.claims > 1) parts.push(`was claimed ${entry.claims} times`);
      const evidence = [
        ...entry.stuck.map((comment) => ({ label: `stuck comment on #${comment.pr}`, url: comment.url })),
        ...entry.needsFix.map(({ pr }) => ({ label: `#${pr}`, url: urls.get(pr) })),
        ...(entry.claims > 1 ? entry.prs.map((pr) => ({ label: `#${pr}`, url: urls.get(pr) })) : []),
      ];
      return {
        id: `friction:${entry.slice}`,
        kind: 'friction',
        title: entry.stuck.length > 0 ? `Slice ${entry.slice} went stuck` : `Slice ${entry.slice} needed a fix`,
        happened: `Slice ${entry.slice} ${joinAnd(parts)}.`,
        evidence: withUrls(evidence),
      };
    });

  return { facts: { label, counts, slices: all }, findings };
}

// ---- review -------------------------------------------------------------------------------------

/** The feature PR's and each merged sub-PR's reviews and threads; a finding per pull request left with a red circle or an open thread. */
export function reviewFacts({ pr, subs, read }) {
  const targets = [
    { pr: pr.number, slice: null, url: pr.url },
    ...mergedSlicePulls(subs).map(({ pull, slice }) => ({ pr: pull.number, slice, url: pull.url })),
  ];
  const counts = {
    pulls: targets.length,
    reviews: 0,
    reviewsByPeople: 0,
    reviewsByBots: 0,
    threads: 0,
    threadsByPeople: 0,
    threadsByBots: 0,
    red: 0,
    unresolved: 0,
    reviewsUnread: 0,
    threadsUnread: 0,
  };

  const pulls = targets.map((target) => {
    const reviews = read[target.pr]?.reviews ?? null;
    const threads = read[target.pr]?.threads ?? null;
    if (reviews === null) counts.reviewsUnread += 1;
    if (threads === null) counts.threadsUnread += 1;
    const red = [
      ...(reviews ?? [])
        .filter((review) => review.bot && review.red)
        .map((review) => ({ url: review.url, author: review.author, path: null, resolved: null, text: review.text })),
      ...(threads ?? [])
        .filter((thread) => thread.bot && thread.red)
        .map((thread) => ({ url: thread.url, author: thread.author, path: thread.path, resolved: thread.resolved, text: thread.text })),
    ];
    const unresolved = (threads ?? [])
      .filter((thread) => !thread.resolved)
      .map((thread) => ({ url: thread.url, author: thread.author, bot: thread.bot, path: thread.path, outdated: thread.outdated }));

    const reviewsBy = reviews && byAuthorKind(reviews);
    const threadsBy = threads && byAuthorKind(threads);
    if (reviewsBy) {
      counts.reviews += reviews.length;
      counts.reviewsByPeople += reviewsBy.people;
      counts.reviewsByBots += reviewsBy.bots;
    }
    if (threadsBy) {
      counts.threads += threads.length;
      counts.threadsByPeople += threadsBy.people;
      counts.threadsByBots += threadsBy.bots;
    }
    counts.red += red.length;
    counts.unresolved += unresolved.length;
    return { ...target, reviews: reviewsBy, threads: threadsBy, red, unresolved };
  });

  const findings = pulls
    .filter((pull) => pull.red.length > 0 || pull.unresolved.length > 0)
    .map((pull) => {
      const where = pull.slice ? `slice ${pull.slice}` : 'the feature PR';
      const parts = [];
      if (pull.red.length > 0) parts.push(`${plural(pull.red.length, 'red-circle finding')} from ${pull.red.length === 1 ? 'a bot' : 'bots'}`);
      if (pull.unresolved.length > 0) parts.push(`${plural(pull.unresolved.length, 'review thread')} unresolved at the merge`);
      const evidence = [
        ...pull.red.map((item) => ({ label: item.path ? `red circle on ${item.path}` : 'red circle in a review', url: item.url })),
        ...pull.unresolved.map((item) => ({ label: item.path ? `unresolved thread on ${item.path}` : 'unresolved thread', url: item.url })),
      ];
      return {
        id: `review:#${pull.pr}`,
        kind: 'review',
        title: `Review findings on ${where}`,
        happened: `#${pull.pr}, ${where}: ${parts.join('; ')}.`,
        evidence: withUrls(evidence),
      };
    });

  return { facts: { counts, pulls }, findings };
}

function byAuthorKind(items) {
  const bots = items.filter((item) => item.bot).length;
  return { people: items.length - bots, bots };
}

// ---- words --------------------------------------------------------------------------------------

/** "1 path", "2 paths". */
export function plural(count, word) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

/** "a", "a and b", "a, b and c". */
function joinAnd(parts) {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

function code(path) {
  return `\`${path}\``;
}

function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

/** Evidence with a link, each link once. */
function withUrls(evidence) {
  const seen = new Set();
  return evidence.filter((item) => item.url && !seen.has(item.url) && seen.add(item.url));
}

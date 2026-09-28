// The repository's overview, from the facts `facts.mjs` read: which stage each PRD is in, the
// counts, and the bar's numbers. Pure: no git, no clock, no config.
//
// Each PRD is counted once, in the first stage that holds it:
//
// - shipped: its folder is in the base's shipped folder;
// - outbox: its folder is in the base's inbox folder, and its feature branch is built or holds at
//   least one open item;
// - inbox: its folder is in the base's inbox folder, and it is not in the outbox;
// - in review: a phase-0 branch holds an inbox folder of its topic whose PRD number is in neither
//   folder of the base. It is counted, but kept out of the bar.
import { ACCOUNTS_DIR } from '../outbox/account.mjs';
import { SETTLED_FILE } from '../outbox/outbox.mjs';

/** The bar's width, in cells. */
export const BAR_CELLS = 30;

/** Each PRD number once, newest first, leaving out the numbers in `taken`. */
function stage(folders, taken = new Set()) {
  const seen = new Set(taken);
  const out = [];
  for (const folder of [...folders].sort((a, b) => b.prd - a.prd)) {
    if (seen.has(folder.prd)) continue;
    seen.add(folder.prd);
    out.push({ prd: folder.prd, topic: folder.topic });
  }
  return out;
}

/** Delivered against the total, the percentage and the filled cells both rounded down, so the bar
 * never reads 100% while anything is in progress. No PRD at all has no percentage. */
function barFor(delivered, total) {
  if (total === 0) return { delivered, total, percent: null, filled: 0 };
  return {
    delivered,
    total,
    percent: Math.floor((delivered * 100) / total),
    filled: Math.floor((delivered * BAR_CELLS) / total),
  };
}

/** Whether a file under a PRD's outbox folder, named relative to it, is an open item: the rule
 * `outboxItemFiles` applies — a `.md` file, not the settled ledger, and nothing under an accounts
 * folder, at any depth. */
export function isOpenItem(path) {
  const parts = path.split('/');
  const file = parts.pop();
  return file.endsWith('.md') && file !== SETTLED_FILE && !parts.includes(ACCOUNTS_DIR);
}

/** Built: some path outside the delivery folder the branch changed since it forked from the base
 * still differs from the base. A phase-0 copy, byte-identical to the base once merged, never is. */
function isBuilt({ forked, differs }) {
  const now = new Set(differs);
  return forked.some((path) => now.has(path));
}

/** The inbox PRDs whose feature branch is built or holds an open item, as `{ prd, topic,
 * openItems }`, newest first. A feature branch counts only for a PRD in the base's inbox. */
function outboxOf(inbox, features) {
  const out = [];
  for (const { prd, topic } of inbox) {
    const mine = features.filter((feature) => feature.topic === topic);
    if (mine.length === 0) continue;
    const openItems = mine.reduce((sum, feature) => sum + feature.outbox.filter(isOpenItem).length, 0);
    if (openItems > 0 || mine.some(isBuilt)) out.push({ prd, topic, openItems });
  }
  return out;
}

/** The inbox folders phase-0 branches hold, each of its branch's own topic, whose PRD number is
 * not in `taken`: each PRD once, newest first. */
function inReviewOf(phase0, taken) {
  const held = phase0.flatMap(({ topic, inbox }) => inbox.filter((folder) => folder.topic === topic));
  return stage(held, taken);
}

/**
 * @param {{ slug: string | null, base: string, fetchedAt: number | null,
 *   shipped: { prd: number, topic: string }[], inbox: { prd: number, topic: string }[],
 *   features: { branch: string, topic: string, forked: string[], differs: string[], outbox: string[] }[],
 *   phase0: { branch: string, topic: string, inbox: { prd: number, topic: string }[] }[] }} facts
 */
export function overviewFor(facts) {
  const shipped = stage(facts.shipped);
  const onBase = stage(facts.inbox, new Set(shipped.map(({ prd }) => prd)));
  const outbox = outboxOf(onBase, facts.features);
  const inOutbox = new Set(outbox.map(({ prd }) => prd));
  const inbox = onBase.filter(({ prd }) => !inOutbox.has(prd));
  const inReview = inReviewOf(facts.phase0, new Set([...facts.shipped, ...facts.inbox].map(({ prd }) => prd)));
  const inProgress = inbox.length + outbox.length;
  return {
    slug: facts.slug,
    base: facts.base,
    fetchedAt: facts.fetchedAt,
    stages: { shipped, outbox, inbox, inReview },
    counts: {
      shipped: shipped.length,
      inbox: inbox.length,
      outbox: outbox.length,
      openItems: outbox.reduce((sum, { openItems }) => sum + openItems, 0),
      inReview: inReview.length,
    },
    bar: barFor(shipped.length, shipped.length + inProgress),
    inProgress: { total: inProgress, inbox: inbox.length, outbox: outbox.length },
  };
}

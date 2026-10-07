// The repository's overview, from the facts `facts.mjs` read: which stage each PRD is in, the
// counts, and the bar's numbers. Pure: no git, no clock, no config.
//
// Each PRD is counted once, in the first stage that holds it, on the seven stages of the loop
// (PRD 587; idea is a draft on the Omni app, which the repository cannot show):
//
// - retro: its folder is in the base's shipped folder and holds the retro file;
// - shipped: its folder is in the base's shipped folder;
// - outbox: its folder is in the base's inbox folder, and its feature branch moved it to the shipped
//   folder: the green gate ran `omni ship`, so the feature PR is ready and waits for a person;
// - building: its folder is in the base's inbox folder, and its feature branch is built (a sub-PR is
//   merged into it) or holds at least one open item (the red gate keeps a draft here);
// - inbox: its folder is in the base's inbox folder, and it is neither building nor in the outbox;
// - PRD: a phase-0 branch holds an inbox folder of its topic whose PRD number is in neither folder
//   of the base. It is counted, but kept out of the bar.
//
// A PRD of several landings has a branch per landing (`branches.landing`): each counts as one of its
// feature branches, and a PRD building or in the outbox then carries its landings in order, each
// `merged` (its branch is gone while a later one is there, or all it changed is in the base), `open`
// (built, or shipping), or `not started`, and the landing each waits for when the one before it is not
// merged. Git cannot tell a draft from a ready pull request: `omni board <n>` reads those.
//
// A PRD is yours when a commit authored with `user.email` (compared ignoring case) touched its
// folder, on the base or on a feature or phase-0 branch read, or sits on its feature branch beyond
// the base.
import { ACCOUNTS_DIR } from '../outbox/account.ts';
import { SETTLED_FILE } from '../outbox/outbox.ts';
import type { PrdNumber } from '../ids.ts';
import type { RulesCount } from './facts.ts';

/** The bar's width, in cells. */
export const BAR_CELLS = 30;

/** A PRD in a stage: its number and its folder's topic. */
export type StagedPrd = { prd: PrdNumber; topic: string };

/** One landing of a PRD, as the overview reads it from git. */
export type LandingStatus = { landing: number; landings: number; name: string; state: 'merged' | 'open' | 'not started'; waitsFor: number | null };

/** A PRD past the inbox: building or in the outbox, with its feature branches' open items, and its
 * landings when it has more than one. */
export type BuildingPrd = StagedPrd & { openItems: number; landings?: LandingStatus[] };

/** A PRD folder an author's commits touched. */
type Touched = { prd: PrdNumber; email: string };

/** A feature branch, as the facts read it. */
type FeatureBranch = {
  branch: string;
  topic: string;
  landing?: { landing: number; landings: number; name: string };
  forked: string[];
  differs: string[];
  outbox: string[];
  ships: boolean;
  authors: string[];
  touched: Touched[];
};

/** A phase-0 branch, as the facts read it. */
type Phase0Branch = { branch: string; topic: string; inbox: StagedPrd[]; touched: Touched[] };

/** What {@link overviewFor} reads: the facts `readFacts` returns (`kit/lib/status/facts.ts`). */
export type OverviewFacts = {
  slug: string | null;
  base: string;
  fetchedAt: number | null;
  email: string | null;
  shallow: boolean;
  shipped: StagedPrd[];
  retro: number[];
  inbox: StagedPrd[];
  touched: Touched[];
  features: FeatureBranch[];
  phase0: Phase0Branch[];
  rules: RulesCount | null;
};


/** Every stage the repository can show, each PRD once and newest first. */
export type Stages = {
  prd: StagedPrd[];
  inbox: StagedPrd[];
  building: BuildingPrd[];
  outbox: BuildingPrd[];
  shipped: StagedPrd[];
  retro: StagedPrd[];
};

/** How many PRDs each stage holds, and the open items of those building. */
export type Counts = Record<keyof Stages, number> & { openItems: number };

/** The bar's numbers: `percent` is `null` with no PRD at all. */
export type Bar = { delivered: number; total: number; percent: number | null; filled: number };

/** One row of yours: a PRD in progress or at PRD, with its stage. */
export type YourRow = StagedPrd & { stage: 'outbox' | 'building' | 'inbox' | 'prd'; openItems?: number; landings?: LandingStatus[] };

/** Your PRDs, or why the overview cannot tell which they are. */
export type Yours = { state: 'no-email' | 'shallow' | 'known'; email: string | null; rows: YourRow[]; shipped: StagedPrd[] };

/** The overview {@link overviewFor} returns. */
export type Overview = {
  slug: string | null;
  base: string;
  fetchedAt: number | null;
  stages: Stages;
  counts: Counts;
  bar: Bar;
  inProgress: { total: number; inbox: number; building: number; outbox: number };
  yours: Yours;
  rules: RulesCount | null;
};

/** Each PRD number once, newest first, leaving out the numbers in `taken`. */
function stage(folders: readonly StagedPrd[], taken: ReadonlySet<number> = new Set()): StagedPrd[] {
  const seen = new Set(taken);
  const out: StagedPrd[] = [];
  for (const folder of [...folders].sort((a, b) => b.prd - a.prd)) {
    if (seen.has(folder.prd)) continue;
    seen.add(folder.prd);
    out.push({ prd: folder.prd, topic: folder.topic });
  }
  return out;
}

/** Delivered against the total, the percentage and the filled cells both rounded down, so the bar
 * never reads 100% while anything is in progress. No PRD at all has no percentage. */
function barFor(delivered: number, total: number): Bar {
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
export function isOpenItem(path: string): boolean {
  const parts = path.split('/');
  // A split always holds at least one part.
  const file = parts.pop() ?? '';
  return file.endsWith('.md') && file !== SETTLED_FILE && !parts.includes(ACCOUNTS_DIR);
}

/** Built: some path outside the delivery folder the branch changed since it forked from the base
 * still differs from the base. A phase-0 copy, byte-identical to the base once merged, never is. */
function isBuilt({ forked, differs }: Pick<FeatureBranch, 'forked' | 'differs'>): boolean {
  const now = new Set(differs);
  return forked.some((path) => now.has(path));
}

/** The inbox PRDs past the inbox, as `{ building, outbox }`, each `{ prd, topic, openItems }` and
 * newest first: in the outbox when a feature branch ships its folder, else building when one is
 * built or holds an open item. A feature branch counts only for a PRD in the base's inbox. */
function buildingAndOutboxOf(inbox: readonly StagedPrd[], features: readonly FeatureBranch[]): { building: BuildingPrd[]; outbox: BuildingPrd[] } {
  const out: { building: BuildingPrd[]; outbox: BuildingPrd[] } = { building: [], outbox: [] };
  for (const { prd, topic } of inbox) {
    const mine = features.filter((feature) => feature.topic === topic);
    if (mine.length === 0) continue;
    const openItems = mine.reduce((sum, feature) => sum + feature.outbox.filter(isOpenItem).length, 0);
    const landings = landingsOf(mine);
    const entry = { prd, topic, openItems, ...(landings ? { landings } : {}) };
    if (mine.some((feature) => feature.ships)) out.outbox.push(entry);
    else if (openItems > 0 || mine.some(isBuilt)) out.building.push(entry);
  }
  return out;
}

/** A PRD's landings in order, from its landing branches, or `undefined` when it has none. */
function landingsOf(features: readonly FeatureBranch[]): LandingStatus[] | undefined {
  const landed = features.filter((feature) => feature.landing !== undefined);
  if (landed.length === 0) return undefined;
  const count = Math.max(...landed.map((feature) => feature.landing?.landings ?? 0));
  const statuses: LandingStatus[] = [];
  for (let landing = 1; landing <= count; landing += 1) {
    const own = landed.find((feature) => feature.landing?.landing === landing);
    const later = landed.some((feature) => (feature.landing?.landing ?? 0) > landing);
    const before = statuses.at(-1);
    statuses.push({
      landing,
      landings: count,
      name: own?.landing?.name ?? `landing-${landing}`,
      state: landingState(own, later),
      waitsFor: before !== undefined && before.state !== 'merged' ? before.landing : null,
    });
  }
  return statuses;
}

/** One landing's state from its branch: gone while a later landing's is there, it was merged (its
 * branch deleted with it); open while built or shipping; merged once all it changed is in the base;
 * not started otherwise. */
function landingState(own: FeatureBranch | undefined, later: boolean): LandingStatus['state'] {
  if (own === undefined) return later ? 'merged' : 'not started';
  if (own.ships || isBuilt(own)) return 'open';
  return own.forked.length > 0 ? 'merged' : 'not started';
}

/** The inbox folders phase-0 branches hold, each of its branch's own topic, whose PRD number is
 * not in `taken`: each PRD once, newest first. */
function prdOf(phase0: readonly Phase0Branch[], taken: ReadonlySet<number>): StagedPrd[] {
  const held = phase0.flatMap(({ topic, inbox }) => inbox.filter((folder) => folder.topic === topic));
  return stage(held, taken);
}

/** The PRD numbers that are yours: those whose folder a commit of `me` touched, on the base or on a
 * feature or phase-0 branch, and the inbox PRD of each feature branch carrying a commit of `me`. */
function yourNumbers(facts: OverviewFacts, onBase: readonly StagedPrd[], me: string): Set<number> {
  const isMe = (email: string): boolean => email.toLowerCase() === me;
  const touched = [facts.touched, ...facts.features.map(({ touched }) => touched), ...facts.phase0.map(({ touched }) => touched)].flat();
  const mine = new Set(touched.filter(({ email }) => isMe(email)).map(({ prd }) => prd));
  const helped = new Set(facts.features.filter(({ authors }) => authors.some(isMe)).map(({ topic }) => topic));
  for (const { prd, topic } of onBase) if (helped.has(topic)) mine.add(prd);
  return mine;
}

/** Your PRDs, as `{ state, email, rows, shipped }`: `state` is `no-email` without a `user.email`,
 * `shallow` in a shallow clone, whose history cannot tell, and `known` otherwise. `rows` are your
 * PRDs in the outbox, then building, then the inbox, then PRD, each newest first and each with its
 * `stage`; `shipped` your delivered PRDs (shipped or retro), newest first. */
function yoursOf(facts: OverviewFacts, stages: Stages, onBase: readonly StagedPrd[]): Yours {
  const none: Omit<Yours, 'state'> = { email: facts.email ?? null, rows: [], shipped: [] };
  if (!facts.email) return { state: 'no-email', ...none };
  if (facts.shallow) return { state: 'shallow', ...none };
  const mine = yourNumbers(facts, onBase, facts.email.toLowerCase());
  const yours = <T extends StagedPrd>(entries: readonly T[]): T[] => entries.filter(({ prd }) => mine.has(prd));
  const order: YourRow['stage'][] = ['outbox', 'building', 'inbox', 'prd'];
  const rows = order.flatMap((stage): YourRow[] => yours<StagedPrd & { openItems?: number; landings?: LandingStatus[] }>(stages[stage]).map((entry) => ({ stage, ...entry })));
  const delivered = [...stages.shipped, ...stages.retro].sort((a, b) => b.prd - a.prd);
  return { state: 'known', email: facts.email, rows, shipped: yours(delivered) };
}

/** The overview of the repository `facts` describe: its stages, counts, bar and your PRDs. */
export function overviewFor(facts: OverviewFacts): Overview {
  const delivered = stage(facts.shipped);
  const withRetro = new Set(facts.retro);
  const retro = delivered.filter(({ prd }) => withRetro.has(prd));
  const shipped = delivered.filter(({ prd }) => !withRetro.has(prd));
  const onBase = stage(facts.inbox, new Set(delivered.map(({ prd }) => prd)));
  const { building, outbox } = buildingAndOutboxOf(onBase, facts.features);
  const past = new Set([...building, ...outbox].map(({ prd }) => prd));
  const inbox = onBase.filter(({ prd }) => !past.has(prd));
  const prd = prdOf(facts.phase0, new Set([...facts.shipped, ...facts.inbox].map((folder) => folder.prd)));
  const inProgress = inbox.length + building.length + outbox.length;
  const stages: Stages = { prd, inbox, building, outbox, shipped, retro };
  return {
    slug: facts.slug,
    base: facts.base,
    fetchedAt: facts.fetchedAt,
    stages,
    counts: {
      prd: prd.length,
      inbox: inbox.length,
      building: building.length,
      openItems: building.reduce((sum, { openItems }) => sum + openItems, 0),
      outbox: outbox.length,
      shipped: shipped.length,
      retro: retro.length,
    },
    bar: barFor(delivered.length, delivered.length + inProgress),
    inProgress: { total: inProgress, inbox: inbox.length, building: building.length, outbox: outbox.length },
    yours: yoursOf(facts, stages, onBase),
    rules: facts.rules,
  };
}

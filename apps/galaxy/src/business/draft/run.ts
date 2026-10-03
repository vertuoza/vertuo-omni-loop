import type { ClaimKind, StoredClaim } from '../model';
import type { Extractor } from './extract';
import { mergeOf, productFor, snapSize, type MergeOutcome } from './merge';
import { fileLabel, fileWhere, pageLabel, repoFiles, repoLabel, type FileKind, type RepoListing } from './sources';
import { MAX_QUOTE, verified, type Candidate } from './verify';
import { firstPart } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// One run of the draft (PRD 774, spec steps 1 to 4), for a draft row already started: for each tracked
// repository of the workspace, the files ./sources.ts picks, read as the Omni Loop App; then each pasted
// web page, read through the safe fetch (./page.ts). Each source goes to the small model once
// (./extract.ts); the candidates whose quote is really there (./verify.ts) are merged with the store
// (./merge.ts, and claim_propose_evidence() in the database, which has the last word). After each
// source the draft row is told what was read or skipped, for the page to show while it runs; at the
// end it is `done` with its counts, or `failed` with why. A source that cannot be read is skipped,
// never a failure; only the store failing fails the run. With no model key nothing is read at all.
//
// The same run serves the weekly recheck (s4), started with kind `recheck`.
//
// Neither proposes a Never line (PRD 871): a candidate of kind `never` is dropped before it is counted
// as kept, whatever the extractor answered, since claim_propose_evidence() refuses the kind.

/** What a draft row says it read, by key (`business_drafts.counts`). */
export interface DraftCounts {
  readmes: number;
  docs: number;
  prds: number;
  pages: number;
  skipped: number;
  /** Candidates the model answered, and those whose quote was found. */
  found: number;
  kept: number;
  added: number;
  seen: number;
  replacing: number;
  rejected: number;
}

/** One source as the page lists it while the draft runs: `✓ vertuo-app · README.md`, `– vertuoza.com/pricing · skipped`. */
export interface Scanned {
  source: string;
  state: 'read' | 'skipped';
  /** Why it was skipped, in plain words. */
  why?: string;
}

export type DraftState = 'running' | 'done' | 'failed';

/** A public.business_drafts row, as PostgREST answers it. */
export interface DraftRow {
  id: string;
  kind: 'draft' | 'recheck';
  state: DraftState;
  started_at: string;
  finished_at: string | null;
  counts: Partial<DraftCounts>;
  scanned: Scanned[];
  reason: string | null;
}

export type Receipt = { kind: 'file' | 'pr' | 'link'; where: string; quote: string };

/** A store call that failed, with the database's code. */
export class DraftStoreError extends Error {
  readonly code: string | undefined;
  constructor(what: string, code: string | undefined, message: string) {
    super(`Could not ${what}: ${message}`);
    this.code = code;
  }
}

/** The calls a draft makes, as the signed-in member (a draft) or the service role (a recheck). */
export interface DraftStore {
  /** The business's running draft, or null. */
  running(workspace: string): Promise<DraftRow | null>;
  /** business_draft_start(): a new draft, or the one running. */
  start(workspace: string, kind: DraftRow['kind']): Promise<DraftRow>;
  progress(workspace: string, draft: string, counts: DraftCounts, scanned: Scanned[]): Promise<void>;
  finish(workspace: string, draft: string, state: 'done' | 'failed', counts: DraftCounts, scanned: Scanned[], reason?: string): Promise<void>;
  /** The workspace's tracked repositories, each with the product it belongs to. */
  repositories(workspace: string): Promise<Array<{ full_name: string; product_id: string | null }>>;
  /** The web pages pasted on the business. */
  webPages(workspace: string): Promise<string[]>;
  /** The business's first product, or null when it has none. */
  firstProduct(workspace: string): Promise<string | null>;
  /** Every claim of the business, in any state. */
  claims(workspace: string): Promise<StoredClaim[]>;
  /** claim_propose_evidence(): decision 9's merge for one verified candidate. */
  propose(workspace: string, product: string | null, kind: ClaimKind, value: string, receipts: Receipt[]): Promise<MergeOutcome>;
}

export interface DraftDeps {
  store: DraftStore;
  /** The installation the workspace owns, or null when the App is not installed. */
  installation(workspace: string): Promise<number | null>;
  github: {
    listing(installation: number, repository: string): Promise<RepoListing>;
    file(installation: number, repository: string, path: string): Promise<string | null>;
  };
  /** A pasted page's text, read safely; throws a refusal in plain words. */
  page(url: string): Promise<string>;
  /** The small model, or null when OPENROUTER_API_KEY is unset. */
  extract: Extractor | null;
  log(line: string): void;
}

const COUNTED: Record<FileKind, 'readmes' | 'docs' | 'prds'> = { readme: 'readmes', doc: 'docs', prd: 'prds' };
/** The most receipts one candidate carries into the store. */
const MAX_RECEIPTS = 20;

const zero = (): DraftCounts => ({ readmes: 0, docs: 0, prds: 0, pages: 0, skipped: 0, found: 0, kept: 0, added: 0, seen: 0, replacing: 0, rejected: 0 });

const plainError = (error: unknown) => firstPart(error instanceof Error ? error.message : String(error), '\n').slice(0, 300);

/** A source's candidates grouped by claim: one value of one kind, with every quote that says it. */
function grouped(candidates: readonly Candidate[]): Array<{ kind: ClaimKind; value: string; quotes: string[] }> {
  const groups = new Map<string, { kind: ClaimKind; value: string; quotes: string[] }>();
  for (const c of candidates) {
    const value = c.kind === 'size' ? snapSize(c.value) : c.value.trim();
    if (!value) continue;
    const key = `${c.kind} ${value.toLowerCase()}`;
    const group = groups.get(key) ?? { kind: c.kind, value, quotes: [] };
    const quote = c.quote.trim().slice(0, MAX_QUOTE);
    if (!group.quotes.includes(quote) && group.quotes.length < MAX_RECEIPTS) group.quotes.push(quote);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** One run under way: what it reads with, and what it has counted and scanned so far. */
interface Run {
  deps: DraftDeps;
  workspace: string;
  draft: string;
  counts: DraftCounts;
  scanned: Scanned[];
  /** Every claim of the business, with the ones this run proposed. */
  held: StoredClaim[];
}

type Group = ReturnType<typeof grouped>[number];

/** claim_propose_evidence() for one group; null when the store refuses the value itself (22023). */
async function proposed(run: Run, on: string | null, group: Group, where: string, kind: Receipt['kind']): Promise<MergeOutcome | null> {
  try {
    return await run.deps.store.propose(run.workspace, on, group.kind, group.value, group.quotes.map((quote) => ({ kind, where, quote })));
  } catch (error) {
    if (error instanceof DraftStoreError && error.code === '22023') return null;
    throw error;
  }
}

/** What the run now holds once `outcome` is stored: a new proposed claim, and the one it replaces contradicted. */
function hold(held: StoredClaim[], group: Group, on: string | null, outcome: MergeOutcome, replaces: string | null) {
  if (outcome === 'added' || outcome === 'replacing') {
    held.push({ id: `new-${held.length}`, seq: Number.MAX_SAFE_INTEGER, kind: group.kind, value: group.value, source: 'evidence', state: 'proposed', product_id: on });
  }
  if (outcome !== 'replacing' || !replaces) return;
  const old = held.find((c) => c.id === replaces);
  if (old) old.state = 'contradicted';
}

/** Merges one group of a source's candidates into the store. */
async function mergeGroup(run: Run, group: Group, where: string, kind: Receipt['kind'], product: string | null) {
  const on = productFor(group.kind, product);
  if (group.kind !== 'region' && on === null) return;
  const merged = mergeOf(run.held, group.kind, group.value, on);
  if (merged.outcome === 'rejected') {
    run.counts.rejected += 1;
    return;
  }
  const outcome = await proposed(run, on, group, where, kind);
  if (outcome === null) return;
  run.counts[outcome] += 1;
  hold(run.held, group, on, outcome, merged.replaces);
}

/** Reads one source's candidates into the store. */
async function merge(run: Run, extract: Extractor, text: string, where: string, kind: Receipt['kind'], product: string | null) {
  const answered = await extract(text, where);
  const kept = verified(text, answered).filter((c) => c.kind !== 'never');
  run.counts.found += answered.length;
  run.counts.kept += kept.length;
  for (const group of grouped(kept)) await mergeGroup(run, group, where, kind, product);
}

/** Reads one source; it is scanned as read, or skipped with why. Only the store failing throws. */
async function read(run: Run, label: string, work: () => Promise<boolean>) {
  let ok = false;
  let why: string | undefined;
  try {
    ok = await work();
    if (!ok) why = 'nothing there';
  } catch (error) {
    if (error instanceof DraftStoreError) throw error;
    why = plainError(error);
  }
  if (!ok) run.counts.skipped += 1;
  run.scanned.push(ok ? { source: label, state: 'read' } : { source: label, state: 'skipped', ...(why === undefined ? {} : { why }) });
  await run.deps.store.progress(run.workspace, run.draft, run.counts, run.scanned);
}

/** Reads the files ./sources.ts picks in one repository, or skips it when it cannot be listed. */
async function readRepo(run: Run, extract: Extractor, installation: number | null, repo: { full_name: string; product_id: string | null }, first: string | null) {
  const name = repo.full_name;
  if (installation === null) {
    await read(run, repoLabel(name), () => { throw new Error('The Omni Loop App is not installed here.'); });
    return;
  }
  let listing: RepoListing;
  try {
    listing = await run.deps.github.listing(installation, name);
  } catch (error) {
    await read(run, repoLabel(name), () => { throw error; });
    return;
  }
  for (const file of repoFiles(listing)) {
    await read(run, fileLabel(name, file.path), async () => {
      const text = await run.deps.github.file(installation, name, file.path);
      if (text === null || !text.trim()) return false;
      run.counts[COUNTED[file.kind]] += 1;
      await merge(run, extract, text, fileWhere(name, file.path), 'file', repo.product_id ?? first);
      return true;
    });
  }
}

/** Reads one pasted web page. */
async function readPage(run: Run, extract: Extractor, url: string, first: string | null) {
  await read(run, pageLabel(url), async () => {
    const text = await run.deps.page(url);
    if (!text.trim()) return false;
    run.counts.pages += 1;
    await merge(run, extract, text, url, 'link', first);
    return true;
  });
}

/** Reads every source of the business with `extract`. */
async function readAll(run: Run, extract: Extractor) {
  const { store } = run.deps;
  const [repositories, pages, first, held] = await Promise.all([
    store.repositories(run.workspace), store.webPages(run.workspace), store.firstProduct(run.workspace), store.claims(run.workspace),
  ]);
  run.held = held;
  const installation = repositories.length ? await run.deps.installation(run.workspace) : null;
  for (const repo of repositories) await readRepo(run, extract, installation, repo, first);
  for (const url of pages) await readPage(run, extract, url, first);
}

/** Runs draft `draft` of `workspace` to its end; never throws. */
export async function runDraft(deps: DraftDeps, workspace: string, draft: string): Promise<void> {
  const { store } = deps;
  const run: Run = { deps, workspace, draft, counts: zero(), scanned: [], held: [] };
  const failed = async (why: string) => {
    await store.finish(workspace, draft, 'failed', run.counts, run.scanned, why).catch((error: unknown) => { deps.log(`business draft: ${draft} could not be marked failed — ${plainError(error)}`); });
  };

  try {
    // With no model key nothing is read at all.
    if (deps.extract) await readAll(run, deps.extract);
    await store.finish(workspace, draft, 'done', run.counts, run.scanned);
  } catch (error) {
    deps.log(`business draft: ${draft} failed — ${plainError(error)}`);
    await failed('The business database could not answer. Try again.');
  }
}

import type { ClaimKind, StoredClaim } from '../model';
import type { Extractor } from './extract';
import { mergeOf, productFor, snapSize, type MergeOutcome } from './merge';
import { fileLabel, fileWhere, pageLabel, repoFiles, repoLabel, type FileKind, type RepoListing } from './sources';
import { MAX_QUOTE, verified, type Candidate } from './verify';

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
  constructor(what: string, readonly code: string | undefined, message: string) {
    super(`Could not ${what}: ${message}`);
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

const plainError = (error: unknown) => (error instanceof Error ? error.message : String(error)).split('\n')[0].slice(0, 300);

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

/** Runs draft `draft` of `workspace` to its end; never throws. */
export async function runDraft(deps: DraftDeps, workspace: string, draft: string): Promise<void> {
  const { store } = deps;
  const counts = zero();
  const scanned: Scanned[] = [];
  const failed = async (why: string) => {
    await store.finish(workspace, draft, 'failed', counts, scanned, why).catch((error) => deps.log(`business draft: ${draft} could not be marked failed — ${plainError(error)}`));
  };

  try {
    const extract = deps.extract;
    if (!extract) {
      await store.finish(workspace, draft, 'done', counts, scanned);
      return;
    }
    const [repositories, pages, first, held] = await Promise.all([
      store.repositories(workspace), store.webPages(workspace), store.firstProduct(workspace), store.claims(workspace),
    ]);

    /** Reads one source's candidates into the store. */
    const merge = async (text: string, where: string, kind: Receipt['kind'], product: string | null) => {
      const answered = await extract(text, where);
      const kept = verified(text, answered);
      counts.found += answered.length;
      counts.kept += kept.length;
      for (const { kind: claimKind, value, quotes } of grouped(kept)) {
        const on = productFor(claimKind, product);
        if (claimKind !== 'region' && on === null) continue;
        const merged = mergeOf(held, claimKind, value, on);
        if (merged.outcome === 'rejected') {
          counts.rejected += 1;
          continue;
        }
        let outcome: MergeOutcome;
        try {
          outcome = await store.propose(workspace, on, claimKind, value, quotes.map((quote) => ({ kind, where, quote })));
        } catch (error) {
          if (error instanceof DraftStoreError && error.code === '22023') continue;
          throw error;
        }
        counts[outcome] += 1;
        if (outcome === 'added' || outcome === 'replacing') {
          held.push({ id: `new-${held.length}`, seq: Number.MAX_SAFE_INTEGER, kind: claimKind, value, source: 'evidence', state: 'proposed', product_id: on });
        }
        if (outcome === 'replacing' && merged.replaces) {
          const old = held.find((c) => c.id === merged.replaces);
          if (old) old.state = 'contradicted';
        }
      }
    };
    const read = async (label: string, work: () => Promise<boolean>) => {
      let ok = false;
      let why: string | undefined;
      try {
        ok = await work();
        if (!ok) why = 'nothing there';
      } catch (error) {
        if (error instanceof DraftStoreError) throw error;
        why = plainError(error);
      }
      if (!ok) counts.skipped += 1;
      scanned.push(ok ? { source: label, state: 'read' } : { source: label, state: 'skipped', why });
      await store.progress(workspace, draft, counts, scanned);
    };

    const installation = repositories.length ? await deps.installation(workspace) : null;
    for (const repo of repositories) {
      const name = repo.full_name;
      if (installation === null) {
        await read(repoLabel(name), async () => { throw new Error('The Omni Loop App is not installed here.'); });
        continue;
      }
      let listing: RepoListing;
      try {
        listing = await deps.github.listing(installation, name);
      } catch (error) {
        await read(repoLabel(name), async () => { throw error; });
        continue;
      }
      for (const file of repoFiles(listing)) {
        await read(fileLabel(name, file.path), async () => {
          const text = await deps.github.file(installation, name, file.path);
          if (text === null || !text.trim()) return false;
          counts[COUNTED[file.kind]] += 1;
          await merge(text, fileWhere(name, file.path), 'file', repo.product_id ?? first);
          return true;
        });
      }
    }
    for (const url of pages) {
      await read(pageLabel(url), async () => {
        const text = await deps.page(url);
        if (!text.trim()) return false;
        counts.pages += 1;
        await merge(text, url, 'link', first);
        return true;
      });
    }
    await store.finish(workspace, draft, 'done', counts, scanned);
  } catch (error) {
    deps.log(`business draft: ${draft} failed — ${plainError(error)}`);
    await failed('The business database could not answer. Try again.');
  }
}

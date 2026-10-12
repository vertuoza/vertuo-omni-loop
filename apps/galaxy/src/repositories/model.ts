// Settings → Repositories as pure data (PRD 612 s1). A row of public.repositories
// (supabase/migrations/20261008090000_repositories.sql) as the page draws it; the line that says
// when it was last collected; what Add repository offers (what the workspace's Omni App installation
// can see, minus what is listed); which listed repositories the App cannot read; and the page's state
// through its actions. GitHub spells a repository in any case; the list keeps it in lower case, so
// every comparison ignores case. PRD 1299 s1 adds where its phase 0 is approved: a docs-only phase-0
// pull request (`pr`, the default) or the PRD page (`server`), the owner's to switch. PRD 1364 s11
// replaces the one product a repository served with the products that link it (product_repositories),
// read beside the row: the page shows them as chips, and a product's own page changes them.
import { z } from 'zod';

/** Where a repository's phase 0 is approved (PRD 1299): a phase-0 pull request, or the PRD page. */
export const Phase0Schema = z.enum(['pr', 'server']);
export type Phase0 = z.infer<typeof Phase0Schema>;

/** A product a repository is in, as its chip names and links it. */
export interface RepositoryProduct {
  id: string;
  name: string;
}

export interface RepositoryRow {
  /** `owner/name`, in lower case. */
  fullName: string;
  tracked: boolean;
  /** When the collector last finished a collection of it, or null before the first. */
  collectedAt: string | null;
  /** Why the last collection failed, or null when it succeeded. */
  collectError: string | null;
  /** The products that link it (PRD 1364 s11), first first: none, one or several. */
  products: RepositoryProduct[];
  /** Whether its ideas board is public at /ideas/<owner>/<repo> (PRD 1246 s4): any member's to switch. */
  publicIdeas: boolean;
  /** Where its phase 0 is approved (PRD 1299 s1): the owner's to switch. Absent reads as `pr`. */
  phase0?: Phase0 | undefined;
}

/** A public.repositories row, as PostgREST answers it. */
export interface StoredRepository {
  full_name: string;
  tracked: boolean;
  collected_at?: string | null;
  collect_error?: string | null;
  public_ideas?: boolean;
  phase0?: string | null;
}

/** The whole public.repositories row the owner's functions answer (`returns public.repositories`). */
export const SavedRepository = z.strictObject({
  workspace_id: z.string(),
  full_name: z.string(),
  tracked: z.boolean(),
  added_at: z.string(),
  added_by: z.string().nullable(),
  collected_at: z.string().nullable(),
  collected_until: z.string().nullable(),
  collect_error: z.string().nullable(),
  public_ideas: z.boolean(),
  phase0: Phase0Schema,
});

/** A stored row as the page draws it, with the products that link it (none unless given). */
export const repositoryRowOf = (r: StoredRepository, products: RepositoryProduct[] = []): RepositoryRow => ({
  fullName: r.full_name,
  tracked: r.tracked,
  collectedAt: r.collected_at ?? null,
  collectError: r.collect_error ?? null,
  products,
  publicIdeas: r.public_ideas ?? false,
  phase0: r.phase0 === 'server' ? 'server' : 'pr',
});

/** Where the repository's phase 0 is approved, `pr` when its row does not say. */
export const phase0Of = (row: RepositoryRow): Phase0 => row.phase0 ?? 'pr';

const MINUTE = 60_000;

function ago(ms: number): string {
  if (ms < MINUTE) return 'just now';
  if (ms < 60 * MINUTE) return `${Math.floor(ms / MINUTE)} min ago`;
  if (ms < 24 * 60 * MINUTE) return `${Math.floor(ms / (60 * MINUTE))} h ago`;
  return `${Math.floor(ms / (24 * 60 * MINUTE))} d ago`;
}

/** When the repository was last collected, as its row says it. A failure wins: it is retried on the
 * collector's next run. */
export function collectionLabel(row: RepositoryRow, now: number): string {
  if (row.collectError) return 'last collection failed · retrying';
  if (!row.collectedAt) return 'not collected yet';
  return `collected ${ago(Math.max(0, now - Date.parse(row.collectedAt)))}`;
}

const key = (name: string) => name.toLowerCase();
const byName = (a: string, b: string) => key(a).localeCompare(key(b), 'en');

/** What Add repository offers: the repositories the App can see that are not listed yet, by name. */
export function addable(listed: readonly RepositoryRow[], reachable: readonly string[]): string[] {
  const have = new Set(listed.map((r) => key(r.fullName)));
  return reachable.filter((name) => !have.has(key(name))).sort(byName);
}

/** Whether the App's listing leaves the repository out: it cannot read it. Unknown, never, when the
 * listing could not be read. */
export function hasNoAccess(row: RepositoryRow, reachable: readonly string[] | null): boolean {
  if (!reachable) return false;
  return !reachable.some((name) => key(name) === key(row.fullName));
}

// ── The page's state ─────────────────────────────────────────────────────────────

export interface RepositoriesState {
  repositories: RepositoryRow[];
  /** The Add list is open. */
  picking: boolean;
  /** A call is on its way: every control waits. */
  busy: boolean;
  /** What the last call was refused with, or null. */
  refusal: string | null;
}

export type RepositoriesAction =
  | { type: 'pick' }
  | { type: 'close' }
  | { type: 'busy' }
  | { type: 'saved'; repository: RepositoryRow }
  | { type: 'refused'; message: string };

const sorted = (rows: RepositoryRow[]) => [...rows].sort((a, b) => byName(a.fullName, b.fullName));

export const initialState = (repositories: RepositoryRow[]): RepositoriesState =>
  ({ repositories: sorted(repositories), picking: false, busy: false, refusal: null });

export function repositoriesReducer(state: RepositoriesState, action: RepositoriesAction): RepositoriesState {
  switch (action.type) {
    case 'pick':
      return { ...state, picking: true, refusal: null };
    case 'close':
      return { ...state, picking: false, refusal: null };
    case 'busy':
      return { ...state, busy: true, refusal: null };
    case 'saved': {
      // A saved row comes back without its products: a save never changes them, so the listed ones stay.
      const was = state.repositories.find((r) => key(r.fullName) === key(action.repository.fullName));
      const others = state.repositories.filter((r) => r !== was);
      const repository = { ...action.repository, products: was?.products ?? action.repository.products };
      return { ...state, repositories: sorted([...others, repository]), picking: false, busy: false, refusal: null };
    }
    case 'refused':
      return { ...state, busy: false, refusal: action.message };
  }
}

// A workspace's fix facts, refreshed (PRD 691, s1): each fix is read through the reader (PRD 627's
// FixReader, cached 60 s per fix) and what GitHub said is stored in fix_facts (./store.ts), which /bugs
// and /visual read instead of GitHub. A part GitHub could not read (UNREAD) keeps its stored value; a fix
// whose whole read failed, or that the reader could not ask about, keeps its row and is logged; a fix
// whose stored facts hold a release is final and is not read again. The stages sync calls it per
// workspace; a fix's own page stores what it read through `mergeFacts`.
import type { FixSummary } from '../../dossier/github/fix';
import type { FixReader, FixRef } from '../../dossier/github/reader';
import { UNREAD, type Read } from '../../dossier/github/summary';
import type { FixFactsRow, FixFactsStore } from './store';

export type RefreshDeps = {
  reader: FixReader;
  store: FixFactsStore;
  now?: () => string;
  /** Where a failed read is told; console.error by default. */
  log?: (error: unknown) => void;
};

/** What a refresh did: fixes read, stored, left alone as final, and whose read failed. */
export type RefreshResult = { read: number; stored: number; final: number; failed: number };

/** Stored facts that hold a release: the fix shipped, and nothing about it changes any more. */
export const isFinal = (facts: FixSummary | null | undefined): boolean =>
  facts != null && facts.release !== UNREAD && facts.release !== null;

const keep = <T>(fresh: Read<T>, stored: Read<T> | undefined): Read<T> => (fresh === UNREAD && stored !== undefined ? stored : fresh);

/** What `read` says, each part left UNREAD taken from `stored` when there is one. */
export function mergeFacts(stored: FixSummary | null, read: FixSummary): FixSummary {
  return {
    issue: keep(read.issue, stored?.issue),
    pull: keep(read.pull, stored?.pull),
    approvals: keep(read.approvals, stored?.approvals),
    release: keep(read.release, stored?.release),
  };
}

export async function refreshFixFacts(workspace: string, fixes: readonly FixRef[], deps: RefreshDeps): Promise<RefreshResult> {
  const result: RefreshResult = { read: 0, stored: 0, final: 0, failed: 0 };
  if (fixes.length === 0) return result;
  const log = deps.log ?? ((error: unknown) => console.error(error));
  const stored = await deps.store.readFacts(workspace, fixes.map((f) => f.id));

  const rows = await Promise.all(fixes.map(async (fix): Promise<FixFactsRow | null> => {
    const before = stored.get(fix.id) ?? null;
    if (isFinal(before)) {
      result.final += 1;
      return null;
    }
    result.read += 1;
    let read: FixSummary | null;
    try {
      read = await deps.reader.fix(fix);
    } catch (error) {
      log(error);
      read = null;
    }
    if (read === null) {
      result.failed += 1;
      return null;
    }
    return { dossier_id: fix.id, workspace_id: workspace, facts: mergeFacts(before, read) };
  }));

  const fresh = rows.filter((row): row is FixFactsRow => row !== null);
  await deps.store.writeFacts(fresh, deps.now?.());
  result.stored = fresh.length;
  return result;
}

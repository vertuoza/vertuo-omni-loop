// A workspace's fix facts, refreshed (PRD 691, s1): each fix is read through the reader (PRD 627's
// FixReader, cached 60 s per fix) and what GitHub said is stored in fix_facts (./store.ts), which /bugs
// and /visual read instead of GitHub. A part GitHub could not read (UNREAD) keeps its stored value; a fix
// whose whole read failed, or that the reader could not ask about, keeps its row and is logged; a fix
// whose stored facts hold a release is final and is not read again. The stages sync calls it per
// workspace; a fix's own page stores what it read through `mergeFacts`.
//
// PRD 1272 (s4): a concept's facts, {issue, pull}, are refreshed the same way, through the reader's
// ConceptReader; a concept whose stored pull request has merged is final (in the inbox) and is not read
// again.
import type { ConceptFacts, FixSummary } from '../../dossier/github/fix';
import type { ConceptReader, FixReader, FixRef } from '../../dossier/github/reader';
import { UNREAD, type Read } from '../../dossier/github/summary';
import type { ConceptFactsStore, FactsRow, FactsStore, FixFactsStore } from './store';

type Logged = {
  now?: () => string;
  /** Where a failed read is told; console.error by default. */
  log?: (error: unknown) => void;
};

export type RefreshDeps = Logged & { reader: FixReader; store: FixFactsStore };
export type ConceptRefreshDeps = Logged & { reader: ConceptReader; store: ConceptFactsStore };

/** What a refresh did: dossiers read, stored, left alone as final, and whose read failed. */
export type RefreshResult = { read: number; stored: number; final: number; failed: number };

/** Stored facts that hold a release: the fix shipped, and nothing about it changes any more. */
export const isFinal = (facts: FixSummary | null | undefined): boolean =>
  facts != null && facts.release !== UNREAD && facts.release !== null;

/** Stored facts whose concept PR has merged: the concept is in the inbox, and its state changes no more. */
export const isConceptFinal = (facts: ConceptFacts | null | undefined): boolean =>
  facts != null && facts.pull !== UNREAD && facts.pull?.state === 'merged';

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

/** A concept's `read`, each part left UNREAD taken from `stored` when there is one. */
export function mergeConceptFacts(stored: ConceptFacts | null, read: ConceptFacts): ConceptFacts {
  return { issue: keep(read.issue, stored?.issue), pull: keep(read.pull, stored?.pull) };
}

type Refresh<T> = Logged & {
  read: (ref: FixRef) => Promise<T | null>;
  store: FactsStore<T>;
  final: (facts: T | null) => boolean;
  merge: (stored: T | null, read: T) => T;
};

async function refreshFacts<T>(workspace: string, refs: readonly FixRef[], deps: Refresh<T>): Promise<RefreshResult> {
  const result: RefreshResult = { read: 0, stored: 0, final: 0, failed: 0 };
  if (refs.length === 0) return result;
  const log = deps.log ?? ((error: unknown) => { console.error(error); });
  const stored = await deps.store.readFacts(workspace, refs.map((f) => f.id));

  const rows = await Promise.all(refs.map(async (ref): Promise<FactsRow<T> | null> => {
    const before = stored.get(ref.id) ?? null;
    if (deps.final(before)) {
      result.final += 1;
      return null;
    }
    result.read += 1;
    let read: T | null;
    try {
      read = await deps.read(ref);
    } catch (error) {
      log(error);
      read = null;
    }
    if (read === null) {
      result.failed += 1;
      return null;
    }
    return { dossier_id: ref.id, workspace_id: workspace, facts: deps.merge(before, read) };
  }));

  const fresh = rows.filter((row): row is FactsRow<T> => row !== null);
  await deps.store.writeFacts(fresh, deps.now?.());
  result.stored = fresh.length;
  return result;
}

export function refreshFixFacts(workspace: string, fixes: readonly FixRef[], deps: RefreshDeps): Promise<RefreshResult> {
  const { reader, ...rest } = deps;
  return refreshFacts(workspace, fixes, { ...rest, read: (ref) => reader.fix(ref), final: isFinal, merge: mergeFacts });
}

export function refreshConceptFacts(workspace: string, concepts: readonly FixRef[], deps: ConceptRefreshDeps): Promise<RefreshResult> {
  const { reader, ...rest } = deps;
  return refreshFacts(workspace, concepts, { ...rest, read: (ref) => reader.concept(ref), final: isConceptFinal, merge: mergeConceptFacts });
}

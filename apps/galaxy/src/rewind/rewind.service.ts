import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { findingKey, type RewindFinding } from 'omni-loop/kit/lib/rewind/findings.ts';
import type { MainWatchRead } from '../main-watch/store';
import type { FindingView, RewindRefusal } from './rewind.contract';

// The rewind's rules (PRD 2410, s5; ADR-0095): what a member of a PRD's workspace reads of its watch, and
// what the rewind may propose.
//
// - The workspace is the one whose watch the caller can read: a PRD nobody the caller shares a workspace
//   with watches reads as no watch, never as another workspace's (BR-PRODUCT-63).
// - A finding is proposed once: the same check, origin and evidence of a PRD is one finding, whatever
//   became of it, so a rejected one is never proposed again (BR-PRODUCT-12). The first repeat is refused,
//   naming the finding, and nothing of the push is kept.
// - Nothing of a finding is decided here: a decision is the database's function, a member's, on the page.

/** What the service asks of its storage. */
export type RewindPorts = {
  /** The workspace that holds the PRD's watch in `repo`, as the caller reads it; null when none. */
  workspaceOf(repo: string, prd: PrdNumber): Promise<string | null>;
  mainWatch(workspace: string, repo: string, prd: PrdNumber): Promise<MainWatchRead>;
  findings(workspace: string, repo: string, prd: PrdNumber): Promise<FindingView[]>;
  insert(workspace: string, repo: string, prd: PrdNumber, findings: readonly RewindFinding[]): Promise<'ok' | 'duplicate'>;
};

type RewindFacts = MainWatchRead & { findings: FindingView[] };

/** A service answer: its value, or why it was refused, in plain words. */
type Outcome<T> = { ok: true; value: T } | { ok: false; kind: RewindRefusal; error: string };

const refused = (kind: RewindRefusal, error: string): { ok: false; kind: RewindRefusal; error: string } => ({ ok: false, kind, error });

export function rewindService(ports: RewindPorts) {
  return {
    /** The PRD's watch, its breaks and its findings; empty when it holds no watch. */
    async facts(repo: string, prd: PrdNumber): Promise<Outcome<RewindFacts>> {
      const workspace = await ports.workspaceOf(repo, prd);
      if (workspace === null) return { ok: true, value: { watches: [], breaks: [], findings: [] } };
      const [watch, findings] = await Promise.all([ports.mainWatch(workspace, repo, prd), ports.findings(workspace, repo, prd)]);
      return { ok: true, value: { ...watch, findings } };
    },

    /** Proposes `findings` for the PRD, all or none. */
    async propose(repo: string, prd: PrdNumber, findings: readonly RewindFinding[]): Promise<Outcome<{ added: number }>> {
      const workspace = await ports.workspaceOf(repo, prd);
      if (workspace === null) return refused('missing', `PRD ${String(prd)} has no watch on main in ${repo}: there is nothing to rewind.`);
      const known = new Set((await ports.findings(workspace, repo, prd)).map(findingKey));
      const again = findings.findIndex((f) => known.has(findingKey(f)));
      const repeated = findings[again];
      if (repeated) return refused('duplicate', `Finding ${String(again + 1)} (${repeated.check}, ${repeated.origin}) was already proposed for PRD ${String(prd)}.`);
      if ((await ports.insert(workspace, repo, prd, findings)) === 'duplicate') {
        return refused('duplicate', `A finding of this push was already proposed for PRD ${String(prd)}.`);
      }
      return { ok: true, value: { added: findings.length } };
    },
  };
}

export type RewindService = ReturnType<typeof rewindService>;

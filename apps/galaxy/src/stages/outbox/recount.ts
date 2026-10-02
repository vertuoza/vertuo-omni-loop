// A PRD's open outbox questions, recounted (PRD 657, s5): its current stage read from the stored stages;
// at building or outbox, its outbox counted from its GitHub summary (PRD 426's reader, as the Outbox tab
// counts it); at any other stage, 0 with no GitHub read. The counts go to prd_outbox (./store.ts),
// which /prd and the waiting outbox read instead of GitHub. The stages sync recounts every PRD of a
// repository, a stage event and a Send their one PRD. A PRD whose summary cannot be read keeps what it
// had, and is logged.
import type { DossierRef } from '../../dossier/github/reader';
import { UNREAD, type GithubSummary } from '../../dossier/github/summary';
import type { StoredStage } from '../stage';
import { prdKey, type PrdRef, type StageStore } from '../store';
import type { OutboxCounts, OutboxRecord, PrdOutboxStore, WaitingQuestion } from './store';

/** The stages whose outbox is counted: the feature is being built, or waits on its outbox. */
const COUNTED: ReadonlySet<StoredStage> = new Set(['building', 'outbox']);

/** The ranks that wait on a person. */
const WAITING_RANKS: ReadonlySet<string> = new Set(['human-action', 'high']);

const NONE: OutboxCounts = { open_questions: 0, waiting: [] };

/** A PRD's counts from its summary; null when the summary, its outbox or its feature PR could not be read. */
export function countsOf(summary: GithubSummary | null): OutboxCounts | null {
  if (summary === null || summary.outbox === UNREAD || summary.feature === UNREAD) return null;
  const open = summary.outbox?.open ?? [];
  const waiting = summary.feature?.state === 'open'
    ? open.filter((item) => WAITING_RANKS.has(item.rank))
      .map((item): WaitingQuestion => ({ id: item.id, rank: item.rank as WaitingQuestion['rank'], question: item.question })) // ts-allow: WAITING_RANKS holds only the waiting ranks
    : [];
  return { open_questions: open.length, waiting };
}

export type RecountDeps = {
  stages: Pick<StageStore, 'currentStages'>;
  /** A dossier's GitHub summary; null when it cannot be read. */
  summary: (ref: DossierRef) => Promise<GithubSummary | null>;
  /** The service role's store: only it writes. */
  store: PrdOutboxStore;
  log?: (line: string) => void;
};

/** A PRD to recount; `id`, a dossier's, keys the reader's cache, else the PRD keys its own. */
export type RecountRef = PrdRef & { id?: string };

const why = (error: unknown) => (error instanceof Error ? error.message.split('\n')[0] : String(error));

/** Recounts the workspace's PRDs given and records them; how many were recorded. */
export async function recountOutboxes(workspace: string, prds: readonly RecountRef[], deps: RecountDeps, syncedAt?: string): Promise<number> {
  if (prds.length === 0) return 0;
  const log = deps.log ?? console.error;
  const current = await deps.stages.currentStages(workspace, prds);
  const rows = await Promise.all(prds.map(async (ref): Promise<OutboxRecord | null> => {
    const repository = ref.repository.toLowerCase();
    const key = prdKey(ref);
    const stage = current.get(key);
    const base = { workspace_id: workspace, repository, prd: ref.prd };
    if (!stage || !COUNTED.has(stage)) return { ...base, ...NONE };
    let counts: OutboxCounts | null;
    try {
      counts = countsOf(await deps.summary({ id: ref.id ?? `prd-outbox ${workspace} ${key}`, home_repo: repository, prd: ref.prd }));
    } catch (error) {
      log(`prd outbox: ${key} could not be counted — ${why(error)}`);
      return null;
    }
    if (counts === null) {
      log(`prd outbox: ${key} could not be read, its counts are kept`);
      return null;
    }
    return { ...base, ...counts };
  }));
  const recorded = rows.filter((row): row is OutboxRecord => row !== null);
  await deps.store.record(recorded, syncedAt);
  return recorded.length;
}

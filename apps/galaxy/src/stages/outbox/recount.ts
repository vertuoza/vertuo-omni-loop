// A PRD's open outbox questions, recounted (PRD 657, s5): its current stage read from the stored stages;
// at building or outbox, its outbox counted from its GitHub summary (PRD 426's reader, as the Outbox tab
// counts it; since PRD 902 s2, its dossier's GitHub snapshot); at any other stage, 0 with no GitHub read. The counts go to prd_outbox (./store.ts),
// which /prd and the waiting outbox read instead of GitHub. The stages sync recounts every PRD of a
// repository, a stage event and a Send their one PRD. A PRD whose summary cannot be read keeps what it
// had, and is logged. PRD 1794 (s5): while the feature PR is open, its escalation record (./escalation.ts)
// is read too: each waiting item keeps who it asks, and each held law is stored as a human-action
// waiting item. A feature PR with no record stores its counts as before; a record that cannot be read
// keeps what the PRD had, as an unread summary does.
import type { DossierRef } from '../../dossier/github/reader';
import { UNREAD, type GithubSummary } from '../../dossier/github/summary';
import type { StoredStage } from '../stage';
import { prdKey, type PrdRef, type StageStore } from '../store';
import type { OutboxCounts, OutboxRecord, PrdOutboxStore, WaitingQuestion } from './store';
import { isOneOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { RecordLine } from 'vertuo-omni-plan/kit/lib/escalation/comments.ts';
import type { PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { withEscalation } from './escalation';

/** The stages whose outbox is counted: the feature is being built, or waits on its outbox. */
const COUNTED: ReadonlySet<StoredStage> = new Set(['building', 'outbox']);

/** The ranks that wait on a person. */
const WAITING_RANKS: readonly WaitingQuestion['rank'][] = ['human-action', 'high'];

const NONE: OutboxCounts = { open_questions: 0, waiting: [] };

/** A PRD's counts from its summary and its feature PR's escalation record, when it has one; null when the
 * summary, its outbox or its feature PR could not be read. */
export function countsOf(summary: GithubSummary | null, record: readonly RecordLine[] | null = null): OutboxCounts | null {
  if (summary === null || summary.outbox === UNREAD || summary.feature === UNREAD) return null;
  const open = summary.outbox?.open ?? [];
  const waiting = summary.feature?.state === 'open'
    ? withEscalation(open.flatMap(({ id, rank, question }): WaitingQuestion[] => (isOneOf(WAITING_RANKS, rank) ? [{ id, rank, question }] : [])), record)
    : [];
  return { open_questions: open.length, waiting };
}

/** The open feature PR of a summary read in full, whose escalation record is worth reading; else null. */
const openFeature = (summary: GithubSummary | null): PrNumber | null =>
  summary !== null && summary.feature !== UNREAD && summary.feature?.state === 'open' ? summary.feature.number : null;

export type RecountDeps = {
  stages: Pick<StageStore, 'currentStages'>;
  /** A dossier's GitHub summary, of the workspace's PRD; null when it cannot be read. */
  summary: (ref: DossierRef, workspace: string) => Promise<GithubSummary | null>;
  /** The service role's store: only it writes. */
  store: PrdOutboxStore;
  /** The escalation record on a PRD's open feature PR (PRD 1794, s5); null when it carries none. Left
   * out, no record is read. */
  escalation?: (ref: PrdRef & { pr: PrNumber }) => Promise<RecordLine[] | null>;
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
      const summary = await deps.summary({ id: ref.id ?? `prd-outbox ${workspace} ${key}`, home_repo: repository, prd: ref.prd }, workspace);
      const pr = openFeature(summary);
      const record = pr !== null && deps.escalation ? await deps.escalation({ repository, prd: ref.prd, pr }) : null;
      counts = countsOf(summary, record);
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

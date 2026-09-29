// Where a PRD is (PRD 587): a pure function of its stored stages (supabase/migrations/
// 20261009090000_prd_stages.sql), never of a live GitHub read. The seven stages are the words every
// side uses: STAGES here, and the kit's list, which a test holds to this one.
//
// A stage is recorded once, the first time it is seen, and never moved back; the current stage is the
// latest one on the track, and the stops before it show as passed even when they were never seen (a PRD
// opened by hand). idea belongs to drafts only: a draft lights it once its first question is answered,
// and before that lights nothing and reads Brainstorming. A numbered PRD with no row yet reads Syncing….
// A PRD at building whose feature PR carries open outbox items (the red yolo gate) shows a badge,
// N questions waiting, linking to where they are answered.

export type StageId = 'idea' | 'prd' | 'inbox' | 'building' | 'outbox' | 'shipped' | 'retro';

/** The track, in the order a PRD goes. */
export const STAGES: readonly StageId[] = ['idea', 'prd', 'inbox', 'building', 'outbox', 'shipped', 'retro'];

/** What the database stores: every stage but idea, which is read from a draft's rounds. */
export type StoredStage = Exclude<StageId, 'idea'>;
export const STORED_STAGES: readonly StoredStage[] = ['prd', 'inbox', 'building', 'outbox', 'shipped', 'retro'];

export const isStoredStage = (value: unknown): value is StoredStage => STORED_STAGES.includes(value as StoredStage);
export const isStage = (value: unknown): value is StageId => STAGES.includes(value as StageId);

export const STAGE_LABELS: Readonly<Record<StageId, string>> = {
  idea: 'idea', prd: 'PRD', inbox: 'inbox', building: 'building', outbox: 'outbox', shipped: 'shipped', retro: 'retro',
};

/** One stored stage of a PRD: when it was reached, and when it was last seen. */
export type StageRow = { stage: StoredStage; reached_at: string; synced_at: string };

/** One stop of the track: passed (filled), the current one (bold), or ahead (faded). */
export type TrackStop = { id: StageId; label: string; state: 'passed' | 'current' | 'ahead' };

/** The badge beside the pills at building: `3 questions waiting`, linking to the outbox comment. */
export type StageBadge = { label: string; href: string };

/** The open outbox items of the feature PR, and where they are answered; null when not known. */
export type OpenOutbox = { count: number; href: string } | null;

export type CurrentStage = {
  /** The current stage; brainstorming for a draft with no answer, syncing for a PRD with no row yet. */
  id: StageId | 'brainstorming' | 'syncing';
  track: TrackStop[];
  /** `Stage: building`, `Brainstorming` or `Syncing…`. */
  words: string;
  badge: StageBadge | null;
  /** The latest time any of its stages was seen; null when none is stored. */
  syncedAt: string | null;
};

const BRAINSTORMING = 'Brainstorming';
const SYNCING = 'Syncing…';

/** The latest stage on the track among `rows`; null when there is none. */
export function currentStage(rows: readonly Pick<StageRow, 'stage'>[]): StoredStage | null {
  let at = -1;
  for (const { stage } of rows) at = Math.max(at, STORED_STAGES.indexOf(stage));
  return at === -1 ? null : STORED_STAGES[at];
}

function trackOf(current: StageId | null): TrackStop[] {
  const at = current === null ? -1 : STAGES.indexOf(current);
  return STAGES.map((id, i) => ({
    id, label: STAGE_LABELS[id], state: at === -1 || i > at ? 'ahead' : i < at ? 'passed' : 'current',
  }));
}

export type StageInput = {
  /** The PRD's number; null for a draft. */
  prd: number | null;
  /** A draft only: whether any of its questions was answered. */
  answered?: boolean;
  rows: readonly StageRow[];
  openOutbox?: OpenOutbox;
};

export function storedStageOf({ prd, answered = false, rows, openOutbox = null }: StageInput): CurrentStage {
  if (prd === null) {
    const id = answered ? 'idea' : 'brainstorming';
    return { id, track: trackOf(answered ? 'idea' : null), words: answered ? `Stage: ${STAGE_LABELS.idea}` : BRAINSTORMING, badge: null, syncedAt: null };
  }
  const current = currentStage(rows);
  if (current === null) return { id: 'syncing', track: trackOf(null), words: SYNCING, badge: null, syncedAt: null };
  const syncedAt = rows.map((r) => r.synced_at).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? null;
  const waiting = current === 'building' && openOutbox && openOutbox.count > 0 ? openOutbox : null;
  return {
    id: current,
    track: trackOf(current),
    words: `Stage: ${STAGE_LABELS[current]}`,
    badge: waiting ? { label: `${waiting.count} question${waiting.count === 1 ? '' : 's'} waiting`, href: waiting.href } : null,
    syncedAt,
  };
}

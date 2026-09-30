// Whether Claude works on this dossier (PRD 757, s4): the page's live poll carries `working` beside its
// pulse. Each tick reads, as the viewer, the freshest heartbeat of a session still on the dossier
// (src/working/store.ts) and, only when a round may be open (the pulse has fewer answered than asked),
// its rounds, and the one rule (workingState) says working, asking or idle. A failed read never
// breaks the poll: the heartbeat unread is idle; the rounds unread count every unanswered one as open,
// so a game pauses rather than play over a question.
import type { SupabaseClient } from '@supabase/supabase-js';
import { workingReader } from '../../working/store';
import { workingState, type WorkingPing, type WorkingState } from '../../working/state';
import { dossierRounds, type DossierPulse, type DossierRoundRow, type WorkKind } from '../store';
import { dossierPath } from './view';

type Reads = {
  /** The dossier's pulse this tick; null when it is gone or may not be read. */
  pulse: DossierPulse | null;
  ping: () => Promise<WorkingPing | null>;
  rounds: () => Promise<readonly Pick<DossierRoundRow, 'status'>[]>;
  now: number;
};

/** How many rounds are open: asked but unanswered may be open, and only then are the rounds read. */
async function openRounds(pulse: DossierPulse, rounds: Reads['rounds']): Promise<number> {
  const unanswered = pulse.asked - pulse.answered;
  if (unanswered <= 0) return 0;
  try {
    return (await rounds()).filter((round) => round.status === 'open').length;
  } catch (error) {
    console.error(error);
    return unanswered;
  }
}

/** The dossier's working state, from its reads. */
export async function workingOf({ pulse, ping, rounds, now }: Reads): Promise<WorkingState> {
  if (!pulse) return 'idle';
  const [open, last] = await Promise.all([
    openRounds(pulse, rounds),
    ping().catch((error: unknown) => {
      console.error(error);
      return null;
    }),
  ]);
  return workingState(last, open, now);
}

/** The dossier's working state, read as the viewer. */
export function readWorking(db: Pick<SupabaseClient, 'from' | 'rpc'>, dossierId: string, pulse: DossierPulse | null, now: number = Date.now()): Promise<WorkingState> {
  return workingOf({
    pulse,
    ping: () => workingReader(db).forDossier(dossierId),
    rounds: () => dossierRounds(db, dossierId),
    now,
  });
}

/** The poll's pulse read, carrying `working`: each pulse read is handed on unchanged, and the working
 * state read from it is reported. A pulse that cannot be read fails the tick as before (the page's
 * three-failures problem) and leaves the working state as it was. */
export function withWorking(
  read: () => Promise<DossierPulse | null>,
  working: (pulse: DossierPulse | null) => Promise<WorkingState>,
  onWorking: (state: WorkingState) => void,
): () => Promise<DossierPulse | null> {
  return async () => {
    const pulse = await read();
    onWorking(await working(pulse));
    return pulse;
  };
}

/** Where ⏸ CLAUDE ASKED · ANSWER leads: the dossier's Questions tab, on its own route. */
export const questionsHref = (id: string, kind: WorkKind) => `${dossierPath(id, kind)}?tab=questions`;

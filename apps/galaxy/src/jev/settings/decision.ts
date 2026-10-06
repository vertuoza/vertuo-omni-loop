import { isOneOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { isRecord } from '../is-record';
import { JEV_DECISIONS, jevEntry } from '../decisions';
import { JevStoreError, type JevDecisionSettings, type JevMode, type JevStore } from '../store';
import { ONLY_OWNER } from './api';
import { COULD_NOT_SAVE_DECISION } from './port';

// Saving one decision's mode, threshold and confidence floor from Settings › Jev (PRD 812 s2). The
// page's server action (app/app/settings/jev/actions.ts) runs it as the signed-in person, so
// set_jev_decision() decides who may: only the owner, and a mode other than Off only with a key. It
// writes that one decision and nothing else. A decision whose registry entry has not landed yet is
// refused before anything is sent. The page offers only what these rules accept, so the demo
// (./port.ts) saves a decision as sent.

export type DecisionSaved = { ok: true; settings: JevDecisionSettings } | { ok: false; message: string };

const COMING = 'This decision comes later in this PRD: it cannot be switched on yet.';

const MODES: readonly JevMode[] = ['off', 'shadow', 'on'];

const tuning = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1 ? Math.round(n * 100) / 100 : null;
};

/** A decision's settings as the page sent them, or why they are refused. */
export function readDecision(sent: unknown): DecisionSaved {
  const body = isRecord(sent) ? sent : {};
  const decision = typeof body.decision === 'string' ? body.decision : '';
  if (!JEV_DECISIONS.some((d) => d.name === decision)) return { ok: false, message: 'No such Jev decision.' };
  if (!jevEntry(decision)) return { ok: false, message: COMING };
  const { mode } = body;
  if (!isOneOf(MODES, mode)) return { ok: false, message: 'Mode: Off, Shadow or On.' };
  const threshold = tuning(body.threshold);
  if (threshold === null) return { ok: false, message: 'Threshold: from 0 to 1.' };
  const floor = tuning(body.floor);
  if (floor === null) return { ok: false, message: 'Confidence floor: from 0 to 1.' };
  return { ok: true, settings: { decision, mode, threshold, floor } };
}

/** The database's own reason for a refused value, without the store's wrapping. */
const reasonOf = (error: JevStoreError) => /^Could not [^:]+: (.*?)(?: \(\w+\))?$/.exec(error.message)?.[1] ?? error.message;

export async function saveDecisionFor(
  store: Pick<JevStore, 'setDecision'> | null,
  workspace: unknown,
  sent: unknown,
): Promise<DecisionSaved> {
  if (!store) return { ok: false, message: 'Sign in first.' };
  if (typeof workspace !== 'string' || !workspace || workspace.length > 64) return { ok: false, message: 'Send the workspace.' };
  const read = readDecision(sent);
  if (!read.ok) return read;
  try {
    return { ok: true, settings: await store.setDecision(workspace, read.settings) };
  } catch (error) {
    if (error instanceof JevStoreError && error.code === '42501') return { ok: false, message: ONLY_OWNER };
    if (error instanceof JevStoreError && error.code === '22023') return { ok: false, message: reasonOf(error) };
    console.error(`jev: saving ${read.settings.decision} failed (${error instanceof Error ? error.message : String(error)})`);
    return { ok: false, message: COULD_NOT_SAVE_DECISION };
  }
}

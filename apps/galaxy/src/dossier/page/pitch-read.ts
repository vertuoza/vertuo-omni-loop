// What /prd/<id> reads for its Pitch tab (PRD 859 s3), as the viewer, through the pitch store
// (../../pitch/store.ts): the dossier's pitches, newest first, and — on the Pitch tab only — the five
// files of each shown pitch (one per audience) signed for the viewer. Nothing is signed on another tab.
// Pitches that cannot be read hide the tab and never the page.
import { PITCH_FILE_NAMES, pitchPath, type PitchStore } from '../../pitch/store';
import { shownPitches, type PitchRead } from './pitch';

/** How long a file's signed link lives: an hour of watching and downloading. */
export const PITCH_LINK_SECONDS = 60 * 60;

/** What the page shows: whether it is the Pitch tab (only then is anything signed), and the pitch picked. */
export type PitchPickRead = { sign: boolean; pitch: string | null };

/** The dossier's pitches and, on the Pitch tab, the shown ones' signed files; null when they could not be read. */
export async function readPitches(store: Pick<PitchStore, 'runs' | 'links'>, dossierId: string, pick: PitchPickRead): Promise<PitchRead | null> {
  try {
    const runs = await store.runs(dossierId);
    const shown = pick.sign ? shownPitches(runs, pick.pitch) : [];
    if (!shown.length) return { runs, links: {} };
    const wanted = shown.flatMap((run) => PITCH_FILE_NAMES.map((name) => ({ run: run.id, name })));
    const signed = await store.links(wanted.map(({ run, name }) => pitchPath(dossierId, run, name)), PITCH_LINK_SECONDS);
    const links: PitchRead['links'] = {};
    wanted.forEach(({ run, name }, i) => {
      links[run] = { ...links[run], [name]: signed[i] ?? null };
    });
    return { runs, links };
  } catch (error) {
    console.error(error);
    return null;
  }
}

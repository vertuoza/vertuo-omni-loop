// What /prd/<id> reads for its Proof tab (PRD 798, s4), as the viewer, through the proof store
// (../../proof/store.ts): the dossier's runs, newest first, and — on the Proof tab only — the shown run's
// clips and scripts signed for the viewer, and its scripts' text fetched through those links, so the
// "Script" fold shows what the clip checked. Nothing is signed or fetched on another tab. A script that
// cannot be fetched keeps its link; runs that cannot be read hide the tab and never the page.
import { proofPath, type ProofStore } from '../../proof/store';
import { runOf, type ProofRead } from './proof';

/** How long a clip's or a script's signed link lives: an hour of watching. */
export const PROOF_LINK_SECONDS = 60 * 60;
/** The most of a script's text the fold shows. */
const SCRIPT_MAX_CHARS = 64 * 1024;
const SCRIPT_TIMEOUT_MS = 3000;

/** A script's text, through its signed link; throws when it could not be fetched. */
async function fetchScript(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(SCRIPT_TIMEOUT_MS), cache: 'no-store' });
  if (!response.ok) throw new Error(`fetch the script: ${response.status}`);
  return (await response.text()).slice(0, SCRIPT_MAX_CHARS);
}

/** What the page shows: whether it is the Proof tab (only then is anything signed), and the run picked. */
export type ProofPickRead = { sign: boolean; version: number | null };

async function textOf(url: string | null, fetchText: (url: string) => Promise<string>): Promise<string | null> {
  if (!url) return null;
  try {
    return await fetchText(url);
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** The dossier's runs and, on the Proof tab, the shown run's signed files; null when the runs could not be read. */
export async function readProofs(
  store: Pick<ProofStore, 'runs' | 'links'>, dossierId: string, pick: ProofPickRead,
  fetchText: (url: string) => Promise<string> = fetchScript,
): Promise<ProofRead | null> {
  try {
    const runs = await store.runs(dossierId);
    const run = pick.sign ? runOf(runs, pick.version) : null;
    if (!run) return { runs, shown: null };
    const names = [...new Set(run.criteria.flatMap((c) => [c.video, c.script]).filter((n): n is string => typeof n === 'string'))];
    const signed = await store.links(names.map((name) => proofPath(dossierId, run.id, name)), PROOF_LINK_SECONDS);
    const links = Object.fromEntries(names.map((name, i) => [name, signed[i] ?? null]));
    const scripts = run.criteria.flatMap((c) => (c.script ? [c.script] : []));
    const texts = await Promise.all(scripts.map((name) => textOf(links[name] ?? null, fetchText)));
    return { runs, shown: { id: run.id, links, scripts: Object.fromEntries(scripts.map((name, i) => [name, texts[i] ?? null])) } };
  } catch (error) {
    console.error(error);
    return null;
  }
}

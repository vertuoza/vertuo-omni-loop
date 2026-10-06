// The Proof tab of /prd/<id> (PRD 798, s4), as pure functions of the runs the viewer reads
// (../../proof/store.ts, written by `omni proof push`): the tab appears once the dossier holds a run.
// It shows the newest run first — its commit, the URL it was recorded on, its date and a ✓/✗/— count —
// then one row per criterion: its text, verdict and note, a player for its clip and its script behind a
// fold. An older run is picked the way an older spec version is, with the version picker (`?tab=proof&v=1`),
// runs numbered oldest first. The clips' and scripts' links are signed for the viewer by the route
// (./proof-read.ts), for the shown run only, so the bucket's rules decide who sees what; a link that
// could not be signed reads as missing, never as an error.
import { nameOf, type Member } from '../../ask/page/question';
import type { ProofRunRow, Verdict } from '../../proof/store';
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { shortDay, stamp } from './dates';
import type { VersionEntry } from './view';

/** What the route read: every run the viewer may read, newest first, and for the shown one (null when
 * it was not read for, as on another tab) its files' signed links and its scripts' text, by name; a
 * name missing or null could not be signed or read. */
export type ProofRead = {
  runs: ProofRunRow[];
  shown: { id: string; links: Record<string, string | null>; scripts: Record<string, string | null> } | null;
};

const MARKS: Readonly<Record<Verdict, string>> = { pass: '✓', fail: '✗', unfilmable: '—' };

/** One criterion of the shown run. `video` is its clip's signed link; `videoMissing` says a clip was
 * recorded but its link could not be made. `script` is its script's name, text and link, each null
 * when it could not be read; null with no script (an unfilmable criterion). */
export type ProofCriterionView = {
  text: string; verdict: Verdict; mark: string; note: string | null;
  video: string | null; videoMissing: boolean;
  script: { name: string; text: string | null; href: string | null } | null;
};

export type ProofView = {
  /** The shown run's number, oldest first. */
  number: number;
  /** Every run, newest first, as the picker lists them. */
  versions: VersionEntry[];
  /** The commit it was recorded at, short. */
  commit: string;
  url: string;
  /** `30 Sep 2026, 14:05 UTC`. */
  at: string;
  counts: Record<Verdict, number>;
  criteria: ProofCriterionView[];
};

/** The number of the run the picker names, else the newest's; runs are numbered oldest first. */
function shownNumber(count: number, version: number | null): number {
  return version !== null && version >= 1 && version <= count ? version : count;
}

/** The run the picker names, else the newest; null with none. `runs` is newest first. */
export function runOf(runs: readonly ProofRunRow[], version: number | null): ProofRunRow | null {
  return runs.length ? at(runs, runs.length - shownNumber(runs.length, version), 'the shown run') : null;
}

const short = (sha: string) => sha.slice(0, 7);

function criterionView(c: ProofRunRow['criteria'][number], shown: ProofRead['shown']): ProofCriterionView {
  const link = (name: string) => shown?.links[name] ?? null;
  const video = c.video ? link(c.video) : null;
  return {
    text: c.text,
    verdict: c.verdict,
    mark: MARKS[c.verdict],
    note: c.note?.trim() ? c.note : null,
    video,
    videoMissing: Boolean(c.video) && video === null,
    script: c.script ? { name: c.script, text: shown?.scripts[c.script] ?? null, href: link(c.script) } : null,
  };
}

/** The Proof tab's run: the one `version` picks, else the newest; null when there is no run. */
export function proofView(read: ProofRead, version: number | null, href: (number: number) => string, members: Member[]): ProofView | null {
  const { runs } = read;
  const run = runOf(runs, version);
  if (!run) return null;
  const number = shownNumber(runs.length, version);
  const shown = read.shown?.id === run.id ? read.shown : null;
  const counts: Record<Verdict, number> = { pass: 0, fail: 0, unfilmable: 0 };
  for (const c of run.criteria) counts[c.verdict] += 1;
  return {
    number,
    versions: runs.map((row, i): VersionEntry => {
      const n = runs.length - i;
      const by = row.created_by ? ` · ${nameOf(row.created_by, members)}` : '';
      return { id: row.id, number: n, label: `Run ${n} · ${shortDay(row.created_at)} · commit ${short(row.commit_sha)}${by}`, href: href(n), current: n === number, frame: null };
    }),
    commit: short(run.commit_sha),
    url: run.url,
    at: stamp(run.created_at),
    counts,
    criteria: run.criteria.map((c) => criterionView(c, shown)),
  };
}

/** The Proof tab's badge: how many runs (`2 runs`). */
export const runsBadge = (count: number) => `${count} run${count === 1 ? '' : 's'}`;

// The Engineering board's "PRDs that broke main" line (PRD 2410 s4), pure. A PRD is counted in the period
// when its last lane merged in the window [from, to). Its watch (one row per lane, public.prd_main_watch)
// has ended when it broke in any lane, or every lane is clean; a lane still watching, a refused read
// included, keeps the PRD in "still watched", counted apart. Of the PRDs whose watch ended, `broke` is
// those that broke main. With none ended the line is left out (`null`). A PRD names no person.

/** One lane of a PRD's watch, with the signals that broke it, as the board reads it. */
export interface MainWatchRow {
  /** The PRD's own repository, `owner/name`, lower case, as the watch keeps it. */
  repository: string;
  prd: number;
  status: 'watching' | 'clean' | 'broke';
  mergedAt: string;
  /** What broke this lane: each signal's title, in the order it happened. */
  breaks: string[];
  /** The PRD's page id (its dossier) when it has one. */
  dossier: string | null;
}

export interface BrokePrd { repository: string; prd: number; dossier: string | null; what: string }

export interface BrokeMain {
  /** PRDs whose watch ended in the period. */
  ended: number;
  /** Those that broke main. */
  broke: number;
  /** A whole percent of `ended`. */
  share: number;
  /** PRDs merged in the period still being watched. */
  watching: number;
  /** The ones that broke, most recent merge first. */
  list: BrokePrd[];
}

/** The line over `rows`, narrowed to the `tracked` repositories; null when no PRD's watch ended in the window. */
export function brokeMainOf(rows: readonly MainWatchRow[], tracked: ReadonlySet<string>, from: number, to: number): BrokeMain | null {
  const byPrd = new Map<string, MainWatchRow[]>();
  for (const r of rows) {
    if (!tracked.has(r.repository.toLowerCase())) continue;
    const key = `${r.repository.toLowerCase()}#${r.prd}`;
    byPrd.set(key, [...(byPrd.get(key) ?? []), r]);
  }
  let ended = 0, watching = 0;
  const broke: (BrokePrd & { at: number })[] = [];
  for (const lanes of byPrd.values()) {
    const at = Math.max(...lanes.map((l) => Date.parse(l.mergedAt)));
    if (Number.isNaN(at) || at < from || at >= to) continue;
    const first = lanes.find((l) => l.status === 'broke');
    if (first) {
      ended++;
      broke.push({
        repository: first.repository, prd: first.prd, dossier: lanes.find((l) => l.dossier)?.dossier ?? null,
        what: lanes.flatMap((l) => l.breaks)[0] ?? 'main broke', at,
      });
    } else if (lanes.every((l) => l.status === 'clean')) ended++;
    else watching++;
  }
  if (ended === 0) return null;
  broke.sort((a, b) => b.at - a.at || a.repository.localeCompare(b.repository) || a.prd - b.prd);
  return {
    ended, broke: broke.length, share: Math.round((broke.length / ended) * 100), watching,
    list: broke.map(({ at: _at, ...p }) => p),
  };
}

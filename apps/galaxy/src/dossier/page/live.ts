// The page refreshes itself (PRD 384, part 5). While the tab is visible, every 2 s, the page asks the
// database one small question (the dossier's pulse: how many rounds, how many answered, the latest
// version of each artifact) and compares its signature with the last one. Only when it moved does the
// page re-render from the server, in place. A failed read does nothing visible; three in a row say the
// server cannot be reached, until a read works again.
//
// PRD 426, part 5: the signature also covers the PRD's stage and its number of open outbox items,
// read from the GitHub summary the server caches 60 s. The browser asks the server for them (never
// GitHub) at most every GITHUB_EVERY_MS, so a change on GitHub shows within about a minute. That part
// is compared only when both sides have one, so a page rendered without it never refreshes for
// nothing; the last one known is kept between reads.
import { UNREAD, type GithubSummary } from '../github/summary';
import { DOSSIER_KINDS, type DossierKind, type DossierListRow, type DossierPulse } from '../store';
import { stageOf, type StageId } from './stage';
import type { DossierRead } from './view';

/** How many failed reads in a row before the page says so. */
export const FAILURES_BEFORE_PROBLEM = 3;
export const LIVE_PROBLEM = 'Cannot reach the server. Trying again every few seconds.';

/** How often the open page asks the server for the GitHub part: the summary is cached 60 s anyway. */
export const GITHUB_EVERY_MS = 15_000;

/** What the signature reads of GitHub: the stage, and the open outbox items (null when unknown). */
export type GithubPulse = { stage: StageId | 'unknown'; open: number | null };

/** The dossier's pulse, and its GitHub part when there is one (a numbered dossier whose summary was read). */
export type LivePulse = DossierPulse & { github?: GithubPulse };

/** The GitHub part of a dossier's pulse: its stage and open outbox count, unknown when the summary
 * could not be read; none for a draft, or when the summary was not asked for (undefined). */
export function githubPulse(prd: number | null, github: GithubSummary | null | undefined): GithubPulse | undefined {
  if (prd === null || github === undefined) return undefined;
  const outbox = github?.outbox ?? null;
  return { stage: stageOf(prd, github).id, open: outbox && outbox !== UNREAD ? outbox.open.length : null };
}

const SEPARATOR = '#';

/** The pulse as one string: equal exactly when the counts, every kind's latest version and, when there
 * is one, the GitHub part (the stage and the open outbox count) are. A dossier that is gone (null) has
 * a signature of its own. */
export function signature(pulse: LivePulse | null): string {
  if (!pulse) return 'gone';
  const versions = DOSSIER_KINDS.map((kind) => `${kind}:${pulse.latest[kind] ?? 0}`).join(',');
  const counts = `${pulse.asked}/${pulse.answered}|${versions}`;
  return pulse.github ? `${counts}${SEPARATOR}${pulse.github.stage}:${pulse.github.open ?? '-'}` : counts;
}

/** A signature's two parts: the counts', and GitHub's (null when it has none). */
function partsOf(value: string): [string, string | null] {
  const at = value.indexOf(SEPARATOR);
  return at < 0 ? [value, null] : [value.slice(0, at), value.slice(at + 1)];
}

/** The pulse of what the page was rendered from, so the first check compares against it; null when
 * its rounds could not be read, and the first check sets the baseline instead. */
export function pulseOf(read: DossierRead): LivePulse | null {
  if (!read.rounds) return null;
  const latest: Partial<Record<DossierKind, number>> = {};
  for (const version of read.versions) latest[version.kind] = (latest[version.kind] ?? 0) + 1;
  const pulse: LivePulse = { asked: read.rounds.length, answered: read.rounds.filter((r) => r.status === 'answered').length, latest };
  const github = githubPulse(read.dossier.prd, read.github);
  return github ? { ...pulse, github } : pulse;
}

/** The server's one GitHub reader, as the live check needs it; null when the server has none. */
export type LiveReader = { summary: (dossier: { id: string; home_repo: string; prd: number }) => Promise<GithubSummary | null> } | null;

/** The GitHub part for the open page, from the dossier as the viewer may read it (null: they may not,
 * or it is gone) through the server's cached reader. A draft asks nothing; a failed read, or no
 * reader, is the stage unknown, as the page renders it. */
export async function liveGithub(row: Pick<DossierListRow, 'id' | 'home_repo' | 'prd'> | null, reader: LiveReader): Promise<GithubPulse | undefined> {
  if (!row || row.prd === null) return undefined;
  const summary = reader
    ? await reader.summary({ id: row.id, home_repo: row.home_repo, prd: row.prd }).catch((error: unknown) => {
      console.error(error);
      return null;
    })
    : null;
  return githubPulse(row.prd, summary);
}

/** `read`, asked at most once every `periodMs`: in between, and after a failed read, the last answer
 * (undefined before the first); a failed read is tried again at the next call. */
export function everyFew<T>(read: () => Promise<T>, periodMs: number, now: () => number = Date.now): () => Promise<T | undefined> {
  let last: T | undefined;
  let askedAt: number | null = null;
  return async () => {
    const at = now();
    if (askedAt !== null && at - askedAt < periodMs) return last;
    try {
      last = await read();
      askedAt = at;
    } catch {
      askedAt = null;
    }
    return last;
  };
}

type Watch = {
  /** The signature the page was rendered with; null to take the first read as the baseline. */
  initial: string | null;
  read: () => Promise<LivePulse | null>;
  /** The signature moved: re-render from the server. */
  onChange: () => void;
  /** The problem to show, or null to show none. */
  onProblem: (problem: string | null) => void;
};

/** The tick `poll()` runs: it never ends the polling. */
export function watchChanges({ initial, read, onChange, onProblem }: Watch): () => Promise<boolean> {
  let [counts, github] = initial === null ? [null, null] : partsOf(initial);
  let failures = 0;
  return async () => {
    let next: [string, string | null];
    try {
      next = partsOf(signature(await read()));
    } catch {
      failures += 1;
      if (failures >= FAILURES_BEFORE_PROBLEM) onProblem(LIVE_PROBLEM);
      return true;
    }
    failures = 0;
    onProblem(null);
    const [nextCounts, nextGithub] = next;
    const moved = counts !== null && (nextCounts !== counts || (github !== null && nextGithub !== null && nextGithub !== github));
    if (moved) onChange();
    counts = nextCounts;
    github = nextGithub ?? github;
    return true;
  };
}

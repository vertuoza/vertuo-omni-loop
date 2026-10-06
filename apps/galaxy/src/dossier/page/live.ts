// The page refreshes itself (PRD 384, part 5). While the tab is visible, every 2 s, the page asks the
// database one small question (the dossier's pulse: how many rounds, how many answered, the latest
// version of each artifact) and compares its signature with the last one. Only when it moved does the
// page re-render from the server, in place. A failed read does nothing visible; three in a row say the
// server cannot be reached, until a read works again.
//
// PRD 426, part 5: the signature also covers the PRD's stage and its number of open outbox items,
// read from the GitHub summary the server caches 60 s. That part
// is compared only when both sides have one, so a page rendered without it never refreshes for
// nothing; the last one known is kept between reads. PRD 251 (s9) adds the pending answers (how many,
// and the latest one's time), so a reply typed on GitHub shows on the Outbox tab within a minute.
import { UNREAD, type GithubSummary } from '../github/summary';
import { isPulseKind, PULSE_KINDS, type DossierPulse, type PulseKind } from '../store';
import { stageOf, type StageId } from './stage';
import type { DossierRead } from './view';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';

/** How many failed reads in a row before the page says so. */
export const FAILURES_BEFORE_PROBLEM = 3;
export const LIVE_PROBLEM = 'Cannot reach the server. Trying again every few seconds.';

/** What the signature reads of GitHub: the stage, the open outbox items (null when unknown), the
 * pending answers as `<how many>@<the latest's time>` (null when unknown; left out by an older pulse),
 * and when the PRD's GitHub snapshot was read (PRD 902, s2: `none` with no snapshot; left out when not
 * watched). */
export type GithubPulse = { stage: StageId | 'unknown'; open: number | null; answers?: string | null; readAt?: string };

/** The pending answers, as the signature reads them: how many, and when the latest was written. */
function answersOf(github: GithubSummary | null): string | null {
  const replies = github?.replies ?? null;
  if (!replies || replies === UNREAD) return null;
  const latest = replies.pending.map((p) => p.at ?? '').sort().at(-1) ?? '';
  return `${replies.pending.length}@${latest}`;
}

/** The dossier's pulse, and its GitHub part when there is one (a numbered dossier whose summary was read). */
export type LivePulse = DossierPulse & { github?: GithubPulse | undefined };

/** The GitHub part of a dossier's pulse: its stage and open outbox count, unknown when the summary
 * could not be read; none for a draft, or when the summary was not asked for (undefined). */
export function githubPulse(prd: PrdNumber | null, github: GithubSummary | null | undefined): GithubPulse | undefined {
  if (prd === null || github === undefined) return undefined;
  const outbox = github?.outbox ?? null;
  return { stage: stageOf(prd, github).id, open: outbox && outbox !== UNREAD ? outbox.open.length : null, answers: answersOf(github) };
}

const SEPARATOR = '#';

/** The pulse as one string: equal exactly when the counts, every kind's latest version and, when there
 * is one, the GitHub part (the stage and the open outbox count) are. A dossier that is gone (null) has
 * a signature of its own. */
export function signature(pulse: LivePulse | null): string {
  if (!pulse) return 'gone';
  const versions = PULSE_KINDS.map((kind) => `${kind}:${pulse.latest[kind] ?? 0}`).join(',');
  const counts = `${pulse.asked}/${pulse.answered}|${versions}`;
  if (!pulse.github) return counts;
  const { stage, open, answers, readAt } = pulse.github;
  return `${counts}${SEPARATOR}${stage}:${open ?? '-'}${answers === undefined ? '' : `:${answers ?? '-'}`}${readAt === undefined ? '' : `@${readAt}`}`;
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
  const latest: Partial<Record<PulseKind, number>> = {};
  // A PRD's three kinds and its voice (PRD 822), as dossier_list() pulses them; a fix's rounds and record
  // are not watched (PRD 627).
  for (const version of read.versions) if (isPulseKind(version.kind)) latest[version.kind] = (latest[version.kind] ?? 0) + 1;
  const pulse: LivePulse = { asked: read.rounds.length, answered: read.rounds.filter((r) => r.status === 'answered').length, latest };
  const github = githubPulse(read.dossier.prd, read.github);
  return github ? { ...pulse, github } : pulse;
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

// The GitHub summary (PRD 426): what the PRD page knows of a numbered dossier's PRD on GitHub, read by
// ./reader.ts and cached 60 s per dossier. Each part is read on its own: `UNREAD` when that read failed
// (GitHub answered an error, or could not be reached), null when it answered that there is none yet.
// A summary that could not be read at all (the App not installed, the config unreadable) is null
// where it is used, and the page's stage is unknown.
import { GithubDeferred, GithubPaused } from '@omni/github';
import type { CareState } from './care';

/** A part of the summary whose read failed. Never guessed: the stage reads it as unknown. */
export const UNREAD = 'unread' as const;
export type Read<T> = T | typeof UNREAD;

/** The PRD's issue: its number, its page and whether it is still open. */
export type IssueRef = { number: number; url: string; state: 'open' | 'closed' };

/** A pull request of the PRD: the most recent one on its head branch that is open or merged (a
 * closed, unmerged one counts as absent). `draft` is GitHub's, and only means something while open. */
export type PullRef = {
  number: number; url: string; state: 'open' | 'merged'; draft: boolean;
  /** When it merged (PRD 251, s9); null while open. Left out by a summary made before it. */
  mergedAt?: string | null;
};

/** An open outbox item, as the Outbox tab shows it: its rank, the question and the decision in plain
 * words, and its options (A, the one built, first); a human-action item has person steps instead. */
export type OutboxItem = {
  id: string;
  rank: 'human-action' | 'high' | 'medium';
  question: string;
  decision: string | null;
  options: { letter: string; text: string }[];
  personSteps: string | null;
  /** What the Outbox tab's card shows beside (PRD 251, s9), as the item wrote it; each left out by a
   * summary made before it. `bearsOn` is the front matter's line (`none`, or ids). */
  bearsOn?: string;
  intro?: string | null;
  punchline?: string | null;
  details?: OutboxDetails;
};

/** An item's four closing sections, as written; a section it lacks is left out. */
export type OutboxDetails = { decide?: string; meanwhile?: string; cost?: string; unknown?: string };

/** A settled outbox entry, in the order settled.md holds it: its title (the item's question in plain
 * words, else its id), its verdict and the answer as it was given. */
export type SettledItem = {
  id: string; title: string; verdict: string; answer: string;
  /** Who approved it, when, and the reply's link (PRD 251, s9); null when the entry names none. */
  by?: string | null; at?: string | null; url?: string | null;
};

/** The PRD's outbox: the open items and the settled ones, from the feature branch before shipping and
 * from the shipped folder after. */
export type Outbox = {
  open: OutboxItem[]; settled: SettledItem[];
  /** The mediums adopted when raised and not objected to since (PRD 251, s9): the settled entries
   * whose latest verdict is `adopted`, each read back as its item. */
  adopted?: OutboxItem[];
};

/** A question's number on the feature PR's outbox comment, which never changes once given. */
export type QuestionNumber = { number: number; id: string };

/** Where an answer was given, read from the reply's door line; GitHub when it has none. */
export type AnswerDoor = 'page' | 'terminal' | 'github';

/** An answer on the feature PR that nobody has settled yet, as the kit's reply reader reads it: the
 * latest per number. `counted` is false when GitHub does not list its author as someone whose reply
 * the kit counts (owner, member, collaborator): `/omni:yolo-fix` will not read it. */
export type PendingAnswer = {
  number: number; id: string; text: string; by: string; at: string | null; url: string | null; counted: boolean; door: AnswerDoor;
};

/** What the feature PR's comments say of the outbox (PRD 251, s9): the outbox comment's numbering,
 * and the pending answers. */
export type OutboxReplies = { numbering: QuestionNumber[]; pending: PendingAnswer[] };

export type GithubSummary = {
  /** The dossier's home repository, `owner/name`. */
  repo: string;
  prd: number;
  /** The PRD's folder, `<nnnn>-<topic>`, and its topic; null when none was found. */
  folder: string | null;
  topic: string | null;
  issue: Read<IssueRef | null>;
  phase0: Read<PullRef | null>;
  feature: Read<PullRef | null>;
  retro: Read<PullRef | null>;
  /** The sub-PRs merged into the feature branch. */
  mergedSlices: Read<number>;
  /** The outbox (PRD 426, s2); null when there is none yet. Left out by a summary made before it. */
  outbox?: Read<Outbox | null>;
  /** The feature PR's outbox comment, found by its marker; null when there is none. */
  outboxComment?: Read<string | null>;
  /** The numbering and the pending answers, from the feature PR's comments (PRD 251, s9); null when
   * there is no feature PR. Left out by a summary made before it. */
  replies?: Read<OutboxReplies | null>;
  /** The retro, `retro.md` as markdown (PRD 426, s3): from the retro branch while its PR is open, from the
   * default branch once merged; null when there is no retro PR or no file yet. Left out by a summary made before it. */
  retroText?: Read<string | null>;
  /** The feature PR's care state (PRD 790, s2, ./care.ts), read while it is open; null when there is no
   * open feature PR. Left out by a summary made before it. */
  care?: Read<CareState | null>;
};

/** A call the budget-aware client refused without sending it (PRD 902, s1): it said so once already. */
export function isBudgetRefusal(error: unknown): error is GithubDeferred | GithubPaused {
  return error instanceof GithubDeferred || error instanceof GithubPaused;
}

/** One GitHub read on its own, for `page`: its answer, or UNREAD when it failed, logged unless the
 * budget refused it. */
export async function readPart<T>(page: string, what: string, run: () => Promise<T>): Promise<Read<T>> {
  try {
    return await run();
  } catch (error) {
    if (!isBudgetRefusal(error)) console.error(`${page}: ${what} could not be read from GitHub: ${error instanceof Error ? error.message : String(error)}`);
    return UNREAD;
  }
}

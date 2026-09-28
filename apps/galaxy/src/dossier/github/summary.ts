// The GitHub summary (PRD 426): what the PRD page knows of a numbered dossier's PRD on GitHub, read by
// ./reader.ts and cached 60 s per dossier. Each part is read on its own: `UNREAD` when that read failed
// (GitHub answered an error, or could not be reached), null when it answered that there is none yet.
// A summary that could not be read at all (the App not installed, the config unreadable) is null
// where it is used, and the page's stage is unknown.

/** A part of the summary whose read failed. Never guessed: the stage reads it as unknown. */
export const UNREAD = 'unread' as const;
export type Read<T> = T | typeof UNREAD;

/** The PRD's issue: its number, its page and whether it is still open. */
export type IssueRef = { number: number; url: string; state: 'open' | 'closed' };

/** A pull request of the PRD: the most recent one on its head branch that is open or merged (a
 * closed, unmerged one counts as absent). `draft` is GitHub's, and only means something while open. */
export type PullRef = { number: number; url: string; state: 'open' | 'merged'; draft: boolean };

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
};

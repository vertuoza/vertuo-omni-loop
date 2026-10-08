// The words of a vote on an ideas board (PRD 1246, s3), in one place. English, whatever the locale.

export const VOTE = {
  /** The ▲'s tooltip, by whether the reader voted for the idea. */
  press: (title: string, voted: boolean) => (voted ? `Take back your vote for ${title}` : `Vote for ${title}`),
  /** A vote or a take-back the database refused: no error detail, ever. */
  refused: 'Your vote could not be counted. Try again.',
  /** A GitHub sign-in that came back with an error, read from the board's address. */
  signInFailed: (reason: string) => `Your sign-in to vote did not finish: ${reason}`,
  /** The callback could not turn GitHub's code into a session. */
  unfinished: 'That sign-in could not be finished. Press ▲ again.',
} as const;

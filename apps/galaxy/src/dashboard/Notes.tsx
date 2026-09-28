// The lines a part of the dashboard shows in place of its figures (PRD 328), the same in every part:
// its read failed, or it counts by a GitHub login the person has not linked yet. Parts draw these
// rather than their own words, so the page says each thing one way.

/** Where a person joins a fleet, builds their hero and links their GitHub: the arcade. */
export const ARCADE = '/play';

export const NOTE = {
  unreadable: 'Couldn’t load this. Reload in a moment.',
  linkGithub: 'Link your GitHub in the arcade',
} as const;

/** A part whose read failed: it says so, and the rest of the page renders. */
export function CouldNotLoad() {
  return <p className="dash-note">{NOTE.unreadable}</p>;
}

/** A part that counts by GitHub login, for a person with none linked: a way to link it. */
export function LinkGithub() {
  return <p className="dash-note"><a href={ARCADE}>{NOTE.linkGithub}</a></p>;
}

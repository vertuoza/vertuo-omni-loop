// The landing chain a PR care round keeps straight (landings): once landing n's pull request has
// merged, landing n+1's must target the default branch, and its branch must be rebased onto it, then
// every later landing's onto the one before it. Pure: the board's landings and the default branch
// in, the links to restack and the pull request to look after out. `/omni:pr-care` carries them out.
//
// GitHub retargets a pull request onto the default branch when its base branch is deleted after the
// merge, and not when the branch is kept: `retarget` says whether it still has to be done.
import type { LandingRow } from '../board.ts';
import type { PrNumber } from '../ids.ts';

/** One landing's place in the chain, as a restack names it. */
export type ChainLanding = { landing: number; pr: PrNumber; branch: string };

/** The landing to restack: the first open one right after a merged one, every open landing after it
 * (`later`, rebased in order each onto the one before), and the merged landing it came after. */
export type ChainLink = ChainLanding & {
  /** The branch its pull request targets now. */
  base: string | null;
  /** Whether its pull request still targets something other than the default branch. */
  retarget: boolean;
  after: ChainLanding;
  later: ChainLanding[];
};

/** The landings' own pull requests that are open (draft or ready), as chain entries. */
function openLandings(landings: readonly LandingRow[]): ChainLanding[] {
  return landings.flatMap((row) =>
    (row.pr.state === 'draft' || row.pr.state === 'ready') && row.pr.number !== null ? [{ landing: row.landing, pr: row.pr.number, branch: row.branch }] : [],
  );
}

/**
 * The chain links a round restacks: for the first open landing whose landing before it has merged,
 * one link. `[]` while landing 1 is open, once every landing has merged, and for a PRD of one landing.
 */
export function landingChain(landings: readonly LandingRow[], defaultBranch: string): ChainLink[] {
  for (const [index, row] of landings.entries()) {
    const before = landings[index - 1];
    if (before === undefined || before.pr.state !== 'merged' || before.pr.number === null) continue;
    if ((row.pr.state !== 'draft' && row.pr.state !== 'ready') || row.pr.number === null) continue;
    return [
      {
        landing: row.landing,
        pr: row.pr.number,
        branch: row.branch,
        base: row.pr.base,
        retarget: row.pr.base !== defaultBranch,
        after: { landing: before.landing, pr: before.pr.number, branch: before.branch },
        later: openLandings(landings.slice(index + 1)),
      },
    ];
  }
  return [];
}

/** The landing pull request a care round looks after: the first one still open, else the last one
 * (merged, so the watch stops), else `null` when none was opened. */
export function landingPrToWatch(landings: readonly LandingRow[]): PrNumber | null {
  const open = openLandings(landings)[0];
  if (open) return open.pr;
  return [...landings].reverse().find((row) => row.pr.number !== null)?.pr.number ?? null;
}

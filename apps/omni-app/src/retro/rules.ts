// `rules`: every threshold the retro counts against, the order its findings are ranked in, the words
// its prose may not hold, and a version number that `retro.md` records (PRD 72, decision 16). Nothing
// here reads or writes anything. A change to any value here bumps `RULES_VERSION`, so every retro says
// which rules it was counted by.
//
// Every kind of finding (`kinds/`), `narrate`, `guard` and the issue publisher read their numbers from
// here and hold none of their own.

export const RULES_VERSION = 1;

/**
 * The kinds of finding, most severe first (the spec's "The retro issues"). Kinds in one inner list
 * share a rank: a repeated red check and a flaky run are one step of the order.
 */
export const FINDING_ORDER = Object.freeze(
  [
    ['bug'], // a `bug` issue naming the PRD, within the days after the merge (day 14)
    ['override'], // a merge under `labels.outboxGo`
    ['drift'], // a drifted decision
    ['repeated-red', 'flaky'], // a check red again and again; a red then green on one commit
    ['failing-test'], // the same test failing in several runs
    ['review'], // a red-circle finding, or a thread unresolved at merge
    ['friction'], // a stuck or needs-fix slice, a second claim
    ['territory'], // a file changed outside the slice's territory
    ['churn'], // code rewritten again and again
    ['slow-slice'], // a slice much slower than the others
  ].map((rank) => Object.freeze(rank)),
);

/** At most this many findings get a retro issue per run, worst first (decision 15). */
export const ISSUES_PER_RUN = 5;

/** When a detector's count becomes a finding (the spec's "The facts, and what makes a finding"). */
export const THRESHOLDS = Object.freeze({
  /** A slice whose time from claim to merge is more than this many times the median slice's. */
  slowSliceFactor: 3,
  /** A check red on at least this many commits… */
  repeatedRedCommits: 2,
  /** …or in at least this many slices. */
  repeatedRedSlices: 2,
  /** The same test failing in at least this many runs. */
  failingTestRuns: 2,
  /** A line range rewritten in at least this many commits. */
  churnRangeCommits: 3,
  /** A file whose churn is at least this share, in percent, of its final added lines… */
  churnFilePercent: 50,
  /** …and at least this many lines. */
  churnFileLines: 40,
  /** How long after the merge the second run looks back from. */
  afterMergeDays: 14,
});

/** What the retro reads from GitHub, and what it sends to the model. */
export const LIMITS = Object.freeze({
  /** The last lines of a failed job's log that are read. */
  logTailLines: 200,
  /** The model's input, at most, in tokens (older attempts' logs go first, then hunks). */
  modelInputTokens: 40000,
});

/** The longest each field of the model's prose may be, in characters, before `guard` drops it. */
export const FIELD_CAPS = Object.freeze({
  summary: 1200,
  title: 90,
  whyItMatters: 600,
  lesson: 400,
  /** The judge's verdict: why the retro is worth a PR, or not (PRD 487). */
  reason: 300,
  /** Why the judge keeps a finding, or not (PRD 487). */
  why: 300,
});

/**
 * The words a retro's prose may not hold: the same words the kit's question pool may not hold
 * (`kit/lib/outbox/banter.test.ts`), copied here, since a retro is a delivery file too. A space
 * matches a space, a hyphen or nothing. `rules.test.mjs` fails when the kit's list and this copy part.
 */
export const REFUSED_GAME_WORDS = Object.freeze([
  // The game itself, and whoever plays it.
  'game', 'games', 'gaming', 'play', 'plays', 'played', 'player', 'players', 'playing',
  // Its world.
  'planet', 'planets', 'planetary', 'galaxy', 'galaxies', 'galactic', 'terraform', 'terraformed',
  'terraforming', 'entropy', 'sector', 'sectors', 'zone', 'zones', 'region', 'regions', 'orbit',
  'nebula', 'star', 'stars', 'spaceship', 'invader', 'invaders', 'expedition',
  // A world's states, and the wounds it takes.
  'charted', 'unsurveyed', 'uncrewed', 'decommissioned', 'awaiting command', 'distress', 'rescue',
  'aftershock', 'beacon', 'fault line', 'under fire', 'transmission', 'unconfirmed ground', 'wound',
  'wounds', 'threat', 'tranche',
  // Its economy and its standings.
  'score', 'scores', 'scored', 'scoring', 'points', 'season', 'seasons', 'ranking', 'rankings',
  'leaderboard', 'ledger', 'streak', 'night shift', 'multiplier', 'bonus', 'jackpot', 'trophy',
  'medal', 'badge', 'level', 'quest', 'boss', 'respawn', 'win', 'wins', 'won', 'winner',
  // Its arcade, its fleets and its people.
  'arcade', 'insert coin', 'press start', 'coin', 'coins', 'fleet', 'fleets', 'crew', 'recruit',
  'commander', 'hero', 'heroes', 'omni man', 'cape', 'sprite', 'mascot', 'beaver', 'octopod',
  'picsou', 'pirates', 'invincible', 'ghosts',
]);

/** Words that would make a line about a person or a team rather than about what happened. */
export const REFUSED_PERSON_WORDS = Object.freeze([
  'you', 'your', 'yours', 'yourself', "you're", 'someone', 'somebody', 'everyone', 'everybody',
  'nobody', 'whoever', 'team', 'teams', 'squad', 'developer', 'developers', 'engineer', 'engineers',
  'reviewer', 'reviewers', 'manager', 'managers',
]);

export const REFUSED_WORDS = Object.freeze([...REFUSED_GAME_WORDS, ...REFUSED_PERSON_WORDS]);

const REFUSED_PATTERNS = REFUSED_WORDS.map((word) => ({
  word,
  pattern: new RegExp(`\\b${word.replaceAll(' ', '[\\s-]*')}\\b`, 'i'),
}));

/** Every refused word `text` holds, in the order `REFUSED_WORDS` lists them. */
export function refusedWordsIn(text: string): string[] {
  return REFUSED_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ word }) => word);
}

/** The rank of a kind of finding: its index in `FINDING_ORDER`, or past the end for a kind it does not list. */
export function rankOf(kind: string): number {
  const index = FINDING_ORDER.findIndex((rank) => rank.includes(kind));
  return index === -1 ? FINDING_ORDER.length : index;
}

/** The rules a run used, as the fact sheet records them, so `retro.md` can show them and `retro.json` holds them. */
export function rulesSheet() {
  return {
    version: RULES_VERSION,
    findingOrder: FINDING_ORDER.map((rank) => [...rank]),
    issuesPerRun: ISSUES_PER_RUN,
    thresholds: { ...THRESHOLDS },
    limits: { ...LIMITS },
    fieldCaps: { ...FIELD_CAPS },
  };
}

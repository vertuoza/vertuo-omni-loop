// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { BANTER_POOL, assignBanter, stableHash } from './banter.ts';
import { funLineProblems } from './outbox.ts';

const EVERY_LINE = [...BANTER_POOL.intros, ...BANTER_POOL.punchlines];

/**
 * Words that name the game played on top of delivery (PRD #3, §2, principle 7: the kit never
 * mentions it), gathered from `game/`, `packages/` and the galaxy app: its world and its states,
 * its economy, its arcade, its fleets and their mascots, and the generic game words that would
 * call it to mind. `ledger` is here too: the game keeps a ledger of its own, so the word reads as
 * the game's. A space matches a space, a hyphen or nothing, so `omni man` also catches the one-word
 * spelling.
 */
const GAME_WORDS = [
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
];

const GAME_WORD_PATTERNS = GAME_WORDS.map((word) => ({
  word,
  pattern: new RegExp(`\\b${word.replaceAll(' ', '[\\s-]*')}\\b`, 'i'),
}));

/** Every game word `line` names. */
function gameWordsIn(line) {
  return GAME_WORD_PATTERNS.filter(({ pattern }) => pattern.test(line)).map(({ word }) => word);
}

/** Words that would make a line about a person or a team rather than about its question. */
const PERSON_OR_TEAM_WORDS = [
  'you', 'your', 'yours', 'yourself', "you're", 'someone', 'somebody', 'everyone', 'everybody',
  'nobody', 'whoever', 'team', 'teams', 'squad', 'developer', 'developers', 'engineer', 'engineers',
  'reviewer', 'reviewers', 'manager', 'managers',
];
const PERSON_OR_TEAM = new RegExp(`\\b(?:${PERSON_OR_TEAM_WORDS.join('|')})\\b`, 'i');

/** A fixed pool, so which line an id takes can be read off `assignBanter` alone. */
const SMALL_POOL = {
  intros: ['I0', 'I1', 'I2', 'I3', 'I4'],
  punchlines: ['P0', 'P1', 'P2', 'P3', 'P4'],
};

/** The intro `id` takes when it is served alone — the line its id hashes to. */
function hashedIntro(id, pool) {
  return assignBanter([id], { pool }).get(id).intro;
}

/** Two ids whose intros hash to the same line of `pool`. */
function collidingIds(pool) {
  const byLine = new Map();
  for (let n = 1; n < 500; n += 1) {
    const id = `s1-${String(n).padStart(2, '0')}-question`;
    const line = hashedIntro(id, pool);
    if (byLine.has(line)) return [byLine.get(line), id];
    byLine.set(line, id);
  }
  throw new Error('no two ids hash to the same line');
}

describe('the fallback pool (PRD #50, slice s2)', () => {
  it('holds enough intros and punchlines that a comment rarely runs out', () => {
    expect(BANTER_POOL.intros.length).toBeGreaterThanOrEqual(24);
    expect(BANTER_POOL.punchlines.length).toBeGreaterThanOrEqual(24);
  });

  it('never repeats a line', () => {
    expect(new Set(EVERY_LINE).size).toBe(EVERY_LINE.length);
  });

  it('holds every line to the rules an agent’s line is held to: plain words, 120 characters at most', () => {
    const problems = EVERY_LINE.flatMap((line) =>
      funLineProblems(line).map((problem) => `"${line}" ${problem}`),
    );
    expect(problems).toEqual([]);
  });

  it('holds lines that read as one line of italics: trimmed, ending in a full stop, a question mark or a bang, and with no mark that would end the emphasis', () => {
    for (const line of EVERY_LINE) {
      expect(line).toBe(line.trim());
      expect(line).toMatch(/[.!?]$/);
      expect(line).not.toMatch(/[_*\n]/);
    }
  });

  it('names none of the game words its test lists', () => {
    const hits = EVERY_LINE.flatMap((line) =>
      gameWordsIn(line).map((word) => `"${line}" names "${word}"`),
    );
    expect(hits).toEqual([]);
  });

  it('would catch a line that names the game (the spec’s own example lines)', () => {
    expect(gameWordsIn('A planet with no forms is just a very expensive rock.')).toEqual(['planet']);
    expect(gameWordsIn('OmniMan votes yes. OmniMan always votes yes.')).toEqual(['omni man']);
    expect(gameWordsIn('The fleet, the arcade and the Omni-Man score points.')).toEqual([
      'score',
      'points',
      'arcade',
      'fleet',
      'omni man',
    ]);
  });

  it('is about a question or its situation, never about a person or a team', () => {
    expect(EVERY_LINE.filter((line) => PERSON_OR_TEAM.test(line))).toEqual([]);
  });
});

describe('stableHash', () => {
  it('is 32-bit FNV-1a over the text’s bytes, so a line never moves between runs or machines', () => {
    expect(stableHash('')).toBe(0x811c9dc5);
    expect(stableHash('a')).toBe(0xe40c292c);
    expect(stableHash('foobar')).toBe(0xbf9cf968);
  });

  it('is the same number for the same id, every time', () => {
    expect(stableHash('s2-01-question')).toBe(stableHash('s2-01-question'));
    expect(stableHash('s2-01-question')).not.toBe(stableHash('s2-02-question'));
  });
});

describe('assignBanter', () => {
  it('gives every id an intro and a punchline from the kit’s pool', () => {
    const ids = ['s1-01-a', 's2-01-b', 's3-01-c'];
    const banter = assignBanter(ids);
    expect([...banter.keys()]).toEqual(ids);
    for (const id of ids) {
      expect(BANTER_POOL.intros).toContain(banter.get(id).intro);
      expect(BANTER_POOL.punchlines).toContain(banter.get(id).punchline);
    }
  });

  it('gives the same lines on every call', () => {
    const ids = ['s1-01-a', 's2-01-b', 's3-01-c', 's4-01-d'];
    expect(assignBanter(ids)).toEqual(assignBanter(ids));
  });

  it('skips a line an earlier id already took: two ids hashing to the same line get different lines, the first keeping it', () => {
    const [first, second] = collidingIds(SMALL_POOL);
    const banter = assignBanter([first, second], { pool: SMALL_POOL });
    expect(banter.get(first).intro).toBe(hashedIntro(first, SMALL_POOL));
    expect(banter.get(second).intro).not.toBe(banter.get(first).intro);
    // In the other order, the other one keeps it: ids are served in the order given.
    const swapped = assignBanter([second, first], { pool: SMALL_POOL });
    expect(swapped.get(second).intro).toBe(hashedIntro(second, SMALL_POOL));
    expect(swapped.get(first).intro).not.toBe(swapped.get(second).intro);
  });

  it('never repeats a line while the pool has one unused', () => {
    for (let start = 1; start <= 20; start += 1) {
      const ids = [0, 1, 2, 3, 4].map((offset) => `s${start + offset}-01-question`);
      const banter = assignBanter(ids, { pool: SMALL_POOL });
      const intros = ids.map((id) => banter.get(id).intro);
      const punchlines = ids.map((id) => banter.get(id).punchline);
      expect(new Set(intros).size).toBe(5);
      expect(new Set(punchlines).size).toBe(5);
    }
  });

  it('never changes an earlier id’s lines when an id is added after it', () => {
    const ids = ['s1-01-a', 's2-01-b', 's3-01-c', 's4-01-d'];
    const before = assignBanter(ids, { pool: SMALL_POOL });
    const [, colliding] = collidingIds(SMALL_POOL);
    for (const added of ['s5-01-e', colliding, 's6-01-f']) {
      const after = assignBanter([...ids, added], { pool: SMALL_POOL });
      for (const id of ids) expect(after.get(id)).toEqual(before.get(id));
    }
  });

  it('starts over once every line is taken, so an id past the end of the pool still gets a line', () => {
    const ids = ['s1-01-a', 's2-01-b', 's3-01-c', 's4-01-d', 's5-01-e', 's6-01-f', 's7-01-g'];
    const banter = assignBanter(ids, { pool: SMALL_POOL });
    for (const id of ids) {
      expect(SMALL_POOL.intros).toContain(banter.get(id).intro);
      expect(SMALL_POOL.punchlines).toContain(banter.get(id).punchline);
    }
    // The sixth id starts the second round on the very line it hashes to.
    expect(banter.get('s6-01-f').intro).toBe(hashedIntro('s6-01-f', SMALL_POOL));
  });

  it('gives nothing for no ids', () => {
    expect(assignBanter([]).size).toBe(0);
  });
});

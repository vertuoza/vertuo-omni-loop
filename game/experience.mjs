// Ledger events + the rulebook's `xp` block → every login's XP, level and unlocked games. Pure: the
// writer (`pnpm game:xp`, game/cli/xp.mjs) and the arcade both read the rules through here, so they
// are applied in one place.
//
// XP is the sum, over every season in the ledger, of a login's positive personal credits as score()
// computes them, each multiplied by its kind's weight, rounded once after summing. A debit (a zone
// reverted) and a clawback never lower it; a fleet credit (a terraform, a decay) is not personal.
//
// Fresh start (PRD 728): only a row with a home counts. A row written before the fresh start has
// none; it stays stored (the ledger is append-only) and adds nothing, so XP restarted at 0 once.
import { RULEBOOK } from './rulebook.mjs';
import { score } from './economy.mjs';

// The personal credits score() pays, by reason, and the weight each one reads.
const KIND_OF = Object.freeze({
  'zone secured': 'zoneSecured',
  rescue: 'rescue',
  'expedition bonus': 'expedition',
  'closer bonus': 'closer',
});
const WOUND_CLOSED = 'wound closed: ';

/** The `xp.weights` key a credit's reason reads, or null: a debit, a fleet credit or a reason it does not know. */
export function xpKindOf(reason) {
  if (reason.startsWith(WOUND_CLOSED)) return 'woundClosed';
  return Object.hasOwn(KIND_OF, reason) ? KIND_OF[reason] : null;
}

const loginOf = (login) => login.toLowerCase();

/** The rows a season and XP count: those with a home. A row with none was written before the fresh start (PRD 728). */
export function counted(events) {
  return events.filter((e) => e.home);
}

/**
 * Every login the ledger names (lower-cased), with its XP: 0 for a login that never earned a
 * counted credit. `now` is score()'s; `rules` is an `xp` block, the rulebook's by default.
 */
export function experience(events, { now, rules = RULEBOOK.xp }) {
  const sums = new Map();
  // Every login the ledger names keeps a row, at 0 when only old rows name it: its stored XP resets.
  for (const e of events) if (e.contributor) sums.set(loginOf(e.contributor), 0);
  const scored = counted(events);
  const seasons = [...new Set(scored.map((e) => e.at.slice(0, 7)))].sort();
  for (const season of seasons) {
    for (const c of score(scored, { season, now }).credits) {
      if (!c.to || c.points <= 0) continue; // a fleet credit, or a debit
      const kind = xpKindOf(c.reason);
      const weight = kind ? rules.weights[kind] ?? 0 : 0;
      if (!weight) continue;
      const login = loginOf(c.to);
      sums.set(login, (sums.get(login) ?? 0) + c.points * weight); // a clawed credit keeps counting
    }
  }
  return Object.fromEntries([...sums].sort(([a], [b]) => a.localeCompare(b)).map(([login, sum]) => [login, Math.round(sum)]));
}

/** The XP a level is reached at: `first` for LV 1, `step`·n·(n−1) for LV n ≥ 2. */
export function xpForLevel(level, rules = RULEBOOK.xp) {
  return level <= 1 ? rules.curve.first : rules.curve.step * level * (level - 1);
}

/** The level an XP total reaches: 0 (no level) before the first point, never above the cap. */
export function levelFor(xp, rules = RULEBOOK.xp) {
  let level = 0;
  while (level < rules.cap && xp >= xpForLevel(level + 1, rules)) level++;
  return level;
}

/**
 * The games a level unlocks, added to the ones already stored for the login: a game once unlocked
 * stays unlocked, even after a rule change lowers the level. Sorted, without repeats.
 */
export function unlockedFor(level, stored = [], rules = RULEBOOK.xp) {
  const games = new Set(stored);
  if (level >= 1) for (const [game, at] of Object.entries(rules.unlocks)) if (level >= at) games.add(game);
  return [...games].sort();
}

/**
 * What `player_xp` holds for each login: [{ login, xp, level, unlocked }], in login order.
 * `stored` maps a lower-cased login to the games already unlocked for it.
 */
export function playerXp(events, { now, rules = RULEBOOK.xp, stored = {} }) {
  return Object.entries(experience(events, { now, rules })).map(([login, xp]) => {
    const level = levelFor(xp, rules);
    return { login, xp, level, unlocked: unlockedFor(level, stored[login] ?? [], rules) };
  });
}

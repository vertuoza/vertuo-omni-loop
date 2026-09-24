// game/cli/score.mjs [YYYY-MM] — fold the ledger into season snapshots and the rankings page.
// With no argument it folds the current season, and in the first 7 days of a month also the
// previous one, whose final standings become the rankings page (see seasonsToScore).
import { mkdirSync, writeFileSync } from 'node:fs';
import { readLedger } from '../ledger.mjs';
import { score, seasonsToScore } from '../economy.mjs';
import { renderRankings } from '../render/rankings.mjs';

const now = new Date();
const { seasons, rankings } = seasonsToScore(now, process.argv[2]);
const ledger = readLedger('game/ledger');
mkdirSync('game/season', { recursive: true });
for (const season of seasons) {
  const result = score(ledger, { season, now });
  writeFileSync(`game/season/${season}.json`, JSON.stringify(result, null, 2) + '\n');
  if (season === rankings) writeFileSync('game/season/rankings.md', renderRankings(result) + '\n');
  console.log(`season ${season}: ${Object.keys(result.individuals).length} heroes · ${Object.keys(result.teams).length} fleets · ${result.credits.length} credits${season === rankings ? ' · rankings' : ''}`);
}

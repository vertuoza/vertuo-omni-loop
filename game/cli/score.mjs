// game/cli/score.mjs — fold the ledger into the season snapshot and the rankings page.
import { mkdirSync, writeFileSync } from 'node:fs';
import { readLedger } from '../ledger.mjs';
import { score } from '../economy.mjs';
import { renderRankings } from '../render/rankings.mjs';

const now = new Date();
const season = process.argv[2] ?? now.toISOString().slice(0, 7);
const result = score(readLedger('game/ledger'), { season, now });
mkdirSync('game/season', { recursive: true });
writeFileSync(`game/season/${season}.json`, JSON.stringify(result, null, 2) + '\n');
writeFileSync('game/season/rankings.md', renderRankings(result) + '\n');
console.log(`season ${season}: ${Object.keys(result.individuals).length} heroes · ${Object.keys(result.teams).length} fleets · ${result.credits.length} credits`);

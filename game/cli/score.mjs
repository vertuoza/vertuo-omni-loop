// game/cli/score.mjs [YYYY-MM] [--rankings <file>] — fold the ledger (Supabase) into season scores.
// With no season it folds the current month, and in the first 7 days of a month also the previous
// one, whose final standings become the rankings page (see seasonsToScore). `--rankings` writes
// that page to a file, for the workflow to post; nothing is written to the repository.
import { writeFileSync } from 'node:fs';
import { supabaseFromEnv, supabaseLedger } from '../sources/supabase.mjs';
import { score, seasonsToScore } from '../economy.mjs';
import { renderRankings } from '../render/rankings.mjs';
import { scoreArgs } from './score-args.mjs';

let args;
try { args = scoreArgs(process.argv.slice(2)); } catch (err) { console.error(`${err.message}\nusage: game:score [YYYY-MM] [--rankings <file>]`); process.exit(2); }
const rankingsFile = args.rankings;

const now = new Date();
const { seasons, rankings } = seasonsToScore(now, args.season ?? undefined);
const ledger = await supabaseLedger(supabaseFromEnv()).read();
for (const season of seasons) {
  const result = score(ledger, { season, now });
  if (season === rankings && rankingsFile) writeFileSync(rankingsFile, renderRankings(result) + '\n');
  console.log(`season ${season}: ${Object.keys(result.individuals).length} heroes · ${Object.keys(result.teams).length} fleets · ${result.credits.length} credits${season === rankings && rankingsFile ? ` · rankings → ${rankingsFile}` : ''}`);
}

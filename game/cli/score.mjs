// game/cli/score.mjs [YYYY-MM] [--rankings <file>] --workspace <slug> — fold one workspace's ledger
// (Supabase) into season scores. With no season it folds the current month, and in the first 7 days
// of a month also the previous one, whose final standings become the rankings page (see
// seasonsToScore). `--rankings` writes that page to a file, for the workflow to post; nothing is
// written to the repository. Only rows with a home count (PRD 728's fresh start): a row written
// before it stays stored and adds nothing to any hero or fleet.
import { writeFileSync } from 'node:fs';
import { supabaseLedger } from '../sources/supabase.mjs';
import { score, seasonsToScore } from '../economy.mjs';
import { counted } from '../experience.mjs';
import { renderRankings } from '../render/rankings.mjs';
import { scoreArgs } from './score-args.mjs';
import { openWorkspace } from './workspace.mjs';

const { rest, workspace, args } = await openWorkspace({ usage: 'game:score [YYYY-MM] [--rankings <file>] --workspace <slug>', parse: scoreArgs });
const rankingsFile = args.rankings;

const now = new Date();
const { seasons, rankings } = seasonsToScore(now, args.season ?? undefined);
const ledger = counted(await supabaseLedger(rest, workspace.id).read());
for (const season of seasons) {
  const result = score(ledger, { season, now });
  if (season === rankings && rankingsFile) writeFileSync(rankingsFile, renderRankings(result) + '\n');
  console.log(`${workspace.slug} season ${season}: ${Object.keys(result.individuals).length} heroes · ${Object.keys(result.teams).length} fleets · ${result.credits.length} credits${season === rankings && rankingsFile ? ` · rankings → ${rankingsFile}` : ''}`);
}

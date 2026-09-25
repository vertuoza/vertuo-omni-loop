// game/cli/project.mjs — snapshot GitHub, append the new events to the ledger in Supabase.
// Reads the sectors, fleets and roster from Supabase first; any failed read appends nothing (F7).
import { supabaseFromEnv, loadConfig, supabaseLedger } from '../sources/supabase.mjs';
import { buildSnapshot } from '../sources/github.mjs';
import { projectEvents } from '../projector.mjs';

const now = new Date();
const rest = supabaseFromEnv();
const config = await loadConfig(rest);
console.log(`config: ${Object.keys(config.sectors).length} sectors · ${config.repos.length} repositories · ${Object.keys(config.teams).length} fleets · ${Object.keys(config.roster).length} players linked to GitHub`);
const snapshot = await buildSnapshot({ config, now });
const skipped = [];
const events = projectEvents(snapshot, { config, now, onSkip: (err) => skipped.push(err) });
for (const { id, message } of skipped) console.warn(`  ! skipped ${id}: ${message}`);
const appended = await supabaseLedger(rest).append(events);
console.log(`planets: ${snapshot.planets.length} · events implied: ${events.length} · appended: ${appended.length}`);
for (const e of appended) console.log(`  + ${e.at} ${e.type} #${e.planet}${e.contributor ? ' @' + e.contributor : ''}${e.team ? ' (' + e.team + ')' : ''}`);

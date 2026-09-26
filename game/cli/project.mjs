// game/cli/project.mjs --workspace <slug> — snapshot the workspace's GitHub, append the new events
// to its ledger in Supabase. Reads the workspace's sectors, fleets and roster first; any failed read
// appends nothing (F7).
import { loadConfig, supabaseLedger } from '../sources/supabase.mjs';
import { buildSnapshot } from '../sources/github.mjs';
import { projectEvents } from '../projector.mjs';
import { openWorkspace } from './workspace.mjs';

const now = new Date();
const { rest, workspace, github } = await openWorkspace({ usage: 'game:project --workspace <slug>', github: true });
const config = await loadConfig(rest, workspace.id);
console.log(`workspace ${workspace.slug}: ${github.org}/${github.planRepo} · ${Object.keys(config.sectors).length} sectors · ${config.repos.length} repositories · ${Object.keys(config.teams).length} fleets · ${Object.keys(config.roster).length} players linked to GitHub`);
const snapshot = await buildSnapshot({ config, now, ...github });
const skipped = [];
const events = projectEvents(snapshot, { config, now, onSkip: (err) => skipped.push(err) });
for (const { id, message } of skipped) console.warn(`  ! skipped ${id}: ${message}`);
const appended = await supabaseLedger(rest, workspace.id).append(events);
console.log(`planets: ${snapshot.planets.length} · events implied: ${events.length} · appended: ${appended.length}`);
for (const e of appended) console.log(`  + ${e.at} ${e.type} #${e.planet}${e.contributor ? ' @' + e.contributor : ''}${e.team ? ' (' + e.team + ')' : ''}`);

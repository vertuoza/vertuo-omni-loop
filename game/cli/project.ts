// game/cli/project.ts --workspace <slug> — snapshot the workspace's GitHub, append the new events
// to its ledger in Supabase. Reads the workspace's sectors, fleets, roster and tracked repositories
// first; any failed read appends nothing (F7). The repositories read are the tracked ones of Settings
// → Repositories (PRD 728). It then reads the workspace's answered ask rounds (PRD 1180): a failed read
// there keeps the GitHub events, appends no answer and says why; the next poll reads them again.
import { answeredRoundsOrNone, loadConfig, supabaseLedger } from '../sources/supabase.ts';
import { buildSnapshot } from '../sources/github.ts';
import { projectEvents, type Skip } from '../projector.ts';
import { openWorkspace } from './workspace.ts';

const now = new Date();
const { rest, workspace } = await openWorkspace({ usage: 'game:project --workspace <slug>', github: true });
const config = await loadConfig(rest, workspace.id);
console.log(`workspace ${workspace.slug}: ${config.tracked.length} tracked repositories · ${Object.keys(config.sectors).length} sectors · ${Object.keys(config.teams).length} fleets · ${Object.keys(config.roster).length} players linked to GitHub`);
const snapshot = await buildSnapshot({ config, now });
const answers = await answeredRoundsOrNone(rest, workspace.id, (line) => { console.warn(`  ! ${line}`); });
console.log(`answered rounds on a PRD since the game began: ${answers.length}`);
const skipped: Skip[] = [];
const events = projectEvents(snapshot, { config, now, answers, onSkip: (err) => skipped.push(err) });
for (const { id, message } of skipped) console.warn(`  ! skipped ${id}: ${message}`);
const appended = await supabaseLedger(rest, workspace.id).append(events);
console.log(`planets: ${snapshot.planets.length} · events implied: ${events.length} · appended: ${appended.length}`);
for (const e of appended) console.log(`  + ${e.at} ${e.type} ${e.home ?? ''}#${e.planet}${e.contributor ? ' @' + e.contributor : ''}${e.team ? ' (' + e.team + ')' : ''}`);

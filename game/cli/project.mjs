// game/cli/project.mjs — snapshot GitHub, append new events to the ledger.
import { loadProjects } from '../config.mjs';
import { buildSnapshot } from '../sources/github.mjs';
import { projectEvents } from '../projector.mjs';
import { appendEvents } from '../ledger.mjs';

const now = new Date();
const config = loadProjects();
const snapshot = await buildSnapshot({ config, now });
const skipped = [];
const events = projectEvents(snapshot, { config, now, onSkip: (err) => skipped.push(err) });
for (const { id, message } of skipped) console.warn(`  ! skipped ${id}: ${message}`);
const appended = appendEvents('game/ledger', events);
console.log(`planets: ${snapshot.planets.length} · events implied: ${events.length} · appended: ${appended.length}`);
for (const e of appended) console.log(`  + ${e.at} ${e.type} #${e.planet}${e.contributor ? ' @' + e.contributor : ''}`);

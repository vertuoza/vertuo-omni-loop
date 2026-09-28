import type { PartDemo } from '../part';
import type { RankingsValue } from './load';
import { rankingsOf } from './rank';

// The rankings in the demo (PRD 328): the demo world's own, as its galaxy ranks them this season,
// with *you* (DAM-DEV of BEAVER) marked. The demo world has no players, only the logins its ledger
// credits, so each hero is named by their login.

export const demoRankings: PartDemo<RankingsValue> = ({ galaxy, login, team }) => rankingsOf(galaxy, [], login, team);

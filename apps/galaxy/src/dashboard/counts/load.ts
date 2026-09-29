import { readForMe, readTabs } from '../../ask/page/source';
import type { PartLoader } from '../part';
import { waitingCount, type Waiting } from './counts';

// Waiting for you (PRD 328, kept on Home by PRD 572): the questions of Claude's that wait for you now,
// read as the signed-in person with the ask pages' own readers (readTabs, readForMe), across the
// person's workspaces, and counted by waitingCount. Its read failing reads 'unreadable' alone, its
// error logged (settle, in ../load.ts), and the rest of Home renders. The season's other counts left
// Home with PRD 572: the board's tiles count the questions answered and the PRDs of the period.

export const loadWaiting: PartLoader<Waiting> = async ({ db, userId, now }) => {
  const [tabs, forMe] = await Promise.all([readTabs(db, userId, now.getTime()), readForMe(db, userId)]);
  return waitingCount(tabs, forMe, now.getTime());
};

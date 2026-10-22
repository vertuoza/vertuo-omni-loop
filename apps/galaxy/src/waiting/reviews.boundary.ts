import type { Boundary } from '../data/parse-rows';
import { openReviewWaits, ReviewWaitRead } from './waiting.repository';

// The Reviews part's own read (PRD 2377 s5), for `pnpm schemas:verify`: the open review, merge and law
// waits, as the waiting repository reads them, across every workspace.
export const boundaries: Boundary[] = [
  { name: 'waiting/reviews: waits', read: (db) => openReviewWaits(db), schema: ReviewWaitRead, shape: 'rows' },
];

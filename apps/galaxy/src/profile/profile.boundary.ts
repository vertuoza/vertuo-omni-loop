// The profile's reads (PRD 1030), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts): its
// selects, every workspace's rows, parsed with the schemas the profile parses them with.
import type { Boundary } from '../data/parse-rows';
import { PR_COLUMNS, REVIEW_COLUMNS, StoredPullRequest, StoredReview, TrackedRepository } from './stored';

export const boundaries: Boundary[] = [
  { name: 'profile: repositories', read: (db) => db.from('repositories').select('full_name').eq('tracked', true), schema: TrackedRepository, shape: 'rows' },
  { name: 'profile: pull_requests', read: (db) => db.from('pull_requests').select(PR_COLUMNS), schema: StoredPullRequest, shape: 'rows' },
  { name: 'profile: pull_request_reviews', read: (db) => db.from('pull_request_reviews').select(REVIEW_COLUMNS), schema: StoredReview, shape: 'rows' },
];

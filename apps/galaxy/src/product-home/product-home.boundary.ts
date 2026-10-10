// The product home's reads from Supabase, for `pnpm schemas:verify` (PRD 1030, scripts/schemas-verify.ts):
// each of its storage's own selects (PRD 1364 s9, and s10's ideas, roadmaps and fixes), over every
// workspace. approval_requests_waiting() is registered by nobody: it answers for the signed-in caller only.
import type { Boundary } from '../data/parse-rows';
import {
  approvalsOf, featurePullsOf, outboxOf, productFixesOf, productIdeasOf, productOf, productPrdsOf, productRoadmapsOf, stagesOf,
  StoredApproval, StoredFix, StoredHomePrd, StoredIdea, StoredOutbox, StoredProduct, StoredPull, StoredRoadmap, StoredStageRow,
  StoredTopic, StoredVoid, topicsOf, voidsOf,
} from './product-home.repository';

const WHERE = 'product-home/product-home.repository';

export const boundaries: Boundary[] = [
  { name: `${WHERE}: products`, read: (db) => productOf(db), schema: StoredProduct, shape: 'rows' },
  { name: `${WHERE}: dossiers`, read: (db) => productPrdsOf(db), schema: StoredHomePrd, shape: 'rows' },
  { name: `${WHERE}: prd_stages`, read: (db) => stagesOf(db), schema: StoredStageRow, shape: 'rows' },
  { name: `${WHERE}: prd_outbox`, read: (db) => outboxOf(db), schema: StoredOutbox, shape: 'rows' },
  { name: `${WHERE}: prd_topics`, read: (db) => topicsOf(db), schema: StoredTopic, shape: 'rows' },
  { name: `${WHERE}: approvals`, read: (db) => approvalsOf(db), schema: StoredApproval, shape: 'rows' },
  { name: `${WHERE}: approval_voids`, read: (db) => voidsOf(db), schema: StoredVoid, shape: 'rows' },
  { name: `${WHERE}: pull_requests`, read: (db) => featurePullsOf(db), schema: StoredPull, shape: 'rows' },
  { name: `${WHERE}: ideas`, read: (db) => productIdeasOf(db), schema: StoredIdea, shape: 'rows' },
  { name: `${WHERE}: roadmaps`, read: (db) => productRoadmapsOf(db), schema: StoredRoadmap, shape: 'rows' },
  { name: `${WHERE}: fix dossiers`, read: (db) => productFixesOf(db), schema: StoredFix, shape: 'rows' },
];

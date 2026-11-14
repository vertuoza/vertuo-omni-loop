// The mission store's reads (./store.ts), for `pnpm schemas:verify` (PRD 1030): the mission, its roadmaps and their
// PRDs, the PRDs' stages, pages, approvals, voids and plans, its jobs, its events and its fleet's runners, each parsed
// with the schema the store parses it with. Its send, record and update are not here: they write, and the check only
// reads.
import type { Boundary } from '../boundary.ts';
import {
  APPROVAL,
  ApprovalRowSchema,
  DOSSIER,
  DossierRowSchema,
  EVENT,
  EventRowSchema,
  JOB,
  JobRowSchema,
  MISSION,
  PRODUCT,
  ProductRowSchema,
  MissionRowSchema,
  PLAN,
  PlanRowSchema,
  ROADMAP,
  ROADMAP_PRD,
  RoadmapPrdRowSchema,
  RoadmapRowSchema,
  RUNNER,
  RunnerRowSchema,
  STAGE,
  StageRowSchema,
  VOID,
  VoidRowSchema,
} from './store.ts';

export const boundaries: Boundary[] = [
  { name: 'missions/store: missions', read: (db) => db.from('missions').select(MISSION).limit(5), schema: MissionRowSchema, shape: 'rows' },
  { name: 'missions/store: roadmaps', read: (db) => db.from('roadmaps').select(ROADMAP).not('repo', 'is', null).limit(5), schema: RoadmapRowSchema, shape: 'rows' },
  { name: 'missions/store: roadmap PRDs', read: (db) => db.from('roadmap_prds').select(ROADMAP_PRD).limit(5), schema: RoadmapPrdRowSchema, shape: 'rows' },
  { name: 'missions/store: stages', read: (db) => db.from('prd_stages').select(STAGE).limit(5), schema: StageRowSchema, shape: 'rows' },
  { name: 'missions/store: PRD pages', read: (db) => db.from('dossiers').select(DOSSIER).eq('kind', 'prd').not('prd', 'is', null).limit(5), schema: DossierRowSchema, shape: 'rows' },
  { name: 'missions/store: approvals', read: (db) => db.from('approvals').select(APPROVAL).limit(5), schema: ApprovalRowSchema, shape: 'rows' },
  { name: 'missions/store: approval voids', read: (db) => db.from('approval_voids').select(VOID).limit(5), schema: VoidRowSchema, shape: 'rows' },
  { name: 'missions/store: plans', read: (db) => db.from('dossier_versions').select(PLAN).eq('kind', 'plan').limit(1), schema: PlanRowSchema, shape: 'rows' },
  { name: 'missions/store: runner jobs', read: (db) => db.from('runner_jobs').select(JOB).limit(5), schema: JobRowSchema, shape: 'rows' },
  { name: 'missions/store: mission events', read: (db) => db.from('mission_events').select(EVENT).limit(5), schema: EventRowSchema, shape: 'rows' },
  { name: 'missions/store: products', read: (db) => db.from('products').select(PRODUCT).limit(5), schema: ProductRowSchema, shape: 'rows' },
  { name: 'missions/store: runners', read: (db) => db.from('runners').select(RUNNER).limit(5), schema: RunnerRowSchema, shape: 'rows' },
];

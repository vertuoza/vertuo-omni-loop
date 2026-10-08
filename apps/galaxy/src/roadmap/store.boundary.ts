// The roadmaps' reads (PRD 1162, s2), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts):
// each select of roadmapReader(), parsed with the schema the store parses it with.
import type { Boundary } from '../data/parse-rows';
import { ROADMAP_PRD_COLUMNS, ROADMAP_PREREQUISITE_COLUMNS, ROADMAP_READ_COLUMNS, RoadmapPrdRow, RoadmapPrerequisiteRow, RoadmapRow } from './store';

export const boundaries: Boundary[] = [
  { name: 'roadmap/store: roadmaps', read: (db) => db.from('roadmaps').select(ROADMAP_READ_COLUMNS), schema: RoadmapRow, shape: 'rows' },
  { name: 'roadmap/store: roadmap_prds', read: (db) => db.from('roadmap_prds').select(ROADMAP_PRD_COLUMNS), schema: RoadmapPrdRow, shape: 'rows' },
  { name: 'roadmap/store: roadmap_prerequisites', read: (db) => db.from('roadmap_prerequisites').select(ROADMAP_PREREQUISITE_COLUMNS), schema: RoadmapPrerequisiteRow, shape: 'rows' },
];

import { StageTrack } from './StageTrack.tsx';
import { STAGE_TRACK_LAYOUTS } from './StageTrack.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A StageTrack in each layout, a PRD in the building stage. */
export const stageTrackSpecimen: Specimen = (_prop, value) => <StageTrack stage="Building" layout={one(STAGE_TRACK_LAYOUTS, value)} />;

import { StageTrack } from './StageTrack.tsx';
import { FIX_STAGES, STAGE_TRACK_LAYOUTS, STAGE_TRACK_TONES } from './StageTrack.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const building = { Building: 'Building since 17 Nov 09:40 UTC · 10.2 h' };

/**
 * A StageTrack per variant: a PRD building (3 of 7 slices) in each layout, the vertical one a fix's
 * stages; the `waiting` tone a PRD waiting for the viewer's approval, the `working` one agents at work.
 */
export const stageTrackSpecimen: Specimen = (prop, value) => {
  if (prop === 'tone') {
    const tone = one(STAGE_TRACK_TONES, value);
    return tone === 'waiting'
      ? <StageTrack stage="PRD" progress="waits for approval" tone="waiting" />
      : <StageTrack stage="Building" progress="3 of 7 slices" share={3 / 7} times={building} />;
  }
  const layout = one(STAGE_TRACK_LAYOUTS, value);
  return layout === 'vertical'
    ? <StageTrack layout="vertical" stages={FIX_STAGES} stage="Approved" progress="waits for the merge" tone="waiting" label="Fix stage" />
    : <StageTrack stage="Building" progress="3 of 7 slices" share={3 / 7} times={building} />;
};

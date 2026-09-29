import { STAGE_LABELS, type StageId, type TrackStop } from './stage';

// One stage as a pill (PRD 587): the track's stop on a PRD's page, and the current stage of a row on the
// lists. Passed stops are filled, the current one is bold, later ones are faded (dossier.css, .stage-*).

export function StagePill({ stage, state = 'current' }: { stage: StageId; state?: TrackStop['state'] }) {
  return <span className={`stage-stop stage-${state}`}>{STAGE_LABELS[stage]}</span>;
}

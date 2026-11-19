import './StageTrack.css';
import { STAGES } from './StageTrack.meta.ts';
import type { STAGE_TRACK_LAYOUTS } from './StageTrack.meta.ts';

export type StageTrackProps = {
  /** The stage the PRD is in; the stages before it are done, the ones after pending. */
  stage: (typeof STAGES)[number];
  layout?: (typeof STAGE_TRACK_LAYOUTS)[number];
};

/** The loop's stages in order, the PRD's own marked: each said in words, never by colour alone. */
export function StageTrack({ stage, layout = 'horizontal' }: StageTrackProps) {
  const at = STAGES.indexOf(stage);
  return (
    <ol className={`omni-stage-track omni-stage-track--${layout}`}>
      {STAGES.map((name, index) => {
        const state = index < at ? 'done' : index === at ? 'current' : 'pending';
        return (
          <li key={name} className={`omni-stage-track__stage omni-stage-track__stage--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="omni-stage-track__marker" aria-hidden="true" />
            <span className="omni-stage-track__name">{name}</span>
            <span className="omni-stage-track__state"> ({state})</span>
          </li>
        );
      })}
    </ol>
  );
}

import type { ReactNode } from 'react';
import './StageTrack.css';
import { STAGES } from './StageTrack.meta.ts';
import type { STAGE_TRACK_LAYOUTS, STAGE_TRACK_TONES } from './StageTrack.meta.ts';

type StageTrackCommon = {
  layout?: (typeof STAGE_TRACK_LAYOUTS)[number];
  /** The current stage's progress, in words: `3 of 7 slices`, `waits for approval`. Drawn after its name: `Building · 3 of 7 slices`. */
  progress?: string;
  /** How much of the current stage is done, from 0 to 1: the share of its bar that is filled. The whole bar when not given. */
  share?: number;
  /** `working` (the accent) while agents work on the current stage, `waiting` (the signal) while it waits on the viewer. */
  tone?: (typeof STAGE_TRACK_TONES)[number];
  /** Each stage's hover text, by its name: when it started and for how long (`stageSince` words it). */
  times?: Readonly<Partial<Record<string, string>>>;
  /** The list's accessible name, `Stage` by default. */
  label?: string;
};

export type StageTrackProps = StageTrackCommon & (
  /** The loop's stages: the stage the PRD is in; the stages before it are done, the ones after later. */
  | { stages?: never; stage: (typeof STAGES)[number] }
  /** Another life cycle's stages, in order (a fix's are `FIX_STAGES`), and the one it is in. */
  | { stages: readonly string[]; stage: string }
);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const HOUR = 3_600_000;

/** A stage's hover text: `Building since 17 Nov 09:40 UTC · 10.2 h`, in days from 48 hours on (`3.0 d`). */
export function stageSince(stage: string, since: Date, now: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  const at = `${String(since.getUTCDate())} ${MONTHS[since.getUTCMonth()] ?? ''} ${two(since.getUTCHours())}:${two(since.getUTCMinutes())} UTC`;
  const hours = Math.max(0, now.getTime() - since.getTime()) / HOUR;
  const span = hours < 48 ? `${hours.toFixed(1)} h` : `${(hours / 24).toFixed(1)} d`;
  return `${stage} since ${at} · ${span}`;
}

type StageState = 'done' | 'current' | 'pending';

/** The share of the current stage's bar that is filled, in percent: the whole bar when no share is given. */
function percentOf(share: number | undefined): number {
  return share === undefined ? 100 : Math.round(Math.min(1, Math.max(0, share)) * 100);
}

/** The current stage's bar, filled to its share: along it in a row, down it in a column. */
function Fill({ percent, vertical }: { percent: number; vertical: boolean }) {
  return (
    <svg className="omni-stage-track__fill" viewBox="0 0 100 100" preserveAspectRatio="none" shapeRendering="crispEdges" focusable="false">
      <rect width={vertical ? 100 : percent} height={vertical ? percent : 100} />
    </svg>
  );
}

type StageProps = { state: StageState; className: string; words: string; title: string | undefined; fill: ReactNode };

/** One stage: its bar, its name (with the progress when current) and its state in words. */
function Stage({ state, className, words, title, fill }: StageProps) {
  return (
    <li className={className} aria-current={state === 'current' ? 'step' : undefined} title={title}>
      <span className="omni-stage-track__bar" aria-hidden="true">{fill}</span>
      <span className="omni-stage-track__name">{words}</span>
      <span className="omni-stage-track__state"> ({state})</span>
    </li>
  );
}

/** A life cycle's stages in order, said once: the passed ones done, the current one bold with its progress, the later ones quiet. */
export function StageTrack({ stages = STAGES, stage, layout = 'horizontal', progress, share, tone = 'working', times, label = 'Stage' }: StageTrackProps) {
  const at = stages.indexOf(stage);
  const stateOf = (index: number): StageState => (index < at ? 'done' : index === at ? 'current' : 'pending');
  const current = {
    className: `omni-stage-track__stage omni-stage-track__stage--current omni-stage-track__stage--${tone}`,
    words: progress === undefined ? stage : `${stage} · ${progress}`,
    fill: <Fill percent={percentOf(share)} vertical={layout === 'vertical'} />,
  };
  return (
    <ol className={`omni-stage-track omni-stage-track--${layout}`} aria-label={label}>
      {stages.map((name, index) => {
        const state = stateOf(index);
        const drawn = state === 'current' ? current : { className: `omni-stage-track__stage omni-stage-track__stage--${state}`, words: name, fill: null };
        return <Stage key={name} state={state} title={times?.[name]} {...drawn} />;
      })}
    </ol>
  );
}

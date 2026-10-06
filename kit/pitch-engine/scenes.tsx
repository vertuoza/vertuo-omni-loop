// The six scene templates (PRD 1108 s4): intro, statement, feature, steps, before/after and outro, each
// laid out on the 1920×1080 frame in the look's colours and fonts.
import type { ReactNode } from 'react';
import { EASINGS, SPRINGS, interpolate, mix, spring } from './animation.ts';
import { useEngine, useEntryFrame, useSceneTime } from './core.tsx';
import { Column, FILL, GRID, MaybeTitle, PosedMedia, Slot, afterTitle, useCardPose } from './layout.tsx';
import type { Region, Side } from './layout.tsx';
import { DeviceFrame, Surface, useFitted } from './media.tsx';
import type { Fitted } from './fit.ts';
import { alpha } from './palette.ts';
import { revealEnd } from './text.ts';
import { Bullets, Eyebrow, Line, Pill, Title, useExitStyle } from './words.tsx';
import type { Scene } from '../lib/pitch/storyboard.ts';

type SceneMap = { [K in Scene['type']]: Extract<Scene, { type: K }> };
type SceneOf<K extends Scene['type']> = SceneMap[K];

function Intro({ scene }: { scene: SceneOf<'intro'> }): ReactNode {
  const titleAt = scene.eyebrow === undefined ? 0.15 : 0.35;
  return (
    <Column left={GRID} width={1400} gap={40}>
      {scene.eyebrow === undefined ? null : <Eyebrow text={scene.eyebrow} delay={0.2} />}
      <Title text={scene.title} size={132} delay={titleAt} maxWidth={1400} />
      {scene.tag === undefined ? null : <Pill text={scene.tag} delay={revealEnd(scene.title, titleAt) + 0.1} />}
    </Column>
  );
}

function Statement({ scene }: { scene: SceneOf<'statement'> }): ReactNode {
  return (
    <Column left={GRID} width={1500}>
      <Title text={scene.text} size={104} delay={0.1} maxWidth={1500} />
    </Column>
  );
}

type Layout = NonNullable<SceneOf<'feature'>['layout']>;

/** Each feature layout: where the media goes and from which side it arrives, and where the words' column starts (none: a title on top). */
const FEATURE_LAYOUTS: Readonly<Record<Layout, { region: Region; side: Side; column: number | null }>> = {
  left: { region: { x: 110, y: 140, width: 1020, height: 820 }, side: 'left', column: 1210 },
  right: { region: { x: 790, y: 140, width: 1060, height: 820 }, side: 'right', column: GRID },
  full: { region: { x: 140, y: 330, width: 1640, height: 700 }, side: 'center', column: null },
};

/** A feature's words: its title and bullets beside the media, or its title alone above it. */
function FeatureWords({ scene, column }: { scene: SceneOf<'feature'>; column: number | null }): ReactNode {
  if (column === null) {
    return (
      <div style={{ position: 'absolute', left: GRID, top: 150, width: 1500 }}>
        <MaybeTitle text={scene.title} size={80} width={1500} />
      </div>
    );
  }
  return (
    <Column left={column} width={600} gap={36}>
      <MaybeTitle text={scene.title} size={84} width={600} />
      {scene.bullets === undefined ? null : <Bullets items={scene.bullets} delay={afterTitle(scene.title)} />}
    </Column>
  );
}

function Feature({ scene }: { scene: SceneOf<'feature'> }): ReactNode {
  const layout = FEATURE_LAYOUTS[scene.layout ?? 'right'];
  return (
    <div style={FILL}>
      <FeatureWords scene={scene} column={layout.column} />
      <PosedMedia media={scene.media} region={layout.region} side={layout.side} />
    </div>
  );
}

const SIDE_REGION: Region = FEATURE_LAYOUTS.right.region;

/** The colours of a step's number: filled with the accent while it is the step being shown. */
function useStepColours(active: number): { color: string; background: string; border: string } {
  const { palette } = useEngine();
  const on = active > 0.5;
  return { color: on ? palette.onAccent : palette.accent, background: alpha(palette.accent, active), border: `2px solid ${on ? palette.accent : palette.hairline}` };
}

/** One step of a list: its number in a disc, and its label. */
function Step({ label, index, active, done, arrived }: { label: string; index: number; active: number; done: number; arrived: number }): ReactNode {
  const { palette, fonts } = useEngine();
  const colours = useStepColours(active);
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', opacity: arrived * mix(0.42, 1, Math.max(active, done * 0.55)), transform: `translateX(${(1 - arrived) * -20}px)` }}>
      <div style={{ flex: 'none', width: 60, height: 60, borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: fonts.text.stack, fontWeight: 700, fontSize: 24, transform: `scale(${mix(1, 1.08, active)})`, ...colours }}>
        {String(index + 1).padStart(2, '0')}
      </div>
      <div style={{ fontFamily: fonts.text.stack, fontWeight: 700, fontSize: 36, color: palette.ink, lineHeight: 1.15 }}>{label}</div>
    </div>
  );
}

const STEP_FADE = Object.freeze({ before: 0.1, after: 0.25 });
const STEP_STAGGER = 0.14;

/** How much the step at `at` is lit at `t`: rising from its time, 0 to 1. */
const lit = (t: number, at: number | undefined): number => (at === undefined ? 0 : interpolate(t, [at - STEP_FADE.before, at + STEP_FADE.after], [0, 1]));

/** The steps' list: each arrives in turn, lit while the media shows it, dimmed once done. */
function StepList({ scene }: { scene: SceneOf<'steps'> }): ReactNode {
  const { timeline } = useEngine();
  const entry = useEntryFrame();
  const t = useSceneTime();
  const exit = useExitStyle();
  const listAt = afterTitle(scene.title);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, ...exit }}>
      {scene.steps.map((step, index) => {
        const done = lit(t, scene.steps[index + 1]?.at);
        const arrived = spring(entry - (listAt + index * STEP_STAGGER) * timeline.fps, timeline.fps, SPRINGS.smooth);
        return <Step key={index} label={step.label} index={index} active={lit(t, step.at) * (1 - done)} done={done} arrived={arrived} />;
      })}
    </div>
  );
}

function Steps({ scene }: { scene: SceneOf<'steps'> }): ReactNode {
  return (
    <div style={FILL}>
      <Column left={GRID} width={620} gap={36}>
        <MaybeTitle text={scene.title} size={80} width={620} />
        <StepList scene={scene} />
      </Column>
      <PosedMedia media={scene.media} region={SIDE_REGION} side="right" />
    </div>
  );
}

const WIPE_SECONDS = 1.4;
const WIPE_STARTS = 0.35;

/** The before and after markers above the card, the after taking over as the wipe passes. */
function WipeLabels({ labels, p, start }: { labels: SceneOf<'beforeAfter'>['labels']; p: number; start: number }): ReactNode {
  if (labels === undefined) return null;
  return (
    <div style={{ position: 'absolute', left: 0, bottom: '100%', marginBottom: 18 }}>
      <div style={{ opacity: 1 - interpolate(p, [0, 0.12], [0, 1]) }}>
        <Pill text={labels.before} delay={0.5} tone="outline" />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, opacity: interpolate(p, [0.1, 0.3], [0, 1]) }}>
        <Pill text={labels.after} delay={start} tone="accent" />
      </div>
    </div>
  );
}

/** The before and after media, the after wiped in over the before with a glowing edge. */
function Wipe({ scene, fitted }: { scene: SceneOf<'beforeAfter'>; fitted: Fitted }): ReactNode {
  const { palette } = useEngine();
  const t = useSceneTime();
  const start = scene.duration * WIPE_STARTS;
  const p = interpolate(t, [start, start + WIPE_SECONDS], [0, 1], { easing: EASINGS.inOut });
  const edge = { position: 'absolute', top: 0, bottom: 0, left: p * fitted.width - 2, width: 4, background: palette.accent, boxShadow: `0 0 24px 6px ${alpha(palette.accent, 0.6)}`, opacity: interpolate(p, [0, 0.06, 0.94, 1], [0, 1, 1, 0]) } as const;
  return (
    <div style={{ position: 'relative' }}>
      <WipeLabels labels={scene.labels} p={p} start={start} />
      <DeviceFrame device={scene.before.device ?? 'none'}>
        <div style={{ position: 'relative', width: fitted.width, height: fitted.height }}>
          <div style={FILL}>
            <Surface media={scene.before} fitted={fitted} />
          </div>
          <div style={{ ...FILL, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }}>
            <Surface media={scene.after} fitted={fitted} />
          </div>
          <div style={edge} />
        </div>
      </DeviceFrame>
    </div>
  );
}

function BeforeAfter({ scene }: { scene: SceneOf<'beforeAfter'> }): ReactNode {
  const fitted = useFitted(scene.before, SIDE_REGION);
  const pose = useCardPose('right');
  return (
    <div style={FILL}>
      <Column left={GRID} width={600}>
        <MaybeTitle text={scene.title} size={84} width={600} />
      </Column>
      <Slot region={SIDE_REGION}>
        {fitted === null ? null : (
          <div style={pose}>
            <Wipe scene={scene} fitted={fitted} />
          </div>
        )}
      </Slot>
    </div>
  );
}

/** The outro's call to action: a pill in the call-to-action colour, pulsing gently. */
function CallToAction({ text }: { text: string }): ReactNode {
  const t = useSceneTime();
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 1.6);
  return <Pill text={text} delay={0.15} tone="cta" size={34} glow={pulse} />;
}

/** The credits the input gives, under the closing line, when the storyboard asks for them. */
function Credits({ shown, delay }: { shown: boolean; delay: number }): ReactNode {
  const { credits } = useEngine();
  if (!shown || credits.length === 0) return null;
  return <Line text={credits.join(' · ')} delay={delay} size={26} maxWidth={1300} />;
}

const CLOSING_AT = 0.45;

function Outro({ scene }: { scene: SceneOf<'outro'> }): ReactNode {
  const after = scene.closing === undefined ? CLOSING_AT : revealEnd(scene.closing, CLOSING_AT);
  return (
    <Column left={GRID} width={1300} gap={40}>
      <CallToAction text={scene.cta} />
      {scene.closing === undefined ? null : <Title text={scene.closing} size={112} delay={CLOSING_AT} maxWidth={1300} />}
      <Credits shown={scene.credits === true} delay={after + 0.3} />
    </Column>
  );
}

type Templates = { [K in keyof SceneMap]: (props: { scene: SceneMap[K] }) => ReactNode };

const TEMPLATES: Templates = { intro: Intro, statement: Statement, feature: Feature, steps: Steps, beforeAfter: BeforeAfter, outro: Outro };

/** The template of a scene of type `type`. */
const templateOf = <K extends keyof SceneMap>(type: K, scene: SceneMap[K]): ReactNode => {
  const Template: (props: { scene: SceneMap[K] }) => ReactNode = TEMPLATES[type];
  return <Template scene={scene} />;
};

/** A scene drawn by its template. */
export function SceneView({ scene }: { scene: Scene }): ReactNode {
  return templateOf(scene.type, scene);
}

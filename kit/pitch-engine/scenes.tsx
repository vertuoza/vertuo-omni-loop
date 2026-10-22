// The seven scene templates (PRD 1108 s4): intro, statement, feature, steps, before/after, stats (PRD 2030
// s5) and outro, each
// laid out on the 1920×1080 frame in the look's colours and fonts. Every scene but the intro shows its
// supporting lines (PRD 2030 s3): an eyebrow above its title and a body under it, the outro a body under
// its closing line, and its credits one line each: `Built by <team>`, then the music's (PRD 2030 s6).
// A step shows its body under its label, and its own media rises in over the one before it at the step's
// time; the before/after's wipe starts at its `wipeAt` (PRD 2030 s4). The stats scene's figures count up
// one after another once its title has arrived, written for the storyboard's locale (PRD 2030 s5).
import type { CSSProperties, ReactNode } from 'react';
import { EASINGS, SPRINGS, interpolate, mix, spring } from './animation.ts';
import { useEngine, useEntryFrame, useSceneTime } from './core.tsx';
import { AFTER_BODY, Column, FILL, GRID, Lines, PosedMedia, Slot, linesTimes, useCardPose } from './layout.tsx';
import type { Region, SceneLines, Side } from './layout.tsx';
import { figureAt, figureStarts } from './figures.ts';
import type { Figure } from './figures.ts';
import { DeviceFrame, MediaCard, Surface, useFitted } from './media.tsx';
import type { Fitted } from './fit.ts';
import { alpha } from './palette.ts';
import { revealEnd } from './text.ts';
import { Bullets, Eyebrow, Line, Pill, Title, useExitStyle } from './words.tsx';
import { WIPE_SECONDS } from '../lib/pitch/storyboard.ts';
import type { Media, Scene } from '../lib/pitch/storyboard.ts';

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

/** A scene's words, its title being `title`. */
const linesOf = (scene: { eyebrow?: string | undefined; body?: string | undefined }, title: string | undefined): SceneLines => ({ eyebrow: scene.eyebrow, title, body: scene.body });

function Statement({ scene }: { scene: SceneOf<'statement'> }): ReactNode {
  return (
    <Column left={GRID} width={1500}>
      <Lines lines={linesOf(scene, scene.text)} size={104} width={1500} />
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

/** The `full` layout's words over the media: from 150 px down, or from 100 with an eyebrow or a body, the media lower to leave them room. */
const FULL_WORDS = Object.freeze({ top: 150, gap: 20 });
const FULL_WITH_LINES = Object.freeze({ top: 100, region: { x: 140, y: 370, width: 1640, height: 660 } });

/** Whether a scene holds an eyebrow or a body. */
const hasSupport = (scene: { eyebrow?: string | undefined; body?: string | undefined }): boolean => scene.eyebrow !== undefined || scene.body !== undefined;

/** A feature's words: its title, body and bullets beside the media, or its title and body above it. */
function FeatureWords({ scene, column }: { scene: SceneOf<'feature'>; column: number | null }): ReactNode {
  const lines = linesOf(scene, scene.title);
  if (column === null) {
    const top = hasSupport(scene) ? FULL_WITH_LINES.top : FULL_WORDS.top;
    return (
      <div style={{ position: 'absolute', left: GRID, top, width: 1500, display: 'flex', flexDirection: 'column', gap: FULL_WORDS.gap }}>
        <Lines lines={lines} size={80} width={1500} />
      </div>
    );
  }
  return (
    <Column left={column} width={600} gap={36}>
      <Lines lines={lines} size={84} width={600} />
      {scene.bullets === undefined ? null : <Bullets items={scene.bullets} delay={linesTimes(lines).after} />}
    </Column>
  );
}

/** Where a feature's media goes: its layout's region, lowered in the `full` layout under supporting lines. */
const featureRegion = (scene: SceneOf<'feature'>, layout: (typeof FEATURE_LAYOUTS)[Layout]): Region =>
  layout.column === null && hasSupport(scene) ? FULL_WITH_LINES.region : layout.region;

function Feature({ scene }: { scene: SceneOf<'feature'> }): ReactNode {
  const layout = FEATURE_LAYOUTS[scene.layout ?? 'right'];
  return (
    <div style={FILL}>
      <FeatureWords scene={scene} column={layout.column} />
      <PosedMedia media={scene.media} region={featureRegion(scene, layout)} side={layout.side} />
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

type StepOf = SceneOf<'steps'>['steps'][number];

/** A step's words: its label, and its body under it, muted. */
function StepWords({ step }: { step: StepOf }): ReactNode {
  const { palette, fonts } = useEngine();
  const label = <div style={{ fontFamily: fonts.text.stack, fontWeight: 700, fontSize: 36, color: palette.ink, lineHeight: 1.15 }}>{step.label}</div>;
  if (step.body === undefined) return label;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label}
      <p style={{ margin: 0, fontFamily: fonts.text.stack, fontWeight: 400, fontSize: 26, color: palette.muted, lineHeight: 1.3 }}>{step.body}</p>
    </div>
  );
}

/** One step of a list: its number in a disc, its label and its body. */
function Step({ step, index, active, done, arrived }: { step: StepOf; index: number; active: number; done: number; arrived: number }): ReactNode {
  const { fonts } = useEngine();
  const colours = useStepColours(active);
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', opacity: arrived * mix(0.42, 1, Math.max(active, done * 0.55)), transform: `translateX(${(1 - arrived) * -20}px)` }}>
      <div style={{ flex: 'none', width: 60, height: 60, borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: fonts.text.stack, fontWeight: 700, fontSize: 24, transform: `scale(${mix(1, 1.08, active)})`, ...colours }}>
        {String(index + 1).padStart(2, '0')}
      </div>
      <StepWords step={step} />
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
  const listAt = linesTimes(linesOf(scene, scene.title)).after;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, ...exit }}>
      {scene.steps.map((step, index) => {
        const done = lit(t, scene.steps[index + 1]?.at);
        const arrived = spring(entry - (listAt + index * STEP_STAGGER) * timeline.fps, timeline.fps, SPRINGS.smooth);
        return <Step key={index} step={step} index={index} active={lit(t, step.at) * (1 - done)} done={done} arrived={arrived} />;
      })}
    </div>
  );
}

/** How a step's media rises in over the one before it: how long it takes, and from how far below. */
const LAYER_RISE = Object.freeze({ seconds: 0.6, pixels: 70 });

/**
 * One media a steps scene shows: what it shows, its times counted from the scene's start; from when it is
 * on screen and until when (once the next one has risen over it); the step that brings it, or none for
 * the scene's own.
 */
export type StepLayer = Readonly<{ media: Media; from: number; until: number; step: number | null }>;

type Keyed = { at: number; until?: number | undefined };

/** Keys whose times are `by` seconds later. */
const later = <K extends Keyed>(keys: readonly K[], by: number): K[] =>
  keys.map((key) => ({ ...key, at: key.at + by, ...(key.until === undefined ? {} : { until: key.until + by }) }));

/** `media`, its times (its camera, callouts, cursor and the second of its file) counted from `by` seconds into its scene instead of its start. */
export function shiftedMedia(media: Media, by: number): Media {
  const { camera, callouts, cursor } = media;
  return {
    ...media,
    start: (media.start ?? 0) - by * (media.rate ?? 1),
    ...(camera === undefined ? {} : { camera: later(camera, by) }),
    ...(callouts === undefined ? {} : { callouts: later(callouts, by) }),
    ...(cursor === undefined ? {} : { cursor: later(cursor, by) }),
  };
}

/** A steps scene's media, bottom to top: the scene's own first, then each step's own from its time, each kept until the next has risen over it. */
export function stepLayers(scene: SceneOf<'steps'>): StepLayer[] {
  const own = scene.media === undefined ? [] : [{ media: scene.media, from: 0, step: null }];
  const brought = scene.steps.flatMap((step, index) => (step.media === undefined ? [] : [{ media: shiftedMedia(step.media, step.at), from: step.at, step: index }]));
  const layers = [...own, ...brought];
  return layers.map((layer, index) => ({ ...layer, until: (layers[index + 1]?.from ?? Number.POSITIVE_INFINITY) + LAYER_RISE.seconds }));
}

/** The media a steps scene shows on top at `t` seconds into it: the last to have started rising in; none before the first. */
export const stepLayerAt = (scene: SceneOf<'steps'>, t: number): StepLayer | undefined => stepLayers(scene).findLast((layer) => layer.from <= t);

/** How a step's media rises in: from below, fading in, from its time. The scene's own is there from the start. */
function useRise(layer: StepLayer): CSSProperties {
  const { fps } = useEngine().timeline;
  const t = useSceneTime();
  if (layer.step === null) return FILL;
  const p = spring((t - layer.from) * fps, fps, SPRINGS.smooth);
  return { ...FILL, opacity: interpolate(p, [0, 0.4], [0, 1]), translate: `0 ${(1 - p) * LAYER_RISE.pixels}px` };
}

/** One media of a steps scene, on screen from its time until the next has risen over it. */
function StepMedia({ layer }: { layer: StepLayer }): ReactNode {
  const t = useSceneTime();
  const rise = useRise(layer);
  const fitted = useFitted(layer.media, SIDE_REGION);
  const pose = useCardPose('right');
  if (t < layer.from || t >= layer.until) return null;
  return (
    <div data-step-media={layer.step ?? 'scene'} style={rise}>
      <Slot region={SIDE_REGION}>{fitted === null ? null : <MediaCard media={layer.media} fitted={fitted} style={pose} />}</Slot>
    </div>
  );
}

function Steps({ scene }: { scene: SceneOf<'steps'> }): ReactNode {
  return (
    <div style={FILL}>
      <Column left={GRID} width={620} gap={36}>
        <Lines lines={linesOf(scene, scene.title)} size={80} width={620} />
        <StepList scene={scene} />
      </Column>
      {stepLayers(scene).map((layer) => (
        <StepMedia key={layer.step ?? 'scene'} layer={layer} />
      ))}
    </div>
  );
}

/** Where the wipe starts without a `wipeAt`: this share into the scene. */
const WIPE_STARTS = 0.35;

/** The second into a before/after its wipe starts: its `wipeAt`, or 35% of the scene. */
export const wipeStart = (scene: SceneOf<'beforeAfter'>): number => scene.wipeAt ?? scene.duration * WIPE_STARTS;

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
  const start = wipeStart(scene);
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
        <Lines lines={linesOf(scene, scene.title)} size={84} width={600} />
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

/** The figures' size, by how many share the row: one, two or three. */
const FIGURE_SIZES = Object.freeze([200, 168, 136]);

/** One figure: its value counting up from `start`, the first in the accent, and its label under it in upper case. */
function StatFigure({ item, index, start, size }: { item: Figure & { label: string }; index: number; start: number; size: number }): ReactNode {
  const { palette, fonts, timeline } = useEngine();
  const entry = useEntryFrame();
  const p = spring(entry - start * timeline.fps, timeline.fps, SPRINGS.smooth);
  return (
    <div data-figure={index} style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
      <span
        data-value=""
        style={{ fontFamily: fonts.heading.stack, fontWeight: fonts.heading.weight, fontSize: size, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: index === 0 ? palette.accent : palette.ink }}
      >
        {figureAt(item, start, entry / timeline.fps, timeline.locale)}
      </span>
      <span data-label="" style={{ fontFamily: fonts.text.stack, fontWeight: 700, fontSize: 26, letterSpacing: '0.08em', textTransform: 'uppercase', color: palette.muted }}>
        {item.label}
      </span>
    </div>
  );
}

/** The stats scene: its words, then its figures in a row, each counting up a beat after the one before. */
function Stats({ scene }: { scene: SceneOf<'stats'> }): ReactNode {
  const lines = linesOf(scene, scene.title);
  const starts = figureStarts(scene.items.length, linesTimes(lines).after);
  const exit = useExitStyle();
  return (
    <Column left={GRID} width={1680} gap={56}>
      <Lines lines={lines} size={96} width={1500} />
      <div style={{ display: 'flex', gap: 96, alignItems: 'flex-start', ...exit }}>
        {scene.items.map((item, index) => (
          <StatFigure key={index} item={item} index={index} start={starts[index] ?? 0} size={FIGURE_SIZES[scene.items.length - 1] ?? 136} />
        ))}
      </div>
    </Column>
  );
}

/** The outro's call to action: a pill in the call-to-action colour, pulsing gently. */
function CallToAction({ text }: { text: string }): ReactNode {
  const t = useSceneTime();
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 1.6);
  return <Pill text={text} delay={0.15} tone="cta" size={34} glow={pulse} />;
}

/** The beat between one credit line arriving and the next. */
const CREDIT_STAGGER = 0.15;

/** The credits the input gives, one line each (`Built by <team>`, then the music's), under the closing line, when the storyboard asks for them. */
function Credits({ shown, delay }: { shown: boolean; delay: number }): ReactNode {
  const { credits } = useEngine();
  if (!shown || credits.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {credits.map((credit, index) => (
        <Line key={credit} text={credit} delay={delay + index * CREDIT_STAGGER} size={26} maxWidth={1300} />
      ))}
    </div>
  );
}

const CLOSING_AT = 0.45;

/** When the outro's body arrives (once its closing line has), and its credits after it. */
function outroTimes(scene: SceneOf<'outro'>): { body: number; credits: number } {
  const body = scene.closing === undefined ? CLOSING_AT : revealEnd(scene.closing, CLOSING_AT);
  return { body, credits: (scene.body === undefined ? body : body + AFTER_BODY) + 0.3 };
}

function Outro({ scene }: { scene: SceneOf<'outro'> }): ReactNode {
  const at = outroTimes(scene);
  return (
    <Column left={GRID} width={1300} gap={40}>
      <CallToAction text={scene.cta} />
      {scene.closing === undefined ? null : <Title text={scene.closing} size={112} delay={CLOSING_AT} maxWidth={1300} />}
      {scene.body === undefined ? null : <Line text={scene.body} delay={at.body} maxWidth={1300} />}
      <Credits shown={scene.credits === true} delay={at.credits} />
    </Column>
  );
}

type Templates = { [K in keyof SceneMap]: (props: { scene: SceneMap[K] }) => ReactNode };

const TEMPLATES: Templates = { intro: Intro, statement: Statement, feature: Feature, steps: Steps, beforeAfter: BeforeAfter, stats: Stats, outro: Outro };

/** The template of a scene of type `type`. */
const templateOf = <K extends keyof SceneMap>(type: K, scene: SceneMap[K]): ReactNode => {
  const Template: (props: { scene: SceneMap[K] }) => ReactNode = TEMPLATES[type];
  return <Template scene={scene} />;
};

/** A scene drawn by its template. */
export function SceneView({ scene }: { scene: Scene }): ReactNode {
  return templateOf(scene.type, scene);
}

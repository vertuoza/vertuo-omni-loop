// The six scene templates (PRD 1108 s4): intro, statement, feature, steps, before/after and outro, each
// laid out on the 1920×1080 frame in the look's colours and fonts. A media arrives as a 3D card that
// settles slowly toward flat over its scene.
import type { CSSProperties, ReactNode } from 'react';
import { EASINGS, SPRINGS, clamp, interpolate, mix, spring } from './animation.ts';
import { useEngine, useEntryFrame, useExit, useFrame, useScene, useSceneTime } from './core.tsx';
import { DeviceFrame, MediaCard, Surface, useFitted } from './media.tsx';
import type { Fitted } from './media.tsx';
import { alpha } from './palette.ts';
import { revealEnd } from './text.ts';
import { Bullets, Eyebrow, Line, Pill, Title, useExitStyle } from './words.tsx';
import type { Media, Scene } from '../lib/pitch/storyboard.ts';

type SceneOf<T extends Scene['type']> = Extract<Scene, { type: T }>;
type Region = Readonly<{ x: number; y: number; width: number; height: number }>;

/** The left edge every column of words starts on. */
const GRID = 120;
const FILL: CSSProperties = { position: 'absolute', inset: 0 };

/** A column of words, centred down the frame. */
function Column({ left, width, gap = 32, align = 'flex-start', children }: { left: number; width: number; gap?: number; align?: 'flex-start' | 'center'; children: ReactNode }): ReactNode {
  return <div style={{ position: 'absolute', left, width, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: align, gap }}>{children}</div>;
}

type Side = 'left' | 'right' | 'center';

/** A media card's pose: it arrives from its side, turned, then settles slowly toward flat over the scene. */
function useCardPose(side: Side, delay = 0.15): CSSProperties {
  const frame = useFrame();
  const entry = useEntryFrame();
  const scene = useScene();
  const exit = useExit();
  const { fps } = useEngine().timeline;
  const p = spring(entry - delay * fps, fps, SPRINGS.smooth);
  const settled = EASINGS.inOut(clamp(frame / scene.frames));
  const direction = side === 'right' ? -1 : side === 'left' ? 1 : 0;
  const turnY = direction * (mix(7, 2.5, settled) + (1 - p) * 22);
  const turnX = side === 'center' ? mix(10, 2, settled) + (1 - p) * 12 : mix(4, 1.5, settled);
  const moveX = -direction * (1 - p) * 240 - exit * 90 * (direction === 0 ? 1 : direction);
  const moveY = side === 'center' ? (1 - p) * 120 : 0;
  const scale = mix(0.94, 1, p) * mix(1, 1.025, settled);
  return {
    transform: `translate(${moveX}px, ${moveY}px) rotateY(${turnY}deg) rotateX(${turnX}deg) scale(${scale})`,
    opacity: interpolate(p, [0, 0.35], [0, 1]) * (1 - exit),
    filter: exit > 0 ? `blur(${exit * 8}px)` : 'none',
    transformStyle: 'preserve-3d',
  };
}

/** A region of the frame a media card is centred in, with perspective. */
function Slot({ region, children }: { region: Region; children: ReactNode }): ReactNode {
  return (
    <div style={{ position: 'absolute', left: region.x, top: region.y, width: region.width, height: region.height, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: 2400 }}>
      {children}
    </div>
  );
}

/** A media card in a region, posed from its side. */
function PosedMedia({ media, region, side }: { media: Media; region: Region; side: Side }): ReactNode {
  const fitted = useFitted(media, region);
  const pose = useCardPose(side);
  return <Slot region={region}>{fitted === null ? null : <MediaCard media={media} fitted={fitted} style={pose} />}</Slot>;
}

function Intro({ scene }: { scene: SceneOf<'intro'> }): ReactNode {
  const titleAt = scene.eyebrow === undefined ? 0.15 : 0.35;
  const after = revealEnd(scene.title, titleAt);
  return (
    <Column left={GRID} width={1400} gap={40}>
      {scene.eyebrow === undefined ? null : <Eyebrow text={scene.eyebrow} delay={0.2} />}
      <Title text={scene.title} size={132} delay={titleAt} maxWidth={1400} />
      {scene.tag === undefined ? null : <Pill text={scene.tag} delay={after + 0.1} />}
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

const FEATURE_REGIONS: Readonly<Record<'left' | 'right' | 'full', Region>> = {
  left: { x: 110, y: 140, width: 1020, height: 820 },
  right: { x: 790, y: 140, width: 1060, height: 820 },
  full: { x: 140, y: 330, width: 1640, height: 700 },
};

function Feature({ scene }: { scene: SceneOf<'feature'> }): ReactNode {
  const layout = scene.layout ?? 'right';
  const title = scene.title ?? '';
  const bulletsAt = title === '' ? 0.3 : revealEnd(title, 0.1);
  const words =
    layout === 'full' ? (
      <div style={{ position: 'absolute', left: GRID, top: 150, width: 1500 }}>{title === '' ? null : <Title text={title} size={80} delay={0.1} maxWidth={1500} />}</div>
    ) : (
      <Column left={layout === 'left' ? 1210 : GRID} width={600} gap={36}>
        {title === '' ? null : <Title text={title} size={84} delay={0.1} maxWidth={600} />}
        {scene.bullets === undefined ? null : <Bullets items={scene.bullets} delay={bulletsAt} />}
      </Column>
    );
  return (
    <div style={FILL}>
      {words}
      <PosedMedia media={scene.media} region={FEATURE_REGIONS[layout]} side={layout === 'full' ? 'center' : layout === 'left' ? 'left' : 'right'} />
    </div>
  );
}

const SIDE_REGION: Region = { x: 790, y: 140, width: 1060, height: 820 };

/** One step of a list: its number in a disc that fills with the accent while it is the step being shown. */
function Step({ label, index, active, done, arrived }: { label: string; index: number; active: number; done: number; arrived: number }): ReactNode {
  const { palette, fonts } = useEngine();
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', opacity: arrived * mix(0.42, 1, Math.max(active, done * 0.55)), transform: `translateX(${(1 - arrived) * -20}px)` }}>
      <div
        style={{
          flex: 'none',
          width: 60,
          height: 60,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontFamily: fonts.text.stack,
          fontWeight: 700,
          fontSize: 24,
          color: active > 0.5 ? palette.onAccent : palette.accent,
          background: alpha(palette.accent, active),
          border: `2px solid ${active > 0.5 ? palette.accent : palette.hairline}`,
          transform: `scale(${mix(1, 1.08, active)})`,
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </div>
      <div style={{ fontFamily: fonts.text.stack, fontWeight: 700, fontSize: 36, color: palette.ink, lineHeight: 1.15 }}>{label}</div>
    </div>
  );
}

const STEP_FADE = Object.freeze({ before: 0.1, after: 0.25 });

/** How much step `at` is lit at `t`: rising from its time, 0 to 1. */
const lit = (t: number, at: number | undefined): number => (at === undefined ? 0 : interpolate(t, [at - STEP_FADE.before, at + STEP_FADE.after], [0, 1]));

function Steps({ scene }: { scene: SceneOf<'steps'> }): ReactNode {
  const { timeline } = useEngine();
  const entry = useEntryFrame();
  const t = useSceneTime();
  const exit = useExitStyle();
  const title = scene.title ?? '';
  const listAt = title === '' ? 0.3 : revealEnd(title, 0.1);
  return (
    <div style={FILL}>
      <Column left={GRID} width={620} gap={36}>
        {title === '' ? null : <Title text={title} size={80} delay={0.1} maxWidth={620} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, ...exit }}>
          {scene.steps.map((step, index) => {
            const done = lit(t, scene.steps[index + 1]?.at);
            const arrived = spring(entry - (listAt + index * 0.14) * timeline.fps, timeline.fps, SPRINGS.smooth);
            return <Step key={index} label={step.label} index={index} active={lit(t, step.at) * (1 - done)} done={done} arrived={arrived} />;
          })}
        </div>
      </Column>
      <PosedMedia media={scene.media} region={SIDE_REGION} side="right" />
    </div>
  );
}

const WIPE_SECONDS = 1.4;
const WIPE_STARTS = 0.35;

/** The before and after media, the after wiped in over the before with a glowing edge. */
function Wipe({ scene, fitted }: { scene: SceneOf<'beforeAfter'>; fitted: Fitted }): ReactNode {
  const { palette } = useEngine();
  const t = useSceneTime();
  const start = scene.duration * WIPE_STARTS;
  const p = interpolate(t, [start, start + WIPE_SECONDS], [0, 1], { easing: EASINGS.inOut });
  const labels = scene.labels;
  return (
    <div style={{ position: 'relative' }}>
      {labels === undefined ? null : (
        <div style={{ position: 'absolute', left: 0, bottom: '100%', marginBottom: 18 }}>
          <div style={{ opacity: 1 - interpolate(p, [0, 0.12], [0, 1]) }}>
            <Pill text={labels.before} delay={0.5} tone="outline" />
          </div>
          <div style={{ position: 'absolute', left: 0, top: 0, opacity: interpolate(p, [0.1, 0.3], [0, 1]) }}>
            <Pill text={labels.after} delay={start} tone="accent" />
          </div>
        </div>
      )}
      <DeviceFrame device={scene.before.device ?? 'none'}>
        <div style={{ position: 'relative', width: fitted.width, height: fitted.height }}>
          <div style={FILL}>
            <Surface media={scene.before} fitted={fitted} />
          </div>
          <div style={{ ...FILL, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }}>
            <Surface media={scene.after} fitted={fitted} />
          </div>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: p * fitted.width - 2, width: 4, background: palette.accent, boxShadow: `0 0 24px 6px ${alpha(palette.accent, 0.6)}`, opacity: interpolate(p, [0, 0.06, 0.94, 1], [0, 1, 1, 0]) }} />
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
        {scene.title === undefined ? null : <Title text={scene.title} size={84} delay={0.1} maxWidth={600} />}
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

function Outro({ scene }: { scene: SceneOf<'outro'> }): ReactNode {
  const { credits } = useEngine();
  const closingAt = 0.45;
  const after = scene.closing === undefined ? closingAt : revealEnd(scene.closing, closingAt);
  return (
    <Column left={GRID} width={1300} gap={40}>
      <CallToAction text={scene.cta} />
      {scene.closing === undefined ? null : <Title text={scene.closing} size={112} delay={closingAt} maxWidth={1300} />}
      {scene.credits === true && credits.length > 0 ? <Line text={credits.join(' · ')} delay={after + 0.3} size={26} maxWidth={1300} /> : null}
    </Column>
  );
}

/** A scene's template. */
export function SceneView({ scene }: { scene: Scene }): ReactNode {
  switch (scene.type) {
    case 'intro':
      return <Intro scene={scene} />;
    case 'statement':
      return <Statement scene={scene} />;
    case 'feature':
      return <Feature scene={scene} />;
    case 'steps':
      return <Steps scene={scene} />;
    case 'beforeAfter':
      return <BeforeAfter scene={scene} />;
    case 'outro':
      return <Outro scene={scene} />;
  }
}

// The layout every scene shares (PRD 1108 s4): columns of words on one left edge, regions a media card
// is centred in, and the card's pose — it arrives from its side, turned, then settles slowly toward flat
// over its scene.
import type { CSSProperties, ReactNode } from 'react';
import { EASINGS, SPRINGS, clamp, interpolate, mix, spring } from './animation.ts';
import { useEngine, useEntryFrame, useExit, useFrame, useScene } from './core.tsx';
import { MediaCard, useFitted } from './media.tsx';
import { revealEnd } from './text.ts';
import { Title } from './words.tsx';
import type { Media } from '../lib/pitch/storyboard.ts';

export type Region = Readonly<{ x: number; y: number; width: number; height: number }>;

/** The left edge every column of words starts on. */
export const GRID = 120;
export const FILL: CSSProperties = { position: 'absolute', inset: 0 };

/** A column of words, centred down the frame. */
export function Column({ left, width, gap = 32, children }: { left: number; width: number; gap?: number; children: ReactNode }): ReactNode {
  return <div style={{ position: 'absolute', left, width, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap }}>{children}</div>;
}

/** A title when the scene has one. */
export function MaybeTitle({ text, size, width }: { text: string | undefined; size: number; width: number }): ReactNode {
  return text === undefined ? null : <Title text={text} size={size} delay={0.1} maxWidth={width} />;
}

/** When what follows an optional title arrives. */
export const afterTitle = (title: string | undefined): number => (title === undefined ? 0.3 : revealEnd(title, 0.1));

export type Side = 'left' | 'right' | 'center';

/** How a card arrives from each side: which way it turns and moves, how it tilts back, how far it rises. */
const POSES: Readonly<Record<Side, { direction: number; leaves: number; tilt: readonly [number, number, number]; rise: number }>> = {
  left: { direction: 1, leaves: 1, tilt: [4, 1.5, 0], rise: 0 },
  right: { direction: -1, leaves: -1, tilt: [4, 1.5, 0], rise: 0 },
  center: { direction: 0, leaves: 1, tilt: [10, 2, 12], rise: 120 },
};

/** The card's style, from how far it has arrived (`p`), how far its scene has gone (`settled`) and left (`exit`). */
function poseStyle(side: Side, p: number, settled: number, exit: number): CSSProperties {
  const { direction, leaves, tilt, rise } = POSES[side];
  const turnY = direction * (mix(7, 2.5, settled) + (1 - p) * 22);
  const turnX = mix(tilt[0], tilt[1], settled) + (1 - p) * tilt[2];
  const moveX = -direction * (1 - p) * 240 - exit * 90 * leaves;
  const scale = mix(0.94, 1, p) * mix(1, 1.025, settled);
  return {
    transform: `translate(${moveX}px, ${(1 - p) * rise}px) rotateY(${turnY}deg) rotateX(${turnX}deg) scale(${scale})`,
    opacity: interpolate(p, [0, 0.35], [0, 1]) * (1 - exit),
    filter: exit > 0 ? `blur(${exit * 8}px)` : 'none',
    transformStyle: 'preserve-3d',
  };
}

/** A media card's pose in the current scene. */
export function useCardPose(side: Side, delay = 0.15): CSSProperties {
  const frame = useFrame();
  const entry = useEntryFrame();
  const scene = useScene();
  const exit = useExit();
  const { fps } = useEngine().timeline;
  return poseStyle(side, spring(entry - delay * fps, fps, SPRINGS.smooth), EASINGS.inOut(clamp(frame / scene.frames)), exit);
}

/** A region of the frame a media card is centred in, with perspective. */
export function Slot({ region, children }: { region: Region; children: ReactNode }): ReactNode {
  return (
    <div style={{ position: 'absolute', left: region.x, top: region.y, width: region.width, height: region.height, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: 2400 }}>
      {children}
    </div>
  );
}

/** A media card in a region, posed from its side. */
export function PosedMedia({ media, region, side }: { media: Media; region: Region; side: Side }): ReactNode {
  const fitted = useFitted(media, region);
  const pose = useCardPose(side);
  return <Slot region={region}>{fitted === null ? null : <MediaCard media={media} fitted={fitted} style={pose} />}</Slot>;
}

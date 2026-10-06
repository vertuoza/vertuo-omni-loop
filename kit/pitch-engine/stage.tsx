// The ground the whole video plays on (PRD 1108 s4): the look's paper with soft glows of its accent and
// call-to-action colours drifting slowly across it, one continuous space under every scene, and the
// look's logo in the corner.
import type { CSSProperties, ReactNode } from 'react';
import { SPRINGS, spring } from './animation.ts';
import { Picture } from './assets.tsx';
import { useEngine, useVideoFrame } from './core.tsx';
import { alpha } from './palette.ts';

/** One glow: its size in pixels, where it rests (percent of the frame), its colour and how fast it drifts. */
type Glow = { size: number; x: number; y: number; colour: 'accent' | 'cta'; strength: number; phase: number };

const GLOWS: readonly Glow[] = [
  { size: 1300, x: 86, y: 8, colour: 'accent', strength: 0.22, phase: 0 },
  { size: 1000, x: 4, y: 96, colour: 'cta', strength: 0.12, phase: 2 },
  { size: 900, x: 64, y: 112, colour: 'accent', strength: 0.1, phase: 4 },
];

const DRIFT_SPEED = 0.22;
const DRIFT_PERCENT = 5;

/** The ground: paper, and the glows drifting with the video's time. */
export function Background(): ReactNode {
  const { palette, timeline } = useEngine();
  const t = useVideoFrame() / timeline.fps;
  const drift = (phase: number): number => Math.sin(t * DRIFT_SPEED + phase) * DRIFT_PERCENT;
  const strength = palette.dark ? 1.6 : 1;
  const glows = GLOWS.map(
    (glow) =>
      `radial-gradient(${glow.size}px circle at ${glow.x + drift(glow.phase)}% ${glow.y + drift(glow.phase + 1.3)}%, ${alpha(palette[glow.colour], glow.strength * strength)} 0%, transparent 70%)`,
  );
  return <div style={{ position: 'absolute', inset: 0, background: [...glows, palette.paper].join(', ') }} />;
}

const LOGO: CSSProperties = { position: 'absolute', left: 120, top: 64, height: 48, width: 'auto' };

/** The look's logo in the top corner, arriving with the video and staying. */
export function Logo(): ReactNode {
  const { logo, timeline } = useEngine();
  const frame = useVideoFrame();
  if (logo === null) return null;
  const p = spring(frame - 0.25 * timeline.fps, timeline.fps, SPRINGS.smooth);
  return (
    <div style={{ opacity: p }}>
      <Picture src={logo} style={LOGO} />
    </div>
  );
}

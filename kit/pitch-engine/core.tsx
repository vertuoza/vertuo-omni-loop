// The engine's frame context (PRD 1108 s4): every visual is a pure function of the frame it is given,
// never of the clock. The page sets frame n, waits for what it loads, and the capture screenshots it:
// the same frame gives the same pixels every time. A scene sees its own frame, counted from its start.
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { EASINGS, SPRINGS, interpolate, spring } from './animation.ts';
import type { SpringConfig } from './animation.ts';
import type { ClipFrames } from './input.ts';
import type { Fonts, Palette } from './palette.ts';
import { entryDelay } from './timeline.ts';
import type { Timeline, TimelineScene } from './timeline.ts';

/** What every part of a video reads: its timeline, its look, and where its files are. */
export type Engine = Readonly<{
  timeline: Timeline;
  palette: Palette;
  fonts: Fonts;
  logo: string | null;
  credits: readonly string[];
  clips: Readonly<Record<string, ClipFrames>>;
  /** A path of the input (a media file, a clip's image) as an address the page can load. */
  resolve: (path: string) => string;
}>;

const EngineContext = createContext<Engine | null>(null);
const VideoFrameContext = createContext(0);
const FrameContext = createContext(0);
const SceneContext = createContext<TimelineScene | null>(null);

/** The engine and the video's frame, for everything inside. */
export function EngineProvider({ engine, frame, children }: { engine: Engine; frame: number; children: ReactNode }): ReactNode {
  return (
    <EngineContext value={engine}>
      <VideoFrameContext value={frame}>
        <FrameContext value={frame}>{children}</FrameContext>
      </VideoFrameContext>
    </EngineContext>
  );
}

export function useEngine(): Engine {
  const engine = useContext(EngineContext);
  if (engine === null) throw new Error('useEngine() reads an <EngineProvider>');
  return engine;
}

/** The frame counted from the start of the closest scene or sequence. */
export const useFrame = (): number => useContext(FrameContext);
/** The frame counted from the start of the video. */
export const useVideoFrame = (): number => useContext(VideoFrameContext);

/** Shows `children` from frame `from` for `frames` frames of the enclosing time, which it shifts to start at 0. */
function Sequence({ from, frames, children }: { from: number; frames: number; children: ReactNode }): ReactNode {
  const local = useFrame() - from;
  if (local < 0 || local >= frames) return null;
  return <FrameContext value={local}>{children}</FrameContext>;
}

/** One scene of the timeline, on screen while the video's frame is inside it. */
export function SceneSequence({ scene, children }: { scene: TimelineScene; children: ReactNode }): ReactNode {
  return (
    <Sequence from={scene.from} frames={scene.frames}>
      <SceneContext value={scene}>{children}</SceneContext>
    </Sequence>
  );
}

export function useScene(): TimelineScene {
  const scene = useContext(SceneContext);
  if (scene === null) throw new Error('useScene() reads a <SceneSequence>');
  return scene;
}

/** The scene's frame counted from when its entrances start: once the scene before it has mostly gone. */
export function useEntryFrame(): number {
  return useFrame() - entryDelay(useScene());
}

/** How far an element arriving `delay` seconds into the scene's entrances has come, 0 to 1. */
export function useEnter(delay = 0, config: SpringConfig = SPRINGS.smooth): number {
  const frame = useEntryFrame();
  const { fps } = useEngine().timeline;
  return spring(frame - delay * fps, fps, config);
}

/** How far the scene has left across its overlap with the next, 0 to 1. */
export function useExit(): number {
  const frame = useFrame();
  const scene = useScene();
  if (scene.exit === 0) return 0;
  return interpolate(frame, [scene.frames - scene.exit, scene.frames], [0, 1], { easing: EASINGS.in });
}

/** Seconds since the scene started. */
export function useSceneTime(): number {
  return useFrame() / useEngine().timeline.fps;
}

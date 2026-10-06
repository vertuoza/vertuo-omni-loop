// The engine's page (PRD 1108 s4): it loads its input, draws frame 0, and exposes the hooks whoever
// drives it calls.
//
// - `window.__pitchSeek(n)` draws frame n and resolves once it has settled — fonts loaded, every image
//   decoded, every clip sought — so the capture provider screenshots exactly that frame. Called before
//   the page has loaded, it waits for it; when the input is wrong, it rejects naming every problem.
// - `window.__pitchInfo()` resolves to the video's size, frame rate, length in frames and its scenes,
//   each with where it starts, how long it lasts and a settled frame for its still.
// - With `?studio`, the page is a player: space plays and pauses, the arrows step a frame (ten with
//   shift), page up and page down jump between scenes, home goes back to the start. With
//   `?events=<url>`, it reloads whenever that event stream sends a message, so it follows its
//   storyboard as it changes.
import { useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { clamp } from './animation.ts';
import { settle } from './assets.tsx';
import type { Engine } from './core.tsx';
import { engineOf, fetchInput, inputUrl, loadFonts } from './load.ts';
import { stillFrame } from './timeline.ts';
import { Video } from './video.tsx';
import { PAGE_SEEK } from '../lib/pitch/providers/types.ts';

/** The page's second hook: what the video is. */
const PAGE_INFO = '__pitchInfo';

/** How the page shows a frame: set once the player is on screen. */
type Controller = { show: (frame: number, playing: boolean) => void };

/** The scale that fits the stage in the window, and where it sits. */
function useFit(width: number, height: number): { scale: number; left: number; top: number } {
  const measure = (): { scale: number; left: number; top: number } => {
    const scale = Math.min(window.innerWidth / width, window.innerHeight / height);
    return { scale, left: (window.innerWidth - width * scale) / 2, top: (window.innerHeight - height * scale) / 2 };
  };
  const [fitted, setFitted] = useState(measure);
  useLayoutEffect(() => {
    const resize = (): void => { setFitted(measure()); };
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); };
  });
  return fitted;
}

/** The studio's line under the stage: the frame, the time, the scene and whether it plays. */
function Status({ engine, frame, playing }: { engine: Engine; frame: number; playing: boolean }): ReactNode {
  const { timeline, palette } = engine;
  const scene = timeline.scenes.findLast((placed) => placed.from <= frame);
  const text = `${playing ? '▶' : '❚❚'}  frame ${frame} / ${timeline.frames - 1} · ${(frame / timeline.fps).toFixed(2)} s · scene ${(scene?.index ?? 0) + 1} ${scene?.scene.type ?? ''}`;
  return <div style={{ position: 'fixed', left: 12, bottom: 8, font: '14px ui-monospace, monospace', color: palette.paper, background: palette.shade, padding: '4px 8px', borderRadius: 6, opacity: 0.85 }}>{text}</div>;
}

function Player({ engine, controller, studio }: { engine: Engine; controller: Controller; studio: boolean }): ReactNode {
  const [shown, setShown] = useState({ frame: 0, playing: false });
  const { scale, left, top } = useFit(engine.timeline.width, engine.timeline.height);
  useLayoutEffect(() => {
    controller.show = (frame, playing) => { setShown({ frame, playing }); };
  }, [controller]);
  return (
    <>
      <div style={{ position: 'fixed', left, top, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        <Video engine={engine} frame={shown.frame} />
      </div>
      {studio ? <Status engine={engine} frame={shown.frame} playing={shown.playing} /> : null}
    </>
  );
}

/** What `window.__pitchInfo()` answers. */
function infoOf(engine: Engine): unknown {
  const { timeline } = engine;
  return {
    fps: timeline.fps,
    width: timeline.width,
    height: timeline.height,
    frames: timeline.frames,
    scenes: timeline.scenes.map((scene) => ({ type: scene.scene.type, from: scene.from, frames: scene.frames, still: stillFrame(scene, timeline.fps) })),
  };
}

/** The studio's keys and its playback, driving the page's frame. */
function studioKeys(engine: Engine, controller: Controller): void {
  const { timeline } = engine;
  const state = { frame: 0, playing: false, started: 0, from: 0 };
  const show = (frame: number): void => {
    state.frame = clamp(Math.round(frame), 0, timeline.frames - 1);
    controller.show(state.frame, state.playing);
  };
  const tick = (now: number): void => {
    if (!state.playing) return;
    show((state.from + ((now - state.started) / 1000) * timeline.fps) % timeline.frames);
    requestAnimationFrame(tick);
  };
  const starts = timeline.scenes.map((scene) => scene.from);
  const moves: Record<string, (shift: boolean) => number> = {
    ArrowRight: (shift) => state.frame + (shift ? 10 : 1),
    ArrowLeft: (shift) => state.frame - (shift ? 10 : 1),
    PageDown: () => starts.find((from) => from > state.frame) ?? state.frame,
    PageUp: () => starts.findLast((from) => from < state.frame) ?? 0,
    Home: () => 0,
  };
  window.addEventListener('keydown', (event) => {
    if (event.key === ' ') {
      state.playing = !state.playing;
      Object.assign(state, { started: performance.now(), from: state.frame });
      show(state.frame);
      if (state.playing) requestAnimationFrame(tick);
      return;
    }
    const move = moves[event.key];
    if (move === undefined) return;
    state.playing = false;
    show(move(event.shiftKey));
  });
}

/** Shows why the page cannot draw, on the page itself. */
function showProblem(container: HTMLElement, message: string): void {
  const block = document.createElement('pre');
  block.style.cssText = 'margin: 24px; font: 16px ui-monospace, monospace; white-space: pre-wrap';
  block.textContent = message;
  container.replaceChildren(block);
}

/** Loads the page's input and draws it, or shows why it cannot. */
export async function boot(page: string, container: HTMLElement): Promise<void> {
  const params = new URL(page).searchParams;
  const controller: Controller = { show: () => undefined };
  const ready = (async (): Promise<Engine> => {
    const url = inputUrl(page);
    const input = await fetchInput(url);
    const engine = engineOf(input, url);
    await loadFonts(engine, input.fonts.css, url);
    document.body.style.cssText = `margin: 0; overflow: hidden; background: ${engine.palette.shade}`;
    flushSync(() => { createRoot(container).render(<Player engine={engine} controller={controller} studio={params.has('studio')} />); });
    await settle();
    return engine;
  })();
  const seek = async (frame: number): Promise<void> => {
    const engine = await ready;
    flushSync(() => { controller.show(clamp(Math.round(frame), 0, engine.timeline.frames - 1), false); });
    await settle();
  };
  Object.assign(window, { [PAGE_SEEK]: seek, [PAGE_INFO]: async () => infoOf(await ready) });
  try {
    const engine = await ready;
    if (params.has('studio')) studioKeys(engine, controller);
    const events = params.get('events');
    if (events !== null) new EventSource(new URL(events, page)).onmessage = () => { window.location.reload(); };
  } catch (error) {
    showProblem(container, error instanceof Error ? error.message : String(error));
  }
}

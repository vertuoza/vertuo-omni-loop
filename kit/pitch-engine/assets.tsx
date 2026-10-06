// What a frame loads before it is captured (PRD 1108 s4): images, a clip's frame, a media's size. Each
// load registers a promise here, and `settle()` resolves once React has drawn the frame and every one
// of them has finished — so the capture never screenshots a half-loaded frame.
import { useLayoutEffect, useReducer, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { clamp } from './animation.ts';
import { useEngine } from './core.tsx';
import type { ClipFrames } from './input.ts';
import type { Media } from '../lib/pitch/storyboard.ts';

const pending = new Set<Promise<unknown>>();

/** Registers a load the next `settle()` waits for; a failed load counts as finished. */
function track(promise: Promise<unknown>): void {
  const tracked: Promise<unknown> = promise.catch(() => undefined).finally(() => pending.delete(tracked));
  pending.add(tracked);
}

const nextPaint = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => { done(); }));

const SETTLE_ROUNDS = 50;

/** Resolves once React has committed the frame and every load it started has finished. */
export async function settle(): Promise<void> {
  for (let round = 0; round < SETTLE_ROUNDS; round += 1) {
    await nextPaint();
    await nextPaint();
    if (pending.size === 0) return;
    await Promise.all([...pending]);
  }
  throw new Error('a frame never finished loading its media');
}

export type Size = Readonly<{ width: number; height: number }>;

const sizes = new Map<string, Size>();
const loading = new Map<string, Promise<Size>>();

function measure(url: string, clip: boolean): Promise<Size> {
  return new Promise((done, fail) => {
    if (clip) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.onloadedmetadata = () => { done({ width: video.videoWidth, height: video.videoHeight }); };
      video.onerror = () => { fail(new Error(`cannot load the clip ${url}`)); };
      video.src = url;
      return;
    }
    const image = new Image();
    image.onload = () => { done({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { fail(new Error(`cannot load the image ${url}`)); };
    image.src = url;
  });
}

/** The size of a media file, measured once: a decoded clip's from its input, any other from the file. */
function loadSize({ kind, file }: Media, resolve: (path: string) => string, frames: ClipFrames | undefined): Promise<Size> {
  const known = loading.get(file);
  if (known !== undefined) return known;
  const load = (frames === undefined ? measure(resolve(file), kind === 'clip') : Promise.resolve({ width: frames.width, height: frames.height })).then((size) => {
    sizes.set(file, size);
    return size;
  });
  loading.set(file, load);
  return load;
}

/** A media's size once known; the frame waits for it. */
export function useMediaSize(media: Media): Size | null {
  const { resolve, clips } = useEngine();
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  useLayoutEffect(() => {
    if (!sizes.has(media.file)) track(loadSize(media, resolve, clips[media.file]).then(redraw));
  }, [media, resolve, clips]);
  return sizes.get(media.file) ?? null;
}

/** An image the frame waits for until it is decoded. */
export function Picture({ src, style }: { src: string; style?: CSSProperties }): ReactNode {
  const ref = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    const image = ref.current;
    if (image === null) return;
    track(image.complete ? image.decode() : new Promise<void>((done) => {
      image.onload = () => { void image.decode().finally(done); };
      image.onerror = () => { done(); };
    }));
  }, [src]);
  return <img ref={ref} src={src} style={style} alt="" draggable={false} />;
}

const SEEK_TIMEOUT_MS = 5000;

/** Moves a clip to `seconds` and waits until it shows that frame. */
function seek(video: HTMLVideoElement, seconds: number): Promise<void> {
  if (Math.abs(video.currentTime - seconds) < 0.001 && video.readyState >= 2) return Promise.resolve();
  return new Promise((done) => {
    const timer = setTimeout(done, SEEK_TIMEOUT_MS);
    video.addEventListener('seeked', () => { clearTimeout(timer); done(); }, { once: true });
    video.currentTime = seconds;
  });
}

/** A clip at `seconds` of its file: the decoded image of that instant when the input has one, else the file sought there. */
export function ClipFrame({ file, seconds, style }: { file: string; seconds: number; style: CSSProperties }): ReactNode {
  const { resolve, clips } = useEngine();
  const ref = useRef<HTMLVideoElement>(null);
  const frames = clips[file];
  useLayoutEffect(() => {
    const video = ref.current;
    if (video !== null) track(seek(video, seconds));
  }, [seconds]);
  if (frames !== undefined) {
    const n = clamp(Math.floor(seconds * frames.fps) + 1, 1, frames.count);
    return <Picture src={resolve(frames.frames.replace('{n}', String(n)))} style={style} />;
  }
  return <video ref={ref} src={resolve(file)} muted playsInline preload="auto" style={style} />;
}

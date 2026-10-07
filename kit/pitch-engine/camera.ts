// The media's camera, its callouts and its cursor (PRD 1108 s4), as pure functions of the scene's time.
// Coordinates are 0..1 of the media, as the storyboard writes them; the camera turns them into pixels.
//
// - The camera zooms in log space, so a zoom from 1 to 4 spends as long doubling as it does doubling
//   again, and its move is clamped so no edge of the media ever shows.
// - A callout springs in at its time and fades out after its end; it is drawn where the camera shows
//   its box, so it follows every zoom.
// - The cursor appears just before its first key, glides between keys, and presses with a ripple on a
//   click.
import { EASINGS, SPRINGS, clamp, interpolate, mix, spring } from './animation.ts';
import type { Media } from '../lib/pitch/storyboard.ts';

type CameraKey = NonNullable<Media['camera']>[number];
type Callout = NonNullable<Media['callouts']>[number];
type CursorKey = NonNullable<Media['cursor']>[number];

export type Point = Readonly<{ x: number; y: number }>;
/** Where the camera looks: its zoom, and the point of the media at its centre. */
export type CameraState = Readonly<{ zoom: number; x: number; y: number }>;
/** The camera as a CSS move: scale by `zoom`, then translate by `x`, `y` pixels; `map` places a media point. */
export type CameraTransform = Readonly<{ zoom: number; x: number; y: number; map: (point: Point) => Point }>;

const ZOOM = Object.freeze({ min: 1, max: 4 });
const REST: CameraState = Object.freeze({ zoom: 1, x: 0.5, y: 0.5 });

const stateOf = (key: CameraKey): CameraState => ({ zoom: key.zoom, x: key.focus.x, y: key.focus.y });

/** The keys either side of time `t`, and how far between them it is, eased; or the key it rests on. */
function between<K extends { at: number }>(keys: readonly K[], t: number): { from: K; to: K; p: number } | undefined {
  const next = keys.findIndex((key) => t < key.at);
  if (next <= 0) return undefined;
  const from = keys[next - 1];
  const to = keys[next];
  if (from === undefined || to === undefined) return undefined;
  return { from, to, p: EASINGS.inOut(clamp((t - from.at) / (to.at - from.at))) };
}

/** The key time `t` rests on: the first before it starts, the last after it ends. */
const restingKey = <K extends { at: number }>(keys: readonly K[], t: number): K | undefined => (t < (keys[0]?.at ?? 0) ? keys[0] : keys.at(-1));

/** Where the camera looks at `t` seconds into the scene. */
export function sampleCamera(keys: readonly CameraKey[] | undefined, t: number): CameraState {
  const span = between(keys ?? [], t);
  if (span === undefined) {
    const key = restingKey(keys ?? [], t);
    return key === undefined ? REST : stateOf(key);
  }
  const [from, to] = [stateOf(span.from), stateOf(span.to)];
  return {
    zoom: Math.exp(mix(Math.log(from.zoom), Math.log(to.zoom), span.p)),
    x: mix(from.x, to.x, span.p),
    y: mix(from.y, to.y, span.p),
  };
}

/** The camera on a `width` × `height` surface: the focus centred, clamped so no edge shows. */
export function cameraTransform(state: CameraState, width: number, height: number): CameraTransform {
  const zoom = clamp(state.zoom, ZOOM.min, ZOOM.max);
  const x = clamp(width * (0.5 - zoom * state.x), width * (1 - zoom), 0);
  const y = clamp(height * (0.5 - zoom * state.y), height * (1 - zoom), 0);
  return { zoom, x, y, map: (point) => ({ x: x + zoom * point.x * width, y: y + zoom * point.y * height }) };
}

const CALLOUT_FADE = 0.3;

/** How present a callout is at `t`, 0 to 1: springing in from its time, fading out after its end. */
export function calloutPresence(callout: Callout, t: number, fps: number): number {
  const arrived = spring((t - callout.at) * fps, fps, SPRINGS.snappy);
  const left = callout.until === undefined ? 0 : interpolate(t, [callout.until, callout.until + CALLOUT_FADE], [0, 1]);
  return arrived * (1 - left);
}

/** The cursor at `t`: where it is (0..1 of the media), how visible, how pressed (1 is not), how far its click's ripple has spread (0 is none). */
export type CursorState = Readonly<{ x: number; y: number; opacity: number; press: number; ripple: number }>;

const APPEAR = Object.freeze({ before: 0.35, until: 0.05 });
const PRESS_SECONDS = 0.3;
const PRESS_DEPTH = 0.16;
const RIPPLE_SECONDS = 0.6;

/** Where the cursor is at `t`: between two keys, eased, or on the one it rests on. */
function cursorPosition(keys: readonly CursorKey[], t: number): Point {
  const span = between(keys, t);
  if (span !== undefined) return { x: mix(span.from.x, span.to.x, span.p), y: mix(span.from.y, span.to.y, span.p) };
  const key = restingKey(keys, t);
  return { x: key?.x ?? 0.5, y: key?.y ?? 0.5 };
}

/** How the last click before `t` presses the cursor and spreads its ripple. */
function clickAt(keys: readonly CursorKey[], t: number): { press: number; ripple: number } {
  const click = keys.findLast((key) => key.click === true && key.at <= t);
  const since = click === undefined ? Number.POSITIVE_INFINITY : t - click.at;
  return {
    press: since < PRESS_SECONDS ? 1 - PRESS_DEPTH * Math.sin((since / PRESS_SECONDS) * Math.PI) : 1,
    ripple: since < RIPPLE_SECONDS ? since / RIPPLE_SECONDS : 0,
  };
}

/** The cursor at `t` seconds into the scene, or nothing while it is hidden. */
export function cursorAt(keys: readonly CursorKey[] | undefined, t: number): CursorState | undefined {
  const first = keys?.[0];
  if (keys === undefined || first === undefined) return undefined;
  const opacity = interpolate(t, [first.at - APPEAR.before, first.at - APPEAR.until], [0, 1]);
  if (opacity <= 0) return undefined;
  return { ...cursorPosition(keys, t), opacity, ...clickAt(keys, t) };
}

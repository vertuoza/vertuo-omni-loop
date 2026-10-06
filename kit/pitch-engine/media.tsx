// A scene's media (PRD 1108 s4): a clip or a screenshot, cropped, in its device frame, with the camera's
// zoom, the callouts that follow it and the cursor that moves and clicks over it. Its time is the
// enclosing scene's or sequence's.
import type { CSSProperties, ReactNode } from 'react';
import { EASINGS, SPRINGS, interpolate, spring } from './animation.ts';
import { ClipFrame, Picture, useMediaSize } from './assets.tsx';
import type { Size } from './assets.tsx';
import { calloutPresence, cameraTransform, cursorAt, sampleCamera } from './camera.ts';
import type { CameraTransform } from './camera.ts';
import { useEngine, useSceneTime } from './core.tsx';
import { alpha } from './palette.ts';
import type { Media } from '../lib/pitch/storyboard.ts';

type Device = NonNullable<Media['device']>;
type Callout = NonNullable<Media['callouts']>[number];

const BROWSER_BAR = 52;
const PHONE_BEZEL = 18;
const LAPTOP_BEZEL = 16;
const LAPTOP_BASE = 28;
const FULL = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });

/** The device frame's padding around the media, in pixels: across and down. */
function chromeOf(device: Device): { across: number; down: number } {
  if (device === 'phone') return { across: PHONE_BEZEL * 2, down: PHONE_BEZEL * 2 };
  if (device === 'browser') return { across: 0, down: BROWSER_BAR };
  if (device === 'laptop') return { across: LAPTOP_BEZEL * 2, down: BROWSER_BAR + LAPTOP_BEZEL * 2 + LAPTOP_BASE };
  return { across: 0, down: 0 };
}

/** The media's box once fitted in `room`, its device frame included: `width` × `height` of media, `outer` with the frame. */
export type Fitted = Readonly<{ width: number; height: number; outer: Size }>;

/** The largest box of the media's proportions that fits in `room` with its device frame around it. */
export function fit(media: Media, size: Size, room: Size): Fitted {
  const crop = media.crop ?? FULL;
  const ratio = (size.width * crop.w) / (size.height * crop.h);
  const chrome = chromeOf(media.device ?? 'none');
  let width = room.width - chrome.across;
  let height = width / ratio;
  if (height + chrome.down > room.height) {
    height = room.height - chrome.down;
    width = height * ratio;
  }
  [width, height] = [Math.round(width), Math.round(height)];
  return { width, height, outer: { width: width + chrome.across, height: height + chrome.down } };
}

/** The media fitted in `room`, once its size is known. */
export function useFitted(media: Media, room: Size): Fitted | null {
  const size = useMediaSize(media);
  return size === null ? null : fit(media, size, room);
}

/** The second of the media's file a scene shows at `t` seconds: its start, at its rate, held at its end. */
const mediaSeconds = (media: Media, t: number): number => Math.min((media.start ?? 0) + t * (media.rate ?? 1), media.end ?? Number.POSITIVE_INFINITY);

/** The media itself, cropped and filmed by the camera, with its callouts and cursor over it. */
export function Surface({ media, fitted }: { media: Media; fitted: Fitted }): ReactNode {
  const { resolve, palette } = useEngine();
  const t = useSceneTime();
  const crop = media.crop ?? FULL;
  const { width, height } = fitted;
  const camera = cameraTransform(sampleCamera(media.camera, t), width, height);
  const content: CSSProperties = { position: 'absolute', left: (-crop.x * width) / crop.w, top: (-crop.y * height) / crop.h, width: width / crop.w, height: height / crop.h, objectFit: 'fill' };
  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden', background: palette.surface }}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
        {media.kind === 'clip' ? <ClipFrame file={media.file} seconds={mediaSeconds(media, t)} style={content} /> : <Picture src={resolve(media.file)} style={content} />}
      </div>
      {(media.callouts ?? []).map((callout, index) => (
        <CalloutMark key={index} callout={callout} t={t} camera={camera} />
      ))}
      <Cursor keys={media.cursor} t={t} camera={camera} />
    </div>
  );
}

const CALLOUT_PAD = 10;

/** A ring or a spotlight on a box of the media, where the camera shows it, and its label under it. */
function CalloutMark({ callout, t, camera }: { callout: Callout; t: number; camera: CameraTransform }): ReactNode {
  const { palette, fonts, timeline } = useEngine();
  const presence = calloutPresence(callout, t, timeline.fps);
  if (presence <= 0.001) return null;
  const start = camera.map({ x: callout.box.x, y: callout.box.y });
  const end = camera.map({ x: callout.box.x + callout.box.w, y: callout.box.y + callout.box.h });
  const box = { left: start.x - CALLOUT_PAD, top: start.y - CALLOUT_PAD, width: end.x - start.x + CALLOUT_PAD * 2, height: end.y - start.y + CALLOUT_PAD * 2 };
  const arrived = spring((t - callout.at) * timeline.fps, timeline.fps, SPRINGS.snappy);
  const dim = callout.kind === 'spotlight' ? `, 0 0 0 4000px ${alpha(palette.shade, 0.45 * presence)}` : `, 0 0 32px ${alpha(palette.accent, 0.45)}`;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          ...box,
          borderRadius: 14,
          border: `3px solid ${palette.accent}`,
          boxShadow: `0 0 0 6px ${alpha(palette.accent, 0.2)}${dim}`,
          opacity: presence,
          transform: `scale(${interpolate(arrived, [0, 1], [1.12, 1])})`,
        }}
      />
      {callout.label === undefined ? null : (
        <div
          style={{
            position: 'absolute',
            left: box.left,
            top: box.top + box.height + 14,
            padding: '10px 20px',
            borderRadius: 999,
            background: palette.ink,
            color: palette.paper,
            fontFamily: fonts.text.stack,
            fontWeight: 700,
            fontSize: 24,
            whiteSpace: 'nowrap',
            opacity: presence,
            translate: `0 ${(1 - arrived) * 12}px`,
          }}
        >
          {callout.label}
        </div>
      )}
    </>
  );
}

/** The cursor: an arrow in ink edged in paper, pressing on a click with a ripple in the accent. */
function Cursor({ keys, t, camera }: { keys: Media['cursor']; t: number; camera: CameraTransform }): ReactNode {
  const { palette } = useEngine();
  const state = cursorAt(keys, t);
  if (state === undefined) return null;
  const at = camera.map(state);
  const spread = EASINGS.out(state.ripple) * 40;
  return (
    <div style={{ position: 'absolute', left: at.x, top: at.y, opacity: state.opacity, pointerEvents: 'none' }}>
      {state.ripple > 0 ? (
        <div style={{ position: 'absolute', left: -spread, top: -spread, width: spread * 2, height: spread * 2, borderRadius: '50%', border: `3px solid ${palette.accent}`, background: alpha(palette.accent, 0.18), opacity: 1 - state.ripple }} />
      ) : null}
      <svg width="38" height="38" viewBox="0 0 24 24" style={{ transform: `translate(-6px, -3px) scale(${state.press})`, transformOrigin: '6px 3px', filter: `drop-shadow(0 4px 8px ${alpha(palette.shade, 0.35)})` }}>
        <path d="M5.5 2.8 L19.2 13.4 L12.6 14.2 L16.1 21.1 L13.2 22.4 L9.8 15.4 L5.5 19.6 Z" fill={palette.ink} stroke={palette.paper} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** A browser's bar: three dots on the card's ground. */
function BrowserBar(): ReactNode {
  const { palette } = useEngine();
  return (
    <div style={{ height: BROWSER_BAR, display: 'flex', alignItems: 'center', gap: 9, padding: '0 20px', background: palette.surface, borderBottom: `1px solid ${palette.hairline}` }}>
      {[0, 1, 2].map((dot) => (
        <div key={dot} style={{ width: 13, height: 13, borderRadius: '50%', background: palette.hairline }} />
      ))}
    </div>
  );
}

/** The device around a media: none, a browser, a laptop or a phone, in the look's colours. */
export function DeviceFrame({ device, children, style }: { device: Device; children: ReactNode; style?: CSSProperties }): ReactNode {
  const { palette } = useEngine();
  const shadow = `0 40px 100px -30px ${alpha(palette.shade, palette.dark ? 0.8 : 0.45)}`;
  if (device === 'phone') {
    return (
      <div style={{ padding: PHONE_BEZEL, borderRadius: 72, background: palette.shade, boxShadow: `${shadow}, inset 0 0 0 2px ${palette.hairline}`, ...style }}>
        <div style={{ position: 'relative', borderRadius: 56, overflow: 'hidden' }}>{children}</div>
      </div>
    );
  }
  if (device === 'none') return <div style={{ borderRadius: 18, overflow: 'hidden', boxShadow: shadow, border: `1px solid ${palette.hairline}`, ...style }}>{children}</div>;
  const browser = (
    <div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: device === 'browser' ? shadow : 'none', border: `1px solid ${palette.hairline}`, background: palette.surface }}>
      <BrowserBar />
      {children}
    </div>
  );
  if (device === 'browser') return <div style={style}>{browser}</div>;
  return (
    <div style={{ ...style, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ padding: LAPTOP_BEZEL, borderRadius: 28, background: palette.shade, boxShadow: shadow }}>{browser}</div>
      <div style={{ width: '112%', height: LAPTOP_BASE, borderRadius: '0 0 24px 24px', background: palette.hairline }} />
    </div>
  );
}

/** A media in its device frame. */
export function MediaCard({ media, fitted, style }: { media: Media; fitted: Fitted; style?: CSSProperties }): ReactNode {
  return (
    <DeviceFrame device={media.device ?? 'none'} {...(style === undefined ? {} : { style })}>
      <Surface media={media} fitted={fitted} />
    </DeviceFrame>
  );
}

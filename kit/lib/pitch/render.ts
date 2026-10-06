// `omni pitch render <dir> [--stills]` (PRD 1108's spec, "The engine, the studio and the render"): the
// run's storyboard drawn by the engine's page, frame by frame, through the capture provider, and encoded
// by the encode provider. Every outside tool is a provider reached through the registry; the page is
// served from memory by ./render-server.ts.
//
// 1. The settings, the music (through its provider, for its credit) and the page's `input.json`.
// 2. The page says what the video is: its frames and each scene's settled still frame.
// 3. With `--stills`: one image per scene, `stills/<nn>-<type>.png`, and `stills/contact-sheet.png`.
//    Without: every frame, encoded into `pitch.mp4` (1920×1080), `pitch-square.mp4` (1080×1080) and
//    `pitch.gif` (at most 8 s, 640 px wide), the music under the videos placed on the sync point; and the
//    intro's still as `slide.png` and `slide-square.png`, the two images every pushed pitch carries.
// 4. `pitch.json` records what was written, the music's provider, licence and credit, and the length.
//
// The frames are captured into `render/` of the run's folder, removed once the files are written.
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { DEFAULTS, providerFor } from './providers/registry.ts';
import type { Registry, Warn } from './providers/registry.ts';
import type { CaptureProvider, Exec, ProviderFetch, Launch, Shape } from './providers/types.ts';
import { RenderRefused, runAssets, runSettings, runStoryboard, writePageInput } from './render-input.ts';
import { audioOf, pickRunMusic } from './render-music.ts';
import type { MusicRecord, PickedMusic } from './render-music.ts';
import { contactSize, serveRun } from './render-server.ts';
import type { RunServer } from './render-server.ts';
import { readPitchJson, writePitchJson } from './run.ts';
import type { PitchSettings } from './settings.ts';
import type { Storyboard } from './storyboard.ts';

export { RenderRefused } from './render-input.ts';

/** The run's work folder, removed once the render is done. */
const WORK_DIR = 'render';
const STILLS_DIR = 'stills';
const CONTACT_SHEET = 'contact-sheet.png';
const SLIDES = Object.freeze({ wide: 'slide.png', square: 'slide-square.png' });
const SQUARE = 1080;
/** The five files every pushed pitch carries. */
const PITCH_FILES = Object.freeze([SLIDES.wide, SLIDES.square, 'pitch.mp4', 'pitch-square.mp4', 'pitch.gif']);
const SHAPES: readonly Shape[] = Object.freeze(['wide', 'square', 'gif']);

/** What the render reaches the world through: a child process, the network, a browser, and where a fallback's line goes. */
export type RenderTools = { cwd: string; exec: Exec; fetch: ProviderFetch; launch?: Launch | undefined; warn: Warn; registry?: Registry | undefined };

const PageInfoSchema = z.object({
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  frames: z.number().int().min(1),
  scenes: z.array(z.object({ type: z.string(), from: z.number().int().min(0), frames: z.number().int().min(1), still: z.number().int().min(0) })).min(1),
});
/** What the page says the video is. */
export type PageInfo = z.infer<typeof PageInfoSchema>;

/** What a render wrote, by path relative to the run's folder, and the video's length. */
export type Rendered = { files: string[]; seconds: number; music: MusicRecord };

/** A render's fixed parts: the run, its server, the capture provider and the tools. */
type Session = { dir: string; work: string; server: RunServer; capture: CaptureProvider; tools: RenderTools };

/** The page's report, checked: a page that could not draw says why. */
function infoOf(value: unknown): PageInfo {
  const parsed = PageInfoSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const error = typeof value === 'object' && value !== null && 'error' in value ? String(value.error) : parsed.error.message;
  throw new RenderRefused([`the page could not draw the storyboard: ${error}`]);
}

/** Captures the frames `frames` of the page at `url`, at a size, into a fresh folder; the files, in order. */
async function captureInto(session: Session, name: string, request: { url: string; count: number; width: number; height: number; pages?: number }): Promise<string[]> {
  const dir = join(session.work, name);
  mkdirSync(dir, { recursive: true });
  const { cwd, launch } = session.tools;
  return session.capture.frames(request, { dir, cwd, ...(launch === undefined ? {} : { launch }) });
}

/** Opens the page once, so it reports what the video is. */
async function askThePage(session: Session): Promise<PageInfo> {
  await captureInto(session, 'info', { url: session.server.page({ report: true }), count: 1, width: 640, height: 360, pages: 1 });
  return infoOf(await session.server.info());
}

/** Captures the given frames of the video at a size, and moves each to its name in the run. */
async function captureFrames(session: Session, { frames, names, width, height }: { frames: readonly number[]; names: readonly string[]; width: number; height: number }): Promise<string[]> {
  const captured = await captureInto(session, `frames-${String(width)}x${String(height)}`, { url: session.server.page({ frames: frames.join(',') }), count: frames.length, width, height });
  return captured.map((file, index) => {
    const name = names[index] ?? '';
    renameSync(file, join(session.dir, name));
    return name;
  });
}

/** One image per scene and the contact sheet of them, in `stills/`. */
async function writeStills(session: Session, info: PageInfo): Promise<string[]> {
  mkdirSync(join(session.dir, STILLS_DIR), { recursive: true });
  const names = info.scenes.map((scene, index) => `${STILLS_DIR}/${String(index + 1).padStart(2, '0')}-${scene.type}.png`);
  const stills = await captureFrames(session, { frames: info.scenes.map((scene) => scene.still), names, width: info.width, height: info.height });
  const [sheet] = await captureInto(session, 'contact', { url: session.server.contact(stills), count: 1, pages: 1, ...contactSize(stills.length) });
  const contact = `${STILLS_DIR}/${CONTACT_SHEET}`;
  renameSync(sheet ?? '', join(session.dir, contact));
  return [...stills, contact];
}

/** The second of the video the storyboard's music sync point falls on, or null. */
export function syncSecondsOf(storyboard: Storyboard, info: PageInfo): number | null {
  const sync = storyboard.meta.music?.sync;
  const scene = sync === undefined ? undefined : info.scenes[sync.scene];
  if (sync === undefined || scene === undefined) return null;
  return scene.from / info.fps + sync.at;
}

/** Every frame of the video, encoded into the three files; the intro's still as the two slides. */
async function writeVideos(session: Session, info: PageInfo, audio: ReturnType<typeof audioOf>): Promise<string[]> {
  const intro = info.scenes[0]?.still ?? 0;
  const slides = [
    ...(await captureFrames(session, { frames: [intro], names: [SLIDES.wide], width: info.width, height: info.height })),
    ...(await captureFrames(session, { frames: [intro], names: [SLIDES.square], width: SQUARE, height: SQUARE })),
  ];
  const framesDir = join(session.work, 'video');
  await captureInto(session, 'video', { url: session.server.page(), count: info.frames, width: info.width, height: info.height });
  const encode = providerFor('encode', DEFAULTS.encode, session.tools.warn, session.tools.registry);
  const videos: string[] = [];
  for (const shape of SHAPES) {
    const file = await encode.video({ frames: { dir: framesDir, count: info.frames, fps: info.fps }, audio, shape }, { dir: session.dir, exec: session.tools.exec });
    videos.push(file.slice(session.dir.length + 1));
  }
  return [...slides, ...videos];
}

/** The longest the storyboard can last, before its scenes overlap: what the music must cover. */
const longest = (storyboard: Storyboard): number => storyboard.scenes.reduce((sum, scene) => sum + scene.duration, 0);

/** Says, in one line, when the video's length is outside the settings' bounds. */
function warnOnLength(seconds: number, { min, max }: PitchSettings['length'], warn: Warn): void {
  if (seconds < min || seconds > max) warn(`length: the video lasts ${String(seconds)} s, outside the settings' ${String(min)} to ${String(max)} s`);
}

/** Serves the run, renders, and always closes the server and removes the work folder. */
async function inSession<T>(dir: string, tools: RenderTools, run: (session: Session) => Promise<T>): Promise<T> {
  const work = join(dir, WORK_DIR);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const server = await serveRun({ dir });
  try {
    return await run({ dir, work, server, capture: providerFor('capture', DEFAULTS.capture, tools.warn, tools.registry), tools });
  } finally {
    await server.close();
    rmSync(work, { recursive: true, force: true });
  }
}

/** The settings, the music and the page's input, before the page is opened. */
async function prepare(dir: string, tools: RenderTools): Promise<{ storyboard: Storyboard; settings: PitchSettings; music: PickedMusic }> {
  const storyboard = runStoryboard(dir);
  const settings = runSettings(dir);
  const music = await pickRunMusic(settings.music, { dir, seconds: longest(storyboard), fetch: tools.fetch, asset: runAssets(dir), warn: tools.warn, ...(tools.registry === undefined ? {} : { registry: tools.registry }) });
  await writePageInput(dir, { storyboard, settings, credits: music.credit === null ? [] : [music.credit], fetch: tools.fetch, warn: tools.warn });
  return { storyboard, settings, music };
}

/** Renders the run in `dir`: its stills, or its videos; what it wrote. Throws `RenderRefused` for a run that cannot be drawn. */
export async function renderRun(dir: string, { stills }: { stills: boolean }, tools: RenderTools): Promise<Rendered> {
  const { storyboard, settings, music } = await prepare(dir, tools);
  return inSession(dir, tools, async (session) => {
    const info = await askThePage(session);
    const seconds = Math.round((info.frames / info.fps) * 1000) / 1000;
    warnOnLength(seconds, settings.length, tools.warn);
    const files = stills ? await writeStills(session, info) : await writeVideos(session, info, audioOf(music, syncSecondsOf(storyboard, info)));
    const recorded = stills ? { stills: files } : { files: PITCH_FILES, seconds };
    writePitchJson(dir, { ...readPitchJson(dir), ...recorded, music: music.record });
    return { files, seconds, music: music.record };
  });
}

// A pitch run on the person's computer (PRD 859's spec, "/omni:pitch"): the four refusals it starts with,
// the run's folder, and the three steps the kit makes from the words and the walk-through — the cards,
// the music and the videos. Every outside tool (the browser that renders the cards, ffmpeg, ffprobe) is
// reached through an injected `exec`, so a test runs it on fixtures or stubs it.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecFileSyncOptions } from 'node:child_process';
import { PITCH_INPUTS, PITCH_VIDEOS, normaliseArgs, pitchRecipe } from './ffmpeg.ts';
import type { PitchCut } from './ffmpeg.ts';
import { pitchMusic } from './music.ts';
import { FRAME_FILE, SHAPES, SLIDE_FILES, slideHtml } from './slide.ts';
import type { Look, SlideWords } from './slide.ts';
import type { PrdNumber } from '../ids.ts';

export const AUDIENCES = Object.freeze(['customers', 'inside'] as const);
export type Audience = (typeof AUDIENCES)[number];

/** How a pitch runs a tool: `execFileSync`, or a test's fake; what it prints, as text or bytes. */
export type PitchExec = (file: string, args: readonly string[], options: ExecFileSyncOptions) => string | Buffer;

/** Renders one page to a PNG at `width`×`height`. */
export type Screenshot = (shot: { html: string; png: string; width: number; height: number }) => unknown;

/** The lines a pitch refuses with, each printed alone, before anything is written. */
export const REFUSAL = Object.freeze({
  notShipped: (prd: PrdNumber) => `PRD ${prd} is not shipped: a pitch is for shipped PRDs`,
  proofOff: 'proof is not configured here: run /omni:invade --refresh, or set proof.url in .omni-loop/config.yml',
  proofNotFixed: 'proof.url is github-deployment: a merged PRD has no preview to film; set a fixed proof.url',
  noFfmpeg: 'ffmpeg is needed for a pitch: brew install ffmpeg',
  noSignIn: 'no sign-in (omni signin)',
});

/**
 * The first reason a pitch of PRD `prd` cannot be made here, as its one line, or null. In the spec's
 * order: not shipped, `proof.url` not a fixed URL, no ffmpeg, no sign-in.
 */
export function pitchRefusal({ prd, shipped, proofUrl, ffmpeg, signedIn }: {
  prd: PrdNumber;
  shipped: boolean;
  proofUrl: string | null;
  ffmpeg: () => boolean;
  signedIn: () => boolean;
}): string | null {
  if (!shipped) return REFUSAL.notShipped(prd);
  if (proofUrl === null) return REFUSAL.proofOff;
  if (proofUrl === 'github-deployment') return REFUSAL.proofNotFixed;
  if (!ffmpeg()) return REFUSAL.noFfmpeg;
  if (!signedIn()) return REFUSAL.noSignIn;
  return null;
}

/** Whether `ffmpeg` runs on this computer's PATH. */
export function hasFfmpeg(exec: PitchExec): boolean {
  try {
    exec('ffmpeg', ['-version'], { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** A run's folder under the worktrees: `<worktrees>/pitch-<n>/<audience>-<YYYYMMDD-HHMMSS>`. */
export function pitchRunDir(worktrees: string, prd: PrdNumber, audience: Audience, now: Date = new Date()): string {
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return join(worktrees, `pitch-${prd}`, `${audience}-${stamp}`);
}

const PITCH_JSON = 'pitch.json';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** `pitch.json` of the run in `dir`, or null when there is none or it does not read. */
export function readPitchJson(dir: string): Record<string, unknown> | null {
  const file = join(dir, PITCH_JSON);
  if (!existsSync(file)) return null;
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

/** Writes `pitch.json` of the run in `dir`. */
export function writePitchJson(dir: string, value: Record<string, unknown>): void {
  writeFileSync(join(dir, PITCH_JSON), `${JSON.stringify(value, null, 2)}\n`);
}

/** The words a card needs, or the name of the first one `pitch.json` lacks. */
export function wordsOf(pitch: Record<string, unknown>): { words: SlideWords; missing?: undefined } | { missing: keyof SlideWords; words?: undefined } {
  const words: SlideWords = { kicker: '', hook: '', benefit: '', closing: '' };
  for (const key of ['kicker', 'hook', 'benefit', 'closing'] as const) {
    const value = pitch[key];
    if (typeof value !== 'string' || !value.trim()) return { missing: key };
    words[key] = value.trim();
  }
  return { words };
}

/** Renders one page to a PNG at `width`×`height` with the repository's Playwright. */
export function playwrightScreenshot(exec: PitchExec, { cwd }: { cwd: string }): Screenshot {
  return ({ html, png, width, height }) =>
    exec('npx', ['playwright', 'screenshot', '--viewport-size', `${width}, ${height}`, '--wait-for-selector', 'body[data-fit="done"]', `file://${html}`, png], {
      cwd,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
}

/** The cards of a run: copies the frame beside them, writes each card's page and renders it; the PNGs written, by name. */
export function renderSlides({ dir, look, words, frame, screenshot }: { dir: string; look: Look; words: SlideWords; frame: string; screenshot: Screenshot }): string[] {
  copyFileSync(frame, join(dir, FRAME_FILE));
  return SLIDE_FILES.map(({ card, shape, file }) => {
    const html = join(dir, file.replace(/\.png$/, '.html'));
    writeFileSync(html, slideHtml({ look, card, shape, words }));
    screenshot({ html, png: join(dir, file), ...SHAPES[shape] });
    return file;
  });
}

/** Writes the audience's music to the run's `music.wav`; its name. */
export function writeMusic(dir: string, audience: Audience): string {
  writeFileSync(join(dir, PITCH_INPUTS.music), pitchMusic(audience));
  return PITCH_INPUTS.music;
}

/** The length in seconds ffprobe reads of `file`, or NaN. */
function probeSeconds(exec: PitchExec, dir: string, file: string): number {
  const out = exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return Number.parseFloat(String(out).trim());
}

/** The videos of a run, made with ffmpeg in its folder from the cards, `walk.webm` and `music.wav`. */
export function makeVideos({ dir, exec }: { dir: string; exec: PitchExec }): { files: string[]; cut: PitchCut } {
  const run = (args: readonly string[]) => exec('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'] });
  run(normaliseArgs());
  const recipe = pitchRecipe({ walkSeconds: probeSeconds(exec, dir, PITCH_INPUTS.walkNormal) });
  for (const args of [recipe.wide, recipe.square, recipe.gif]) run(args);
  return { files: [...PITCH_VIDEOS], cut: recipe.cut };
}

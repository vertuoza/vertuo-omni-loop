// A pitch run on the person's computer (PRD 859's spec, "/omni:pitch"): the four refusals it starts with,
// the run's folder and its `pitch.json`, and (PRD 1108) the product's Pitch settings the run is made with:
// read from the Omni page when it starts, else the default preset's, said in one line. What the run is
// made into is the render's business (./render.ts). Every outside tool is reached through an injected
// `exec`, so a test stubs it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecFileSyncOptions } from 'node:child_process';
import type { PrdNumber } from '../ids.ts';
import { propertyOf } from '../narrow.ts';
import { DEFAULT_PRESET, defaultPitchSettings, parsePitchSettings } from './settings.ts';
import type { PitchSettings } from './settings.ts';

export const AUDIENCES = Object.freeze(['customers', 'inside'] as const);
export type Audience = (typeof AUDIENCES)[number];

/** How a pitch runs a tool: `execFileSync`, or a test's fake; what it prints, as text or bytes. */
export type PitchExec = (file: string, args: readonly string[], options: ExecFileSyncOptions) => string | Buffer;

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

/** The settings a run starts with, and the one line saying why they are not the product's, or null. */
export type StartSettings = { settings: PitchSettings; why: string | null };

/** The default preset's settings, with the line saying why the product's could not be had. */
const fallback = (reason: string): StartSettings => ({
  settings: defaultPitchSettings(),
  why: `settings: the ${DEFAULT_PRESET} preset (the product's Pitch settings could not be read: ${reason})`,
});

/**
 * The run's settings from what `GET /api/pitch-settings` answered (`{ settings }`), filled; or, when the
 * call failed (`failure`, its reason) or the answer is out of shape, the default preset's with one line.
 */
export function startSettings(answer: { reply: unknown } | { failure: string }): StartSettings {
  if ('failure' in answer) return fallback(answer.failure);
  const parsed = parsePitchSettings(propertyOf(answer.reply, 'settings') ?? null);
  return parsed.ok ? { settings: parsed.settings, why: null } : fallback(`out of shape, ${parsed.errors[0] ?? 'no settings'}`);
}

const ASSET = 'asset:';
const assetName = (ref: string | null | undefined): string | null => (ref?.startsWith(ASSET) ? ref.slice(ASSET.length) : null);

/** The names of the files the settings point at (`asset:<name>`): the logo, uploaded fonts, a music file. */
export function assetsOf({ look, music }: PitchSettings): string[] {
  const names = [look.logo, look.heading.family, look.text.family, music.file].map(assetName).filter((name) => name !== null);
  return [...new Set(names)];
}

/**
 * A Heading or Text font as the fonts provider is asked for it. A font uploaded to the product is stored
 * as the family `asset:<file>`: it is asked as the file's name without its extension, from that file.
 */
export function fontRequestOf({ provider, family, weight }: PitchSettings['look']['heading']): { provider: string; family: string; weight: number; asset?: string } {
  const file = assetName(family);
  if (file === null) return { provider, family, weight };
  return { provider, family: file.replace(/\.[^.]+$/, '') || file, weight, asset: family };
}


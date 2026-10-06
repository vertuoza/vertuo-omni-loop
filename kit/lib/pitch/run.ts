// A pitch run on the person's computer (PRD 859's spec, "/omni:pitch"): the four refusals it starts with,
// the run's folder and its `pitch.json`. What the run is made into is the render's business
// (./render.ts, PRD 1108). Every outside tool is reached through an injected `exec`, so a test stubs it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecFileSyncOptions } from 'node:child_process';
import type { PrdNumber } from '../ids.ts';

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


// The verbs of `omni pitch` that make a pitch on the person's computer, for `/omni:pitch` (PRD 859's spec,
// "/omni:pitch"); `push` sends it (`./pitch.ts`).
//
//   omni pitch start <n> --for customers|inside   refuses, or opens the run's folder and prints it
//   omni pitch slide <dir> --frame <png>           the slide, the closing card and the backdrop, each shape
//   omni pitch music <dir> --for customers|inside  the audience's default music, music.wav
//   omni pitch video <dir>                         pitch.mp4, pitch-square.mp4 and pitch.gif, with ffmpeg
//
// `start` refuses with one line and exit 1, writing nothing, when the PRD is not shipped, when proof.url
// is not a fixed URL, when ffmpeg is not on the PATH, or with no sign-in, in that order. Otherwise it makes
// `<worktrees>/pitch-<n>/<audience>-<time>/`, writes `pitch.json` there with the PRD, the audience, the
// product's look and the commit, and prints `{dir, look, url, commit}` as JSON: `url` is where the
// walk-through is filmed. A look the Omni page cannot answer is arcade, said in one line on stderr.
//
// The other three read and write the run folder only. `video` refuses without ffmpeg as `start` does, and
// records the five files of the pitch in `pitch.json`. A tool that fails (the browser or ffmpeg) is exit 1
// with one line; a folder missing what the verb reads is exit 2.
import { existsSync, mkdirSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { askClient, AskCallError } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { credentialsHost } from '../../lib/ask/credentials.ts';
import { loadContext } from '../../lib/context.ts';
import type { Context } from '../../lib/context.ts';
import { whereIs } from '../../lib/delivery/prd.ts';
import { isOneOf, propertyOf } from '../../lib/narrow.ts';
import { PITCH_INPUTS } from '../../lib/pitch/ffmpeg.ts';
import {
  AUDIENCES, REFUSAL, hasFfmpeg, makeVideos, pitchRefusal, pitchRunDir, playwrightScreenshot, readPitchJson,
  renderSlides, wordsOf, writeMusic, writePitchJson,
} from '../../lib/pitch/run.ts';
import type { Audience, Screenshot } from '../../lib/pitch/run.ts';
import { LOOKS } from '../../lib/pitch/slide.ts';
import type { Look } from '../../lib/pitch/slide.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { Exec, Out } from '../io.ts';
import type { PrdNumber } from '../../lib/ids.ts';

/** What a making verb is handed: the streams, the process runner, and what a test injects. */
export type MakerIo = {
  cwd: string;
  stdout: Out;
  stderr: Out;
  exec: Exec;
  tokens: TokenStore | undefined;
  home: string | undefined;
  fetch: Fetch;
  callMs: number | undefined;
  now: (() => Date) | undefined;
  screenshot: Screenshot | undefined;
};

type Verb = 'start' | 'slide' | 'music' | 'video';

const USAGE: Readonly<Record<Verb, string>> = {
  start: 'usage: omni pitch start <n> --for customers|inside',
  slide: 'usage: omni pitch slide <dir> --frame <png>',
  music: 'usage: omni pitch music <dir> --for customers|inside',
  video: 'usage: omni pitch video <dir>',
};

/** The five files of every pitch, as `pitch.json` lists them once the videos are made. */
const PITCH_FILES = Object.freeze(['slide.png', 'slide-square.png', 'pitch.mp4', 'pitch-square.mp4', 'pitch.gif']);

/** The one positional and the flags of a verb, or a usage error. */
function oneArg<V extends string = never>(verb: Verb, args: string[], values: readonly V[] = []): { arg: string; flags: { [K in V]: string } } {
  const { positional, flags } = parseArgs('pitch', args, { values });
  const [arg] = positional;
  const given: { [K in V]?: string } = flags;
  if (positional.length !== 1 || arg === undefined || !hasAll(given, values)) throw usageError(USAGE[verb]);
  return { arg, flags: given };
}

/** Whether `flags` holds a value for every one of `values`. */
function hasAll<V extends string>(flags: { [K in V]?: string }, values: readonly V[]): flags is { [K in V]: string } {
  return values.every((name) => flags[name] !== undefined);
}

function audienceOf(verb: Verb, value: string): Audience {
  if (!isOneOf(AUDIENCES, value)) throw usageError(`${USAGE[verb]} — --for is customers or inside, not ${value}`);
  return value;
}

const folderOf = (cwd: string, dir: string): string => (isAbsolute(dir) ? dir : resolve(cwd, dir));

/** The run folder `dir`, which must exist, or a usage error. */
function runFolder(verb: Verb, cwd: string, dir: string): string {
  const folder = folderOf(cwd, dir);
  if (!existsSync(folder)) throw usageError(`omni pitch ${verb}: ${dir} is not a run folder.`);
  return folder;
}

/** The first line a failed tool wrote, for its one line. */
function firstLine(error: unknown): string {
  const text = String(propertyOf(error, 'stderr') ?? propertyOf(error, 'message') ?? error).trim();
  return text.split('\n').find((line) => line.trim()) ?? 'failed';
}

function signedInStore(askUrl: string | null, { tokens, home }: { tokens: TokenStore | undefined; home: string | undefined }): TokenStore | null {
  if (!askUrl) return null;
  const store = tokens ?? homeTokens(home ? { home } : undefined);
  return store.read(credentialsHost(askUrl)) ? store : null;
}

/** The look of the repository's product, or arcade with the line saying why. */
async function lookOf({ askUrl, store, repo, fetch, callMs }: {
  askUrl: string;
  store: TokenStore;
  repo: string;
  fetch: Fetch;
  callMs: number | undefined;
}): Promise<{ look: Look; why?: string }> {
  try {
    const client = askClient({ baseUrl: askUrl, host: credentialsHost(askUrl), tokens: store, fetch, ...(callMs ? { callMs } : {}) });
    const look = propertyOf(await client.readPitchLook(repo), 'look');
    if (isOneOf(LOOKS, look)) return { look };
    return { look: 'arcade', why: `an unknown look ${String(look)}` };
  } catch (error) {
    return { look: 'arcade', why: error instanceof AskCallError && error.status ? `refused (${error.status})` : 'unreachable' };
  }
}

/** The four facts a pitch refuses on, read from this checkout and this computer. */
function refusalHere(ctx: Context, prd: PrdNumber, { exec, store }: { exec: Exec; store: TokenStore | null }): string | null {
  return pitchRefusal({
    prd,
    shipped: whereIs(ctx, prd)?.state === 'shipped',
    proofUrl: ctx.config.proof.url,
    ffmpeg: () => hasFfmpeg(exec),
    signedIn: () => store !== null,
  });
}

/** Makes the run folder with its first `pitch.json`; what `start` prints. */
function openRun(
  ctx: Context,
  { prd, audience, look, exec, now }: { prd: PrdNumber; audience: Audience; look: Look; exec: Exec; now: () => Date },
): { dir: string; look: Look; url: string | null; commit: string } {
  const commit = exec('git', ['rev-parse', 'HEAD'], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const dir = pitchRunDir(join(ctx.root, ctx.config.worktrees), prd, audience, now());
  mkdirSync(dir, { recursive: true });
  writePitchJson(dir, { prd, audience, look, commit });
  return { dir, look, url: ctx.config.proof.url, commit };
}

async function start(args: string[], { cwd, stdout, stderr, exec, tokens, home, fetch, callMs, now = () => new Date() }: MakerIo): Promise<number> {
  const { arg, flags } = oneArg('start', args, ['for']);
  const prd = prdArg('pitch start', '<n>', arg);
  const audience = audienceOf('start', flags.for);
  const ctx = loadContext(cwd, { exec });
  const askUrl = ctx.config.ask.url;
  const store = signedInStore(askUrl, { tokens, home });
  const refusal = refusalHere(ctx, prd, { exec, store });
  if (refusal !== null || store === null || !askUrl) {
    println(stderr, refusal ?? REFUSAL.noSignIn);
    return 1;
  }
  const repo = ctx.config.repo.slug;
  if (!repo) throw usageError('omni pitch: no repository slug — set repo.slug in the config.');
  const { look, why } = await lookOf({ askUrl, store, repo, fetch, callMs });
  if (why) println(stderr, `look: arcade (the product's look could not be read: ${why})`);
  println(stdout, JSON.stringify(openRun(ctx, { prd, audience, look, exec, now })));
  return 0;
}

function slide(args: string[], { cwd, stdout, stderr, exec, screenshot }: MakerIo): Promise<number> {
  const { arg, flags } = oneArg('slide', args, ['frame']);
  const dir = runFolder('slide', cwd, arg);
  const frame = folderOf(cwd, flags.frame);
  if (!existsSync(frame)) throw usageError(`omni pitch slide: no frame at ${flags.frame}.`);
  const pitch = readPitchJson(dir);
  const look = pitch?.look;
  if (!pitch || !isOneOf(LOOKS, look)) throw usageError(`omni pitch slide: ${arg} holds no pitch.json with a look — run omni pitch start first.`);
  const { words, missing } = wordsOf(pitch);
  if (missing) throw usageError(`omni pitch slide: pitch.json has no ${missing} yet.`);
  let files;
  try {
    files = renderSlides({ dir, look, words, frame, screenshot: screenshot ?? playwrightScreenshot(exec, { cwd: dir }) });
  } catch (error) {
    println(stderr, `slide render failed: ${firstLine(error)}`);
    return Promise.resolve(1);
  }
  for (const file of files) println(stdout, join(dir, file));
  return Promise.resolve(0);
}

function music(args: string[], { cwd, stdout }: MakerIo): Promise<number> {
  const { arg, flags } = oneArg('music', args, ['for']);
  const audience = audienceOf('music', flags.for);
  const dir = runFolder('music', cwd, arg);
  println(stdout, join(dir, writeMusic(dir, audience)));
  return Promise.resolve(0);
}

function video(args: string[], { cwd, stdout, stderr, exec }: MakerIo): Promise<number> {
  const { arg } = oneArg('video', args);
  const dir = runFolder('video', cwd, arg);
  if (!hasFfmpeg(exec)) {
    println(stderr, REFUSAL.noFfmpeg);
    return Promise.resolve(1);
  }
  const needed = [PITCH_INPUTS.walk, PITCH_INPUTS.music, PITCH_INPUTS.slide, PITCH_INPUTS.slideSquare, PITCH_INPUTS.close, PITCH_INPUTS.closeSquare, PITCH_INPUTS.backdropSquare];
  const missing = needed.find((name) => !existsSync(join(dir, name)));
  if (missing) throw usageError(`omni pitch video: ${arg} has no ${missing} yet.`);
  let made;
  try {
    made = makeVideos({ dir, exec });
  } catch (error) {
    println(stderr, `ffmpeg failed: ${firstLine(error)}`);
    return Promise.resolve(1);
  }
  writePitchJson(dir, { ...readPitchJson(dir), files: PITCH_FILES });
  for (const file of made.files) println(stdout, join(dir, file));
  println(stdout, `${made.cut.total} s: slide ${made.cut.slide} s, walk-through ${made.cut.walk} s, closing ${made.cut.close} s`);
  return Promise.resolve(0);
}

/** The making verbs of `omni pitch`, by name. */
export const PITCH_MAKERS: Readonly<Record<Verb, (args: string[], io: MakerIo) => Promise<number>>> = Object.freeze({ start, slide, music, video });

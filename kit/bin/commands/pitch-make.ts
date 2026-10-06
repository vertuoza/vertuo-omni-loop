// The verbs of `omni pitch` that make a pitch on the person's computer, for `/omni:pitch` (PRD 859's spec,
// "/omni:pitch", and PRD 1108's); `push` sends it (`./pitch.ts`).
//
//   omni pitch start <n> --for customers|inside   refuses, or opens the run's folder and prints it
//   omni pitch film <dir>                          films walk.json into walk.webm and moments.json
//   omni pitch check <dir>                         checks storyboard.json before it is rendered
//   omni pitch render <dir> [--stills]             the stills and contact sheet, or the three videos
//   omni pitch studio <dir> [--no-open]            the storyboard on a local page that reloads on change
//
// `start` refuses with one line and exit 1, writing nothing, when the PRD is not shipped, when proof.url
// is not a fixed URL, when ffmpeg is not on the PATH, or with no sign-in, in that order. Otherwise it makes
// `<worktrees>/pitch-<n>/<audience>-<time>/`, writes the product's Pitch settings there as `settings.json`
// (filled from their preset) and `pitch.json` with the PRD, the audience, the look's preset and the
// commit, and prints `{dir, look, url, commit}` as JSON: `url` is where the walk-through is filmed.
// Settings the Omni page cannot answer are the default preset's (arcade), said in one line on stderr; each
// file the settings point at (a logo, an uploaded font, a music file) is one line saying the run's
// `assets/` does not hold it yet.
//
// `film` (`../../lib/pitch/moments-film.ts`) plays the run's `walk.json` in the browser, read-only, and
// writes `walk.webm` and `moments.json`; it prints both, then one line per moment with its time, its box
// and the camera that shows it, then the clip's length. A step it refuses (a click that would change
// production, an element not on the page) or a walk.json out of shape is exit 1, each line on stderr,
// nothing written; without ffmpeg it refuses as `start` does.
//
// `check` reads `storyboard.json` (`../../lib/pitch/check.ts`): each error and each warning is one line on
// stderr, `error: <path>: <why>` or `warning: <path>: <why>`. An error is exit 1 and writes nothing;
// otherwise it prints the scenes and the length, writes the warnings to `pitch.json` under `warnings`, and
// exits 0. A folder with no storyboard.json is exit 2.
//
// `render` (`../../lib/pitch/render.ts`) refuses as `check` does a storyboard with an error, and, without
// `--stills`, refuses without ffmpeg as `start` does. It prints each file it wrote, then the length and the
// music's provider; a fallback (a provider not registered, a font or a track that cannot be had) is one line
// on stderr. A tool that fails (the browser, ffmpeg) is exit 1 with one line.
//
// `studio` (`../../lib/pitch/studio.ts`) prints the page's address, opens it in the browser (not with
// `--no-open`), and serves it until it is stopped (Ctrl-C), reloading the page when the storyboard or the
// settings change.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { askClient, AskCallError } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { credentialsHost } from '../../lib/ask/credentials.ts';
import { loadContext } from '../../lib/context.ts';
import type { Context } from '../../lib/context.ts';
import { whereIs } from '../../lib/delivery/prd.ts';
import { isOneOf, propertyOf } from '../../lib/narrow.ts';
import { checkRunFolder, findingLine } from '../../lib/pitch/check.ts';
import type { Launch, ProviderFetch } from '../../lib/pitch/providers/types.ts';
import { MOMENTS_FILE, WALK_CLIP } from '../../lib/pitch/moments.ts';
import type { Moments } from '../../lib/pitch/moments.ts';
import { FilmRefused, filmRun, repositoryBrowser } from '../../lib/pitch/moments-film.ts';
import type { FilmLaunch } from '../../lib/pitch/moments-film.ts';
import { RUN_SETTINGS } from '../../lib/pitch/render-input.ts';
import { RenderRefused, renderRun } from '../../lib/pitch/render.ts';
import { AUDIENCES, REFUSAL, assetsOf, hasFfmpeg, pitchRefusal, pitchRunDir, readPitchJson, startSettings, writePitchJson } from '../../lib/pitch/run.ts';
import type { Audience, StartSettings } from '../../lib/pitch/run.ts';
import type { PitchSettings } from '../../lib/pitch/settings.ts';
import { STORYBOARD_FILE } from '../../lib/pitch/storyboard.ts';
import { openStudio } from '../../lib/pitch/studio.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { Exec, Out } from '../io.ts';
import type { PrdNumber } from '../../lib/ids.ts';
import { openInBrowser } from './signin.ts';

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
  /** Opens the browser the render captures with: the repository's Playwright, unless a test hands one. */
  launch: Launch | undefined;
  /** Opens the browser the walk-through is filmed in: the repository's Playwright, unless a test hands one. */
  film: FilmLaunch | undefined;
  /** Opens the studio's page: the person's browser, unless a test hands another. */
  openBrowser: ((url: string) => unknown) | undefined;
  /** Resolves when the studio should stop: Ctrl-C, unless a test hands another. */
  studioUntil: ((url: string) => Promise<void>) | undefined;
};

type Verb = 'start' | 'film' | 'check' | 'render' | 'studio';

const USAGE: Readonly<Record<Verb, string>> = {
  start: 'usage: omni pitch start <n> --for customers|inside',
  film: 'usage: omni pitch film <dir>',
  check: 'usage: omni pitch check <dir>',
  render: 'usage: omni pitch render <dir> [--stills]',
  studio: 'usage: omni pitch studio <dir> [--no-open]',
};

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

/** The Pitch settings of the repository's product, or the default preset's with the line saying why. */
async function settingsOf({ askUrl, store, repo, fetch, callMs }: {
  askUrl: string;
  store: TokenStore;
  repo: string;
  fetch: Fetch;
  callMs: number | undefined;
}): Promise<StartSettings> {
  try {
    const client = askClient({ baseUrl: askUrl, host: credentialsHost(askUrl), tokens: store, fetch, ...(callMs ? { callMs } : {}) });
    return startSettings({ reply: await client.readPitchSettings(repo) });
  } catch (error) {
    return startSettings({ failure: error instanceof AskCallError && error.status ? `refused (${error.status})` : 'unreachable' });
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

/** Makes the run folder with its settings and its first `pitch.json`; what `start` prints. */
function openRun(
  ctx: Context,
  { prd, audience, settings, exec, now }: { prd: PrdNumber; audience: Audience; settings: PitchSettings; exec: Exec; now: () => Date },
): { dir: string; look: string; url: string | null; commit: string } {
  const commit = exec('git', ['rev-parse', 'HEAD'], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const dir = pitchRunDir(join(ctx.root, ctx.config.worktrees), prd, audience, now());
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, RUN_SETTINGS), `${JSON.stringify(settings, null, 2)}\n`);
  const look = settings.look.preset;
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
  const { settings, why } = await settingsOf({ askUrl, store, repo, fetch, callMs });
  if (why !== null) println(stderr, why);
  const opened = openRun(ctx, { prd, audience, settings, exec, now });
  for (const name of assetsOf(settings)) println(stderr, `asset: the settings name ${name}; put it in the run's assets/ folder, or the video goes without it`);
  println(stdout, JSON.stringify(opened));
  return 0;
}

/** One moment as `film` prints it: its time, its box and the camera that shows it. */
const momentLine = ({ name, do: act, at, box, focus, zoom }: Moments['steps'][number]): string =>
  `${name}: ${act} at ${String(at)} s, box x ${String(box.x)} y ${String(box.y)} w ${String(box.w)} h ${String(box.h)}, camera zoom ${String(zoom)} on x ${String(focus.x)} y ${String(focus.y)}`;

async function film(args: string[], { cwd, stdout, stderr, exec, film: launch }: MakerIo): Promise<number> {
  const { arg } = oneArg('film', args);
  const dir = runFolder('film', cwd, arg);
  if (!hasFfmpeg(exec)) {
    println(stderr, REFUSAL.noFfmpeg);
    return 1;
  }
  let moments: Moments;
  try {
    moments = await filmRun(dir, { exec, launch: launch ?? repositoryBrowser(cwd) });
  } catch (error) {
    for (const line of error instanceof FilmRefused ? error.lines : [`film failed: ${firstLine(error)}`]) println(stderr, line);
    return 1;
  }
  println(stdout, join(dir, WALK_CLIP));
  println(stdout, join(dir, MOMENTS_FILE));
  for (const moment of moments.steps) println(stdout, momentLine(moment));
  println(stdout, `${String(moments.seconds)} s`);
  return 0;
}

function check(args: string[], { cwd, stdout, stderr }: MakerIo): Promise<number> {
  const { arg } = oneArg('check', args);
  const dir = runFolder('check', cwd, arg);
  if (!existsSync(join(dir, STORYBOARD_FILE))) throw usageError(`omni pitch check: ${arg} holds no ${STORYBOARD_FILE} yet.`);
  const { errors, warnings, scenes, seconds } = checkRunFolder(dir);
  for (const finding of errors) println(stderr, `error: ${findingLine(finding)}`);
  for (const finding of warnings) println(stderr, `warning: ${findingLine(finding)}`);
  if (errors.length) return Promise.resolve(1);
  writePitchJson(dir, { ...readPitchJson(dir), warnings: warnings.map(findingLine) });
  println(stdout, `storyboard: ${scenes} scenes, ${seconds} s, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
  return Promise.resolve(0);
}

/** The run folder `dir` holding a storyboard, or a usage error. */
function storyboardFolder(verb: Verb, cwd: string, dir: string): string {
  const folder = runFolder(verb, cwd, dir);
  if (!existsSync(join(folder, STORYBOARD_FILE))) throw usageError(`omni pitch ${verb}: ${dir} holds no ${STORYBOARD_FILE} yet.`);
  return folder;
}

/** The network as the providers ask it: the same fetch, with no options when they give none. */
const providerFetch = (fetch: Fetch): ProviderFetch => (url, init) => fetch(url, { ...init });

/** Says each error the check finds in the run's storyboard; whether there was none. */
function checked(dir: string, stderr: Out): boolean {
  const { errors } = checkRunFolder(dir);
  for (const finding of errors) println(stderr, `error: ${findingLine(finding)}`);
  return errors.length === 0;
}

/** The one line a render that failed is reported with, or each line of a refusal. */
function failureLines(error: unknown): string[] {
  if (error instanceof RenderRefused) return error.lines.map((line) => `error: ${line}`);
  return [`render failed: ${firstLine(error)}`];
}

/** The one folder and the one switch a verb takes, or a usage error. */
function folderAndSwitch(verb: 'render' | 'studio', args: string[], name: string): { arg: string; on: boolean } {
  const { positional, flags } = parseArgs('pitch', args, { booleans: [name] });
  const [arg] = positional;
  if (positional.length !== 1 || arg === undefined) throw usageError(USAGE[verb]);
  return { arg, on: flags[name] === true };
}

async function render(args: string[], { cwd, stdout, stderr, exec, fetch, launch }: MakerIo): Promise<number> {
  const { arg, on: stills } = folderAndSwitch('render', args, 'stills');
  const dir = storyboardFolder('render', cwd, arg);
  if (!checked(dir, stderr)) return 1;
  if (!stills && !hasFfmpeg(exec)) {
    println(stderr, REFUSAL.noFfmpeg);
    return 1;
  }
  let rendered;
  try {
    rendered = await renderRun(dir, { stills }, { cwd, exec, fetch: providerFetch(fetch), launch, warn: (line) => { println(stderr, line); } });
  } catch (error) {
    for (const line of failureLines(error)) println(stderr, line);
    return 1;
  }
  for (const file of rendered.files) println(stdout, join(dir, file));
  println(stdout, `${String(rendered.seconds)} s, music: ${rendered.music.provider}${rendered.music.licence === null ? '' : ` (${rendered.music.licence})`}`);
  return 0;
}

/** Resolves on Ctrl-C or a termination signal. */
const untilStopped = (): Promise<void> =>
  new Promise((done) => {
    const stop = (): void => {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      done();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  });

async function studio(args: string[], { cwd, stdout, stderr, fetch, openBrowser = openInBrowser, studioUntil = untilStopped }: MakerIo): Promise<number> {
  const { arg, on: noOpen } = folderAndSwitch('studio', args, 'no-open');
  const dir = storyboardFolder('studio', cwd, arg);
  let opened;
  try {
    opened = await openStudio(dir, { fetch: providerFetch(fetch), warn: (line) => { println(stderr, line); } });
  } catch (error) {
    if (!(error instanceof RenderRefused)) throw error;
    for (const line of error.lines) println(stderr, line);
    return 1;
  }
  println(stdout, opened.url);
  println(stdout, 'space plays, the arrows step a frame, page up and page down jump a scene; Ctrl-C stops');
  try {
    if (!noOpen) await openBrowser(opened.url);
  } catch {
    // The address is printed: a browser that does not open is no failure.
  }
  try {
    await studioUntil(opened.url);
  } finally {
    await opened.close();
  }
  return 0;
}

/** The making verbs of `omni pitch`, by name. */
export const PITCH_MAKERS: Readonly<Record<Verb, (args: string[], io: MakerIo) => Promise<number>>> = Object.freeze({ start, film, check, render, studio });

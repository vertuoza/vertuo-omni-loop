// The verbs of `omni pitch` that make a pitch on the person's computer, for `/omni:pitch` (PRD 859's spec,
// "/omni:pitch"); `push` sends it (`./pitch.mjs`).
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
import { askClient } from '../../lib/ask/client.mjs';
import { homeTokens } from '../../lib/ask/client-tokens.mjs';
import { credentialsHost } from '../../lib/ask/credentials.mjs';
import { loadContext } from '../../lib/context.mjs';
import { whereIs } from '../../lib/delivery/prd.mjs';
import { PITCH_INPUTS } from '../../lib/pitch/ffmpeg.mjs';
import {
  AUDIENCES, REFUSAL, hasFfmpeg, makeVideos, pitchRefusal, pitchRunDir, playwrightScreenshot, readPitchJson,
  renderSlides, wordsOf, writeMusic, writePitchJson,
} from '../../lib/pitch/run.mjs';
import { LOOKS } from '../../lib/pitch/slide.mjs';
import { parseArgs, positiveInt, println, usageError } from '../args.mjs';

const USAGE = {
  start: 'usage: omni pitch start <n> --for customers|inside',
  slide: 'usage: omni pitch slide <dir> --frame <png>',
  music: 'usage: omni pitch music <dir> --for customers|inside',
  video: 'usage: omni pitch video <dir>',
};

/** The five files of every pitch, as `pitch.json` lists them once the videos are made. */
const PITCH_FILES = Object.freeze(['slide.png', 'slide-square.png', 'pitch.mp4', 'pitch-square.mp4', 'pitch.gif']);

/** The one positional and the flags of a verb, or a usage error. */
function oneArg(verb, args, values = []) {
  const { positional, flags } = parseArgs('pitch', args, { values });
  if (positional.length !== 1 || values.some((name) => flags[name] === undefined)) throw usageError(USAGE[verb]);
  return { arg: positional[0], flags };
}

function audienceOf(verb, value) {
  if (!AUDIENCES.includes(value)) throw usageError(`${USAGE[verb]} — --for is customers or inside, not ${value}`);
  return value;
}

const folderOf = (cwd, dir) => (isAbsolute(dir) ? dir : resolve(cwd, dir));

/** The run folder `dir`, which must exist, or a usage error. */
function runFolder(verb, cwd, dir) {
  const folder = folderOf(cwd, dir);
  if (!existsSync(folder)) throw usageError(`omni pitch ${verb}: ${dir} is not a run folder.`);
  return folder;
}

/** The first line a failed tool wrote, for its one line. */
function firstLine(error) {
  const text = String(error?.stderr ?? error?.message ?? error).trim();
  return text.split('\n').find((line) => line.trim()) ?? 'failed';
}

function signedInStore(askUrl, { tokens, home }) {
  if (!askUrl) return null;
  const store = tokens ?? homeTokens(home ? { home } : undefined);
  return store.read(credentialsHost(askUrl)) ? store : null;
}

/** The look of the repository's product, or arcade with the line saying why. */
async function lookOf({ askUrl, store, repo, fetch, callMs }) {
  try {
    const client = askClient({ baseUrl: askUrl, host: credentialsHost(askUrl), tokens: store, fetch, ...(callMs ? { callMs } : {}) });
    const { look } = await client.readPitchLook(repo);
    if (LOOKS.includes(look)) return { look };
    return { look: 'arcade', why: `an unknown look ${String(look)}` };
  } catch (error) {
    return { look: 'arcade', why: error?.status ? `refused (${error.status})` : 'unreachable' };
  }
}

async function start(args, { cwd, stdout, stderr, exec, tokens, home, fetch, callMs, now }) {
  const { arg, flags } = oneArg('start', args, ['for']);
  const prd = positiveInt('pitch start', '<n>', arg);
  const audience = audienceOf('start', flags.for);
  const ctx = loadContext(cwd, { exec });
  const askUrl = ctx.config.ask?.url ?? null;
  const store = signedInStore(askUrl, { tokens, home });
  const proofUrl = ctx.config.proof?.url ?? null;
  const refusal = pitchRefusal({
    prd,
    shipped: whereIs(ctx, prd)?.state === 'shipped',
    proofUrl,
    ffmpeg: () => hasFfmpeg(exec),
    signedIn: () => store !== null,
  });
  if (refusal) {
    println(stderr, refusal);
    return 1;
  }
  const repo = ctx.config.repo.slug;
  if (!repo) throw usageError('omni pitch: no repository slug — set repo.slug in the config.');
  const { look, why } = await lookOf({ askUrl, store, repo, fetch, callMs });
  if (why) println(stderr, `look: arcade (the product's look could not be read: ${why})`);
  const commit = String(exec('git', ['rev-parse', 'HEAD'], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).trim();
  const dir = pitchRunDir(join(ctx.root, ctx.config.worktrees), prd, audience, now ? now() : new Date());
  mkdirSync(dir, { recursive: true });
  writePitchJson(dir, { prd, audience, look, commit });
  println(stdout, JSON.stringify({ dir, look, url: proofUrl, commit }));
  return 0;
}

function slide(args, { cwd, stdout, stderr, exec, screenshot }) {
  const { arg, flags } = oneArg('slide', args, ['frame']);
  const dir = runFolder('slide', cwd, arg);
  const frame = folderOf(cwd, flags.frame);
  if (!existsSync(frame)) throw usageError(`omni pitch slide: no frame at ${flags.frame}.`);
  const pitch = readPitchJson(dir);
  if (!pitch || !LOOKS.includes(pitch.look)) throw usageError(`omni pitch slide: ${arg} holds no pitch.json with a look — run omni pitch start first.`);
  const { words, missing } = wordsOf(pitch);
  if (missing) throw usageError(`omni pitch slide: pitch.json has no ${missing} yet.`);
  let files;
  try {
    files = renderSlides({ dir, look: pitch.look, words, frame, screenshot: screenshot ?? playwrightScreenshot(exec, { cwd: dir }) });
  } catch (error) {
    println(stderr, `slide render failed: ${firstLine(error)}`);
    return 1;
  }
  for (const file of files) println(stdout, join(dir, file));
  return 0;
}

function music(args, { cwd, stdout }) {
  const { arg, flags } = oneArg('music', args, ['for']);
  const audience = audienceOf('music', flags.for);
  const dir = runFolder('music', cwd, arg);
  println(stdout, join(dir, writeMusic(dir, audience)));
  return 0;
}

function video(args, { cwd, stdout, stderr, exec }) {
  const { arg } = oneArg('video', args);
  const dir = runFolder('video', cwd, arg);
  if (!hasFfmpeg(exec)) {
    println(stderr, REFUSAL.noFfmpeg);
    return 1;
  }
  const needed = [PITCH_INPUTS.walk, PITCH_INPUTS.music, PITCH_INPUTS.slide, PITCH_INPUTS.slideSquare, PITCH_INPUTS.close, PITCH_INPUTS.closeSquare, PITCH_INPUTS.backdropSquare];
  const missing = needed.find((name) => !existsSync(join(dir, name)));
  if (missing) throw usageError(`omni pitch video: ${arg} has no ${missing} yet.`);
  let made;
  try {
    made = makeVideos({ dir, exec });
  } catch (error) {
    println(stderr, `ffmpeg failed: ${firstLine(error)}`);
    return 1;
  }
  writePitchJson(dir, { ...readPitchJson(dir), files: PITCH_FILES });
  for (const file of made.files) println(stdout, join(dir, file));
  println(stdout, `${made.cut.total} s: slide ${made.cut.slide} s, walk-through ${made.cut.walk} s, closing ${made.cut.close} s`);
  return 0;
}

/** The making verbs of `omni pitch`, by name. */
export const PITCH_MAKERS = Object.freeze({ start, slide, music, video });

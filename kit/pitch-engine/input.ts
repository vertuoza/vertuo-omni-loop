// What the engine's page renders (PRD 1108 s4): one JSON file, `input.json` beside the page or the one
// `?input=<url>` names, written by whoever serves the page (the render, the studio). Every path in it,
// and every media path in the storyboard, is read relative to that file's address.
//
// - `storyboard`: the storyboard, checked by its own schema (kit/lib/pitch/storyboard.ts).
// - `look`: the product's look, checked and filled by the settings' schema (kit/lib/pitch/settings.ts).
// - `fonts`: the `@font-face` rules a fonts provider wrote and the CSS stacks of the Heading and Text
//   fonts; without them the page names the look's families and falls back on the system's.
// - `logo`: the look's logo as a file the page can load, or none.
// - `credits`: the lines the outro shows when its storyboard asks for credits (the music's, for one).
// - `clips`: a clip already decoded into numbered images, so a frame shows exactly the image it should
//   (`{n}` in `frames` is the image's number, from 1); a clip not listed plays from its file.
import { z } from 'zod';
import { parsePitchSettings } from '../lib/pitch/settings.ts';
import type { PitchLook } from './palette.ts';
import { parseStoryboard } from '../lib/pitch/storyboard.ts';
import type { Storyboard } from '../lib/pitch/storyboard.ts';

const ClipFramesSchema = z.strictObject({
  frames: z.string().includes('{n}'),
  fps: z.number().positive(),
  count: z.number().int().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type ClipFrames = z.infer<typeof ClipFramesSchema>;

const InputSchema = z.strictObject({
  storyboard: z.unknown(),
  look: z.unknown(),
  fonts: z.strictObject({ css: z.string().optional(), heading: z.string().optional(), text: z.string().optional() }).optional(),
  logo: z.string().min(1).nullable().optional(),
  credits: z.array(z.string()).optional(),
  clips: z.record(z.string(), ClipFramesSchema).optional(),
});

export type PageInput = Readonly<{
  storyboard: Storyboard;
  look: PitchLook;
  fonts: { css?: string | undefined; heading?: string | undefined; text?: string | undefined };
  logo: string | null;
  credits: readonly string[];
  clips: Readonly<Record<string, ClipFrames>>;
}>;

export type ParsedInput = { input: PageInput; problems?: undefined } | { problems: string[]; input?: undefined };

const at = (prefix: string, path: string): string => (path === '' ? prefix : `${prefix}.${path}`);

/** The page's input, or every problem in it as `<path>: <why>`. */
export function parseInput(value: unknown): ParsedInput {
  const parsed = InputSchema.safeParse(value);
  if (!parsed.success) return { problems: parsed.error.issues.map((issue) => `${issue.path.map(String).join('.') || '(top level)'}: ${issue.message}`) };
  const storyboard = parseStoryboard(parsed.data.storyboard);
  const settings = parsePitchSettings({ look: parsed.data.look ?? {} });
  const problems = [
    ...(storyboard.problems ?? []).map((problem) => `${at('storyboard', problem.path)}: ${problem.message}`),
    ...(settings.ok ? [] : settings.errors),
  ];
  if (storyboard.storyboard === undefined || !settings.ok || problems.length > 0) return { problems };
  const { fonts = {}, logo = null, credits = [], clips = {} } = parsed.data;
  return { input: { storyboard: storyboard.storyboard, look: settings.settings.look, fonts, logo, credits, clips } };
}

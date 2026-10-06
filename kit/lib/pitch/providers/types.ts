// A pitch's outside tools, one interface per kind (PRD 1108's spec, "Providers"). A provider is one
// file under its kind's folder and one line of the registry; nothing else names it. Every port a
// provider reaches the world through (the network, a product's uploaded files, a browser, a child
// process) is passed in, so a test runs every provider on fakes.
import type { ExecFileSyncOptions } from 'node:child_process';

export const KINDS = Object.freeze(['music', 'fonts', 'capture', 'encode'] as const);
export type Kind = (typeof KINDS)[number];

/** What a network answer must offer: the global `fetch`'s answer meets it. */
export type FetchAnswer = { ok: boolean; status: number; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> };
/** The network: the global `fetch`, or a test's fake. */
export type ProviderFetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<FetchAnswer>;
/** A product's uploaded file (`asset:logo.svg`) as a path on this computer. */
export type AssetResolver = (ref: string) => Promise<string>;
/** How a provider runs a tool: `execFileSync`, or a test's fake. */
export type Exec = (file: string, args: readonly string[], options: ExecFileSyncOptions) => string | Buffer;

/** A music request: the settings' mood (and file, for an uploaded track) and the video's length. */
export type MusicRequest = { mood: string; seconds: number; asset?: string };
/** A track written in the run's folder, its licence and its credit (null when none is owed). */
export type Track = { file: string; licence: string | null; credit: string | null };
export type MusicContext = { dir: string; fetch: ProviderFetch; asset: AssetResolver };
export type MusicProvider = { kind: 'music'; id: string; pick(request: MusicRequest, context: MusicContext): Promise<Track> };

/** A font request: a family and a weight, and the uploaded file for a product's own font. */
export type FontRequest = { family: string; weight: number; asset?: string };
/** The `@font-face` rules (their files relative to the run's folder), the files written, and the CSS family stack to use. */
export type LoadedFont = { css: string; files: string[]; stack: string };
export type FontsContext = { dir: string; fetch: ProviderFetch; asset: AssetResolver };
export type FontsProvider = { kind: 'fonts'; id: string; load(request: FontRequest, context: FontsContext): Promise<LoadedFont> };

/** The few calls of a browser page a capture makes; Playwright's page meets them. */
export type CapturePage = {
  goto(url: string): Promise<unknown>;
  evaluate(expression: string): Promise<unknown>;
  screenshot(options: { path: string }): Promise<unknown>;
};
/** A browser that opens pages at a size; Playwright's browser meets it. */
export type CaptureBrowser = { newPage(options: { viewport: { width: number; height: number } }): Promise<CapturePage>; close(): Promise<void> };
/** Opens a browser: Playwright's `chromium.launch`, or a test's fake. */
export type Launch = () => Promise<CaptureBrowser>;
/** Frames `0..count-1` of the page at `url`, each a PNG in `dir`; `pages` pages capture in parallel. */
export type FramesRequest = { url: string; count: number; width: number; height: number; pages?: number };
export type CaptureContext = { dir: string; cwd: string; launch?: Launch };
export type CaptureProvider = { kind: 'capture'; id: string; frames(request: FramesRequest, context: CaptureContext): Promise<string[]> };

/** The three files a pitch is encoded into. */
export const SHAPES = Object.freeze(['wide', 'square', 'gif'] as const);
export type Shape = (typeof SHAPES)[number];
/** Frames on disk (`frame-00000.png`… in `dir`) at `fps`; the music under them, starting `start` seconds into the track. */
export type EncodeRequest = { frames: { dir: string; count: number; fps: number }; audio: { file: string; start?: number } | null; shape: Shape };
export type EncodeContext = { dir: string; exec: Exec };
export type EncodeProvider = { kind: 'encode'; id: string; video(request: EncodeRequest, context: EncodeContext): Promise<string> };

export type ProviderOf = { music: MusicProvider; fonts: FontsProvider; capture: CaptureProvider; encode: EncodeProvider };

/** The page's hook a capture calls before each frame: `window[PAGE_SEEK](n)` settles frame `n`. */
export const PAGE_SEEK = '__pitchSeek';

/** Frame `n`'s file name; `FRAME_PATTERN` is the same name as ffmpeg reads a sequence. */
export const frameFile = (n: number): string => `frame-${String(n).padStart(5, '0')}.png`;
export const FRAME_PATTERN = 'frame-%05d.png';

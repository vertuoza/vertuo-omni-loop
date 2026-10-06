// The fakes the providers' tests run on, one per port: the network, a product's uploaded files, a
// browser and a child process. No test of a provider reaches the network, a browser or ffmpeg through
// them.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { AssetResolver, CaptureBrowser, Exec, Fetch, FetchAnswer } from './types.ts';

/** The first bytes of an MP3 with an ID3 tag. */
export const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a]);
/** The first bytes of a WOFF2 file. */
export const WOFF2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0x00, 0x01, 0x00, 0x00]);

/** What a faked address answers: a status alone, text, or bytes. */
type Body = number | string | Uint8Array;

function answerOf(body: Body): FetchAnswer {
  const status = typeof body === 'number' ? body : 200;
  const bytes = typeof body === 'number' ? new Uint8Array() : typeof body === 'string' ? new TextEncoder().encode(body) : body;
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(new TextDecoder().decode(bytes)),
    arrayBuffer: () => Promise.resolve(bytes.slice().buffer),
  };
}

/** A network that answers by the first route whose test matches the address, else 404; the calls it took. */
export function fakeFetch(routes: readonly (readonly [RegExp, Body | ((url: string) => Body)])[]): { fetch: Fetch; calls: { url: string; headers: Record<string, string> }[] } {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetch: Fetch = (url, init) => {
    calls.push({ url, headers: init?.headers ?? {} });
    const route = routes.find(([test]) => test.test(url));
    const body = route === undefined ? 404 : typeof route[1] === 'function' ? route[1](url) : route[1];
    return Promise.resolve(answerOf(body));
  };
  return { fetch, calls };
}

/** A Google Fonts stylesheet naming `files` font files, as the CSS API answers one. */
export const googleSheet = (family: string, weight: number, files: readonly string[]): string =>
  files.map((file) => `@font-face {\n  font-family: '${family}';\n  font-weight: ${String(weight)};\n  src: url(https://fonts.gstatic.com/s/${file}.woff2) format('woff2');\n}\n`).join('');

/** The network every provider's contract runs on: the font API, its files and the music archive. */
export const contractNetwork = (): ReturnType<typeof fakeFetch> =>
  fakeFetch([
    [/^https:\/\/fonts\.googleapis\.com\//, googleSheet('Gantari', 700, ['gantari/v1/latin', 'gantari/v1/latin-ext'])],
    [/^https:\/\/fonts\.gstatic\.com\//, WOFF2],
    [/^https:\/\/archive\.org\/download\//, MP3],
  ]);

/** A fresh empty folder. */
export const scratch = (name: string): string => mkdtempSync(join(tmpdir(), `pitch-${name}-`));

/** A product's uploaded files, written to a folder of their own: `asset:<name>` resolves to its path. */
export function fakeAssets(files: Readonly<Record<string, Body>>): AssetResolver {
  const dir = scratch('assets');
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), typeof body === 'number' ? '' : body);
  return (ref) => {
    const name = ref.replace(/^asset:/, '');
    return name in files ? Promise.resolve(join(dir, name)) : Promise.reject(new Error(`no uploaded file ${ref}`));
  };
}

/** A browser whose pages write an empty file for each screenshot; what it was asked, in order. */
export function fakeBrowser(): { launch: () => Promise<CaptureBrowser>; log: string[] } {
  const log: string[] = [];
  const browser: CaptureBrowser = {
    newPage: ({ viewport }) => {
      log.push(`page ${String(viewport.width)}x${String(viewport.height)}`);
      return Promise.resolve({
        goto: (url) => Promise.resolve(log.push(`goto ${url}`)),
        evaluate: (expression) => Promise.resolve(log.push(`evaluate ${expression}`)),
        screenshot: ({ path }) => {
          writeFileSync(path, '');
          return Promise.resolve();
        },
      });
    },
    close: () => Promise.resolve(void log.push('close')),
  };
  return { launch: () => Promise.resolve(browser), log };
}

/** A child process that writes the file its last argument names in its folder; the calls it took. */
export function fakeExec(): { exec: Exec; calls: { file: string; args: readonly string[] }[] } {
  const calls: { file: string; args: readonly string[] }[] = [];
  const exec: Exec = (file, args, options) => {
    calls.push({ file, args });
    const output = args.at(-1);
    if (output !== undefined && typeof options.cwd === 'string') writeFileSync(join(options.cwd, basename(output)), '');
    return '';
  };
  return { exec, calls };
}

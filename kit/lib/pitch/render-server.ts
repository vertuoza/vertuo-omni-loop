// The small local server `omni pitch render` and `omni pitch studio` open the engine's page through (PRD
// 1108 s6). It answers on 127.0.0.1 only:
//
// - `/engine/index.html` and `/engine/engine.js`: the engine page (./render-page.ts). Two queries the page
//   itself does not read add a few lines to it: `frames=<a>,<b>,…` makes `__pitchSeek(n)` settle the nth
//   frame of that list, so a capture of a few frames takes exactly the scenes' stills; `report` posts what
//   `__pitchInfo()` answers to `/info`, so the render learns the video's length and stills from the page.
// - `/run/<path>`: a file of the run's folder, never one outside it.
// - `/contact.html?files=<a>,<b>,…`: the contact sheet, the run's images three to a row, each named.
// - `/events`: an event stream the studio's page listens to; `notify()` sends it one message.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { PAGE_SEEK } from './providers/types.ts';
import { PAGE_INFO, PAGE_INPUT, enginePage } from './render-page.ts';
import type { EnginePage } from './render-page.ts';

const TYPES: Readonly<Record<string, string>> = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.css': 'text/css',
});

/** The contact sheet's tiles: three to a row, each a third of the frame wide. */
const CONTACT = Object.freeze({ columns: 3, width: 640, height: 360 });

/** How long the render waits for the page to report what the video is. */
const INFO_WAIT_MS = 120_000;

export type RunServer = {
  origin: string;
  /** The engine page's address on this server, with its queries. */
  page(query?: Readonly<Record<string, string | true>>): string;
  /** The contact sheet's address for these images of the run. */
  contact(files: readonly string[]): string;
  /** What the page reported of the video, once a page opened with `report` has. */
  info(): Promise<unknown>;
  /** Sends the studio's page one message: it reloads. */
  notify(): void;
  close(): Promise<void>;
};

const script = (code: string): string => `<script>${code}</script>`;

/** The page's HTML, with what its queries add. */
export function pageHtml(html: string, params: URLSearchParams): string {
  const added: string[] = [];
  const frames = params.get('frames');
  if (frames !== null) {
    const list = JSON.stringify(frames.split(',').map(Number));
    added.push(script(`(function(){var seek=window.${PAGE_SEEK};var frames=${list};window.${PAGE_SEEK}=function(n){return seek(frames[n]);};})();`));
  }
  if (params.has('report')) {
    const post = "function(body){return fetch('/info',{method:'POST',body:JSON.stringify(body)});}";
    added.push(script(`(function(){var post=${post};window.${PAGE_INFO}().then(post,function(e){post({error:String(e&&e.message||e)});});})();`));
  }
  return added.length === 0 ? html : html.replace('</body>', `${added.join('')}</body>`);
}

const escapeHtml = (text: string): string => text.replace(/[&<>"]/g, (char) => `&#${String(char.charCodeAt(0))};`);

/** The contact sheet's page: the images three to a row, each named; its seek waits for every image. */
export function contactHtml(files: readonly string[]): string {
  const { columns, width, height } = CONTACT;
  const tiles = files
    .map((file) => `<figure><img src="/run/${encodeURI(file)}"><figcaption>${escapeHtml(file.split('/').pop() ?? file)}</figcaption></figure>`)
    .join('');
  const style = [
    'body{margin:0;background:#111;display:grid;grid-template-columns:repeat(' + String(columns) + ',' + String(width) + 'px)}',
    `figure{margin:0;position:relative;width:${String(width)}px;height:${String(height)}px}`,
    'img{width:100%;height:100%;display:block;object-fit:contain}',
    'figcaption{position:absolute;left:8px;bottom:8px;font:14px ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.6);padding:2px 6px;border-radius:4px}',
  ].join('');
  const seek = `window.${PAGE_SEEK}=function(){return Promise.all(Array.from(document.images).map(function(i){return i.decode();}));};`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${style}</style></head><body>${tiles}${script(seek)}</body></html>`;
}

/** The contact sheet's size for `count` images. */
export const contactSize = (count: number): { width: number; height: number } => ({
  width: CONTACT.columns * CONTACT.width,
  height: Math.max(1, Math.ceil(count / CONTACT.columns)) * CONTACT.height,
});

/** The file of the run's folder `dir` a path under `/run/` names, or null for one outside it or missing. */
export function runFile(dir: string, path: string): string | null {
  const root = resolve(dir);
  const file = resolve(root, path);
  if (!file.startsWith(`${root}${sep}`) || !existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

type Answer = { status: number; type?: string; body?: string | Buffer };

const found = (body: string | Buffer, type: string): Answer => ({ status: 200, type, body });

const HTML = TYPES['.html'] ?? '';

/** The pages the server makes, by path: the engine page with what its queries add, and the contact sheet. */
const MADE: Readonly<Record<string, (page: EnginePage, params: URLSearchParams) => Answer>> = Object.freeze({
  '/engine/index.html': (page, params) => found(pageHtml(page['index.html'], params), HTML),
  '/engine/engine.js': (page) => found(page['engine.js'], TYPES['.js'] ?? ''),
  '/contact.html': (_, params) => found(contactHtml((params.get('files') ?? '').split(',').filter(Boolean)), HTML),
});

/** A file of the run, under `/run/`, or 404. */
function runAnswer(dir: string, path: string): Answer {
  const file = path.startsWith('/run/') ? runFile(dir, path.slice('/run/'.length)) : null;
  if (file === null) return { status: 404 };
  return found(readFileSync(file), TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream');
}

/** The answer to a GET of `url`, for the run in `dir`. */
function answerGet(dir: string, page: EnginePage, url: URL): Answer {
  const path = decodeURIComponent(url.pathname);
  const made = Object.hasOwn(MADE, path) ? MADE[path] : undefined;
  return made === undefined ? runAnswer(dir, path) : made(page, url.searchParams);
}

/** A promise and the function that settles it. */
function deferred<T>(): { promise: Promise<T>; settle: (value: T) => void } {
  let settle: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    settle = done;
  });
  return { promise, settle };
}

/** Reads a request's body as text. */
const bodyOf = (request: IncomingMessage): Promise<string> =>
  new Promise((done, fail) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      done(Buffer.concat(chunks).toString('utf8'));
    });
    request.on('error', fail);
  });

const parsedOrText = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
};

/** Serves the engine page and the run's folder `dir` on a free port of 127.0.0.1. */
export async function serveRun({ dir, page = enginePage() }: { dir: string; page?: EnginePage }): Promise<RunServer> {
  const listeners = new Set<ServerResponse>();
  const reported = deferred<unknown>();
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method === 'POST' && url.pathname === '/info') {
      void bodyOf(request).then((text) => {
        reported.settle(parsedOrText(text));
        response.writeHead(204).end();
      });
      return;
    }
    if (url.pathname === '/events') {
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      response.write(': open\n\n');
      listeners.add(response);
      request.on('close', () => listeners.delete(response));
      return;
    }
    const answer = answerGet(dir, page, url);
    response.writeHead(answer.status, answer.type === undefined ? {} : { 'content-type': answer.type, 'cache-control': 'no-store' }).end(answer.body);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  const origin = `http://127.0.0.1:${String(typeof address === 'object' && address !== null ? address.port : 0)}`;
  return {
    origin,
    page: (query = {}) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) params.set(key, value === true ? '' : value);
      params.set('input', `/run/${PAGE_INPUT}`);
      return `${origin}/engine/index.html?${params.toString()}`;
    },
    contact: (files) => `${origin}/contact.html?files=${files.map(encodeURIComponent).join(',')}`,
    info: () => {
      let timer: NodeJS.Timeout | undefined;
      const late = new Promise<never>((_, fail) => {
        timer = setTimeout(() => {
          fail(new Error(`the page did not say what the video is within ${String(INFO_WAIT_MS / 1000)} s`));
        }, INFO_WAIT_MS);
      });
      return Promise.race([reported.promise, late]).finally(() => {
        clearTimeout(timer);
      });
    },
    notify: () => {
      for (const listener of listeners) listener.write('data: reload\n\n');
    },
    close: () =>
      new Promise<void>((done) => {
        for (const listener of listeners) listener.end();
        server.closeAllConnections();
        server.close(() => {
          done();
        });
      }),
  };
}

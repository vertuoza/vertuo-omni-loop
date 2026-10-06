// The local server of the render and the studio (PRD 1108 s6): the engine page from memory with what its
// queries add, the run's files and never one outside it, the page's report, the contact sheet, and the
// studio's event stream.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { contactHtml, contactSize, pageHtml, runFile, serveRun } from './render-server.ts';
import type { RunServer } from './render-server.ts';

const PAGE = Object.freeze({ 'index.html': '<!doctype html><html><body><div id="root"></div><script src="engine.js"></script></body></html>', 'engine.js': 'window.engine = 1;' });

function runDir(): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'pitch-serve-')), 'run');
  mkdirSync(dir);
  writeFileSync(join(dir, 'input.json'), '{"storyboard":1}');
  mkdirSync(join(dir, 'shots'));
  writeFileSync(join(dir, 'shots/a.png'), 'png');
  writeFileSync(join(dir, '..', 'pitch-serve-secret.txt'), 'secret');
  return dir;
}

let served: RunServer | undefined;
afterEach(async () => {
  await served?.close();
  served = undefined;
});

describe('pageHtml', () => {
  it('is the built page as it is, with no query of its own', () => {
    expect(pageHtml(PAGE['index.html'], new URLSearchParams('input=/run/input.json&studio'))).toBe(PAGE['index.html']);
  });

  it('with frames, makes the seek hook settle the nth frame of the list; with report, posts what the page says', () => {
    const html = pageHtml(PAGE['index.html'], new URLSearchParams('frames=12,40,77&report'));
    expect(html).toContain('var frames=[12,40,77];window.__pitchSeek=function(n){return seek(frames[n]);}');
    expect(html).toContain("window.__pitchInfo().then(post");
    expect(html).toContain("fetch('/info',{method:'POST'");
    expect(html.indexOf('engine.js')).toBeLessThan(html.indexOf('__pitchSeek'));
  });
});

describe('the contact sheet', () => {
  it('lays the images three to a row, each named, and its seek waits for every image', () => {
    const html = contactHtml(['stills/01-intro.png', 'stills/02-outro.png']);
    expect(html).toContain('<img src="/run/stills/01-intro.png"><figcaption>01-intro.png</figcaption>');
    expect(html).toContain('repeat(3,640px)');
    expect(html).toContain('window.__pitchSeek=function(){return Promise.all(');
    expect(contactSize(2)).toEqual({ width: 1920, height: 360 });
    expect(contactSize(4)).toEqual({ width: 1920, height: 720 });
    expect(contactSize(6)).toEqual({ width: 1920, height: 720 });
  });
});

describe('runFile', () => {
  it("is a file of the run's folder, never one outside it, nor a folder", () => {
    const dir = runDir();
    expect(runFile(dir, 'shots/a.png')).toBe(join(dir, 'shots/a.png'));
    expect(runFile(dir, '../pitch-serve-secret.txt')).toBeNull();
    expect(runFile(dir, 'shots')).toBeNull();
    expect(runFile(dir, 'missing.png')).toBeNull();
  });
});

describe('serveRun', () => {
  it('serves the engine page from memory and the run under /run/, on 127.0.0.1', async () => {
    served = await serveRun({ dir: runDir(), page: PAGE });
    expect(served.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const url = served.page({ studio: true, events: '/events' });
    expect(url).toBe(`${served.origin}/engine/index.html?studio=&events=%2Fevents&input=%2Frun%2Finput.json`);
    const page = await fetch(url);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toBe(PAGE['index.html']);
    expect(await (await fetch(`${served.origin}/engine/engine.js`)).text()).toBe(PAGE['engine.js']);
    const input = await fetch(`${served.origin}/run/input.json`);
    expect(input.headers.get('content-type')).toBe('application/json');
    expect(await input.text()).toBe('{"storyboard":1}');
    expect((await fetch(`${served.origin}/run/shots/a.png`)).headers.get('content-type')).toBe('image/png');
  });

  it('answers 404 outside the run, for a missing file, and for any other path', async () => {
    served = await serveRun({ dir: runDir(), page: PAGE });
    for (const path of ['/run/%2e%2e/pitch-serve-secret.txt', '/run/missing.png', '/elsewhere', '/engine/other.js']) {
      expect((await fetch(`${served.origin}${path}`)).status, path).toBe(404);
    }
  });

  it("hands over what the page reports, and the contact sheet's page", async () => {
    served = await serveRun({ dir: runDir(), page: PAGE });
    const posted = await fetch(`${served.origin}/info`, { method: 'POST', body: JSON.stringify({ frames: 90 }) });
    expect(posted.status).toBe(204);
    await expect(served.info()).resolves.toEqual({ frames: 90 });
    const contact = await fetch(served.contact(['stills/01-intro.png']));
    expect(await contact.text()).toContain('/run/stills/01-intro.png');
  });

  it('sends the event stream one message on notify', async () => {
    served = await serveRun({ dir: runDir(), page: PAGE });
    const stream = await fetch(`${served.origin}/events`);
    expect(stream.headers.get('content-type')).toBe('text/event-stream');
    const reader = (stream.body ?? new ReadableStream<Uint8Array>()).getReader();
    const decoder = new TextDecoder();
    let text = decoder.decode((await reader.read()).value);
    served.notify();
    while (!text.includes('data: reload')) text += decoder.decode((await reader.read()).value);
    expect(text).toContain('data: reload\n\n');
    await reader.cancel();
  });
});

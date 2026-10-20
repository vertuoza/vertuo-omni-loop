// PRD 2239, s3: the diagrams of a before/after page (spec §3). Each `<pre class="mermaid">` becomes the
// SVG Mermaid draws for it, inline, inside a `<figure class="mermaid-diagram" data-source="…">` that
// keeps the source, so a later render redraws it. The browser is a provider passed in, as the pitch's
// capture is (`../pitch/providers/capture/playwright.ts`): a test hands a fake, none starts Chromium or
// reaches the network. Mermaid is loaded from jsDelivr, at one pinned version, when the page is written.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeEntities } from '../design/words/html.ts';
import { firstPart, propertyOf } from '../narrow.ts';

/** The one Mermaid version drawn with: a later PRD may vendor it (spec, decision 5). */
const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js';
const PACKAGES = ['playwright', '@playwright/test'];

/** The few calls of a browser page a render makes; Playwright's page meets them. */
export type RenderPage = { setContent(html: string): Promise<unknown>; evaluate(expression: string): Promise<unknown> };
/** A browser that opens a page; Playwright's browser meets it. */
export type RenderBrowser = { newPage(): Promise<RenderPage>; close(): Promise<void> };
/** Opens a browser: the repository's Playwright Chromium, or a test's fake. */
export type RenderLaunch = () => Promise<RenderBrowser>;

/** What a render came to: the page left alone (`unavailable`), or its new text with what was drawn and what Mermaid refused. */
export type Rendered =
  | { kind: 'unavailable'; why: string }
  | { kind: 'done'; html: string; drawn: string[]; refused: { place: string; reason: string }[] };

const isBrowser = (value: unknown): value is RenderBrowser => typeof propertyOf(value, 'newPage') === 'function';
const isLauncher = (value: unknown): value is { launch(): Promise<unknown> } => typeof propertyOf(value, 'launch') === 'function';

/** The nearest folder from `cwd` up whose `node_modules` holds `name`, or null: only the repository's own install counts, never a global one (`NODE_PATH`). */
function installedIn(cwd: string, name: string): string | null {
  for (let dir = cwd; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'node_modules', name, 'package.json'))) return dir;
    if (dirname(dir) === dir) return null;
  }
}

/** Chromium from the Playwright the repository at `cwd` installed. */
export function repositoryLaunch(cwd: string): RenderLaunch {
  return async () => {
    for (const name of PACKAGES) {
      const home = installedIn(cwd, name);
      if (home === null) continue;
      const resolved = createRequire(join(home, 'package.json')).resolve(name);
      const loaded: unknown = await import(pathToFileURL(resolved).href);
      const chromium = propertyOf(loaded, 'chromium') ?? propertyOf(propertyOf(loaded, 'default'), 'chromium');
      if (!isLauncher(chromium)) continue;
      const browser = await chromium.launch();
      if (isBrowser(browser)) return browser;
    }
    throw new Error('Playwright is not installed in this repository');
  };
}

/** A diagram found in the page: where its element sits, its source and where it is (`<section> of <service>`). */
type Found = { start: number; end: number; source: string; place: string };

// An unrendered `<pre class="mermaid">` (group 1: its text), or a rendered `<figure class="mermaid-diagram">` (group 2: its data-source).
const DIAGRAM =
  /<pre\b[^>]*\bclass\s*=\s*["'][^"']*\bmermaid\b[^"']*["'][^>]*>([\s\S]*?)<\/pre>|<figure\b[^>]*\bclass\s*=\s*["']mermaid-diagram["'][^>]*\bdata-source\s*=\s*"([^"]*)"[^>]*>[\s\S]*?<\/figure>/g;

/** The value of the last `attribute="…"` in `text`, or null. */
function lastAttribute(text: string, attribute: string): string | null {
  const all = [...text.matchAll(new RegExp(`\\b${attribute}\\s*=\\s*"([^"]*)"`, 'g'))];
  return all.at(-1)?.[1] ?? null;
}

/** `<section> of <service>`: the service is the one opened in the tab since its marker; the flow and the deploy order have none, so they are the page's. */
function placeOf(before: string): string {
  const tab = before.lastIndexOf('data-tab=');
  const service = lastAttribute(before.slice(Math.max(tab, 0)), 'data-service');
  return `${lastAttribute(before, 'data-section') ?? 'diagram'} of ${service ?? 'the page'}`;
}

function findDiagrams(html: string): Found[] {
  return [...html.matchAll(DIAGRAM)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    source: match[2] === undefined ? decodeEntities(match[1] ?? '').trim() : decodeEntities(match[2]),
    place: placeOf(html.slice(0, match.index)),
  }));
}

const escapeAttribute = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const figure = (source: string, svg: string): string => `<figure class="mermaid-diagram" data-source="${escapeAttribute(source)}">${svg}</figure>`;

const PAGE = `<!doctype html><html><body><script src="${MERMAID_URL}"></script><script>if (window.mermaid) mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });</script></body></html>`;

/** The expression a page evaluates to draw `source`: `{ svg }`, `{ error }` for a source Mermaid refuses, `{ missing }` when Mermaid never loaded. */
const drawing = (source: string, id: string): string => `(async () => {
  if (typeof mermaid === 'undefined') return { missing: true };
  try {
    const { svg } = await mermaid.render(${JSON.stringify(id)}, ${JSON.stringify(source)});
    return { svg };
  } catch (error) {
    return { error: String((error && error.message) || error) };
  }
})()`;

type Drawn = { svg: string } | { error: string } | 'missing';

async function draw(page: RenderPage, source: string, id: string): Promise<Drawn> {
  const answer = await page.evaluate(drawing(source, id));
  if (propertyOf(answer, 'missing') === true) return 'missing';
  const svg = propertyOf(answer, 'svg');
  if (typeof svg === 'string') return { svg };
  const error = propertyOf(answer, 'error');
  return { error: typeof error === 'string' ? error : 'Mermaid drew nothing' };
}

const whyOf = (error: unknown): string => firstPart(error instanceof Error ? error.message : String(error), '\n');

/** `html` with each diagram of `found` replaced by its drawing in `results`, and what was drawn and refused. */
function assemble(html: string, found: readonly Found[], results: readonly Drawn[]): Extract<Rendered, { kind: 'done' }> {
  let text = '';
  let cursor = 0;
  const drawn: string[] = [];
  const refused: { place: string; reason: string }[] = [];
  for (const [index, diagram] of found.entries()) {
    const result = results[index];
    text += html.slice(cursor, diagram.start);
    cursor = diagram.end;
    if (result !== undefined && typeof result === 'object' && 'svg' in result) {
      text += figure(diagram.source, result.svg);
      drawn.push(diagram.place);
    } else {
      text += html.slice(diagram.start, diagram.end);
      refused.push({ place: diagram.place, reason: firstPart(typeof result === 'object' && 'error' in result ? result.error : '', '\n') });
    }
  }
  return { kind: 'done', html: text + html.slice(cursor), drawn, refused };
}

/**
 * Draws every diagram of `html` (rendered ones again, from their `data-source`) through the browser
 * `launch` opens. A browser that does not start, or a Mermaid that did not load, leaves the page
 * alone (`unavailable`); a diagram Mermaid refuses stays as it was and is named, the others drawn.
 */
export async function renderDiagrams({ html, launch }: { html: string; launch: RenderLaunch }): Promise<Rendered> {
  const found = findDiagrams(html);
  if (found.length === 0) return { kind: 'done', html, drawn: [], refused: [] };
  let browser: RenderBrowser;
  try {
    browser = await launch();
  } catch (error) {
    return { kind: 'unavailable', why: whyOf(error) };
  }
  try {
    const page = await browser.newPage();
    await page.setContent(PAGE);
    const results: Drawn[] = [];
    for (const [index, diagram] of found.entries()) {
      const result = await draw(page, diagram.source, `mermaid-${String(index)}`);
      if (result === 'missing') return { kind: 'unavailable', why: 'Mermaid did not load from jsDelivr: is the network reachable?' };
      results.push(result);
    }
    return assemble(html, found, results);
  } catch (error) {
    return { kind: 'unavailable', why: whyOf(error) };
  } finally {
    await browser.close();
  }
}

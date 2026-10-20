// PRD 2239, s3: the diagrams of a before/after page, drawn through a fake browser: none starts Chromium or reaches the network.
import { describe, expect, it } from 'vitest';
import { parsePrd } from '../ids.ts';
import { gradeBeforeAfter } from './grade.ts';
import { type RenderBrowser, type RenderLaunch, renderDiagrams, repositoryLaunch } from './render.ts';

/** A browser whose Mermaid draws `<svg>…</svg>` of the source, refuses a source holding BAD, or never loads when `missing`. */
function fakeBrowser({ missing = false }: { missing?: boolean } = {}): { launch: RenderLaunch; log: string[] } {
  const log: string[] = [];
  const browser: RenderBrowser = {
    newPage: () =>
      Promise.resolve({
        setContent: (html) => {
          log.push(html.includes('mermaid@11.4.1') ? 'content: pinned mermaid' : 'content: other');
          return Promise.resolve();
        },
        evaluate: (expression) => {
          if (missing) return Promise.resolve({ missing: true });
          const source = String(JSON.parse(/mermaid\.render\("[^"]*", (".*")\);/.exec(expression)?.[1] ?? '""'));
          return Promise.resolve(
            source.includes('BAD') ? { error: 'Parse error on line 2:\n...context' } : { svg: `<svg data-n="${String(source.length)}">${source.slice(0, 5)}</svg>` },
          );
        },
      }),
    close: () => {
      log.push('closed');
      return Promise.resolve();
    },
  };
  return { launch: () => Promise.resolve(browser), log };
}

const section = (name: string, state: string, body: string): string => `<div data-section="${name}" data-state="${state}">${body}</div>`;
const PAGE = (body: string): string =>
  `<!doctype html><html><head><meta name="omni-before-after" content="2"></head><body>` +
  `<section data-tab="functional"><div data-service="kit">${section('functional', 'na', 'N/A')}</div></section>` +
  `<section data-tab="technical">${body}</section></body></html>`;
const PRE = (source: string): string => `<pre class="mermaid">${source}</pre>`;

describe('renderDiagrams', () => {
  it('replaces each <pre class="mermaid"> with its SVG, keeping the source, and names where each sits', async () => {
    const html = PAGE(
      section('flow', 'filled', PRE('sequenceDiagram\nA-&gt;&gt;B: hi')) +
        `<div data-service="kit">${section('db', 'filled', PRE('erDiagram\nT { int id }'))}</div>`,
    );
    const { launch, log } = fakeBrowser();
    const result = await renderDiagrams({ html, launch });
    expect(result.kind).toBe('done');
    if (result.kind !== 'done') return;
    expect(result.drawn).toEqual(['flow of the page', 'db of kit']);
    expect(result.refused).toEqual([]);
    expect(result.html).not.toContain('<pre class="mermaid">');
    expect(result.html).toContain('<figure class="mermaid-diagram" data-source="sequenceDiagram\nA-&gt;&gt;B: hi"><svg data-n="');
    expect(result.html).toContain('data-source="erDiagram\nT { int id }"');
    expect(log).toEqual(['content: pinned mermaid', 'closed']);
    expect(gradeBeforeAfter({ file: 'before-after.html', html: result.html, prd: parsePrd(2239) })).toEqual([]);
  });

  it('redraws an already rendered diagram from its data-source', async () => {
    const html = PAGE(section('flow', 'filled', '<figure class="mermaid-diagram" data-source="graph TD\nA--&gt;B"><svg>old</svg></figure>'));
    const result = await renderDiagrams({ html, launch: fakeBrowser().launch });
    expect(result.kind === 'done' && result.drawn).toEqual(['flow of the page']);
    expect(result.kind === 'done' && result.html).toContain('data-source="graph TD\nA--&gt;B"><svg data-n="');
    expect(result.kind === 'done' && result.html).not.toContain('old');
  });

  it('names a diagram Mermaid refuses by its section, service and first error line, drawing the others', async () => {
    const html = PAGE(`<div data-service="kit">${section('db', 'filled', PRE('BAD'))}${section('api', 'filled', PRE('graph TD'))}</div>`);
    const result = await renderDiagrams({ html, launch: fakeBrowser().launch });
    expect(result.kind).toBe('done');
    if (result.kind !== 'done') return;
    expect(result.refused).toEqual([{ place: 'db of kit', reason: 'Parse error on line 2:' }]);
    expect(result.drawn).toEqual(['api of kit']);
    expect(result.html).toContain(PRE('BAD'));
    expect(result.html).toContain('<figure class="mermaid-diagram"');
  });

  it('leaves the page alone and starts no browser when it holds no diagram', async () => {
    let launched = false;
    const html = PAGE(section('flow', 'na', 'N/A'));
    const result = await renderDiagrams({
      html,
      launch: () => {
        launched = true;
        return Promise.reject(new Error('no'));
      },
    });
    expect(result).toEqual({ kind: 'done', html, drawn: [], refused: [] });
    expect(launched).toBe(false);
  });

  it('is unavailable, with the first line of why, when the browser does not start', async () => {
    const result = await renderDiagrams({ html: PAGE(PRE('graph TD')), launch: () => Promise.reject(new Error('Executable does not exist\nmore')) });
    expect(result).toEqual({ kind: 'unavailable', why: 'Executable does not exist' });
  });

  it('is unavailable, and closes the browser, when Mermaid never loads', async () => {
    const { launch, log } = fakeBrowser({ missing: true });
    const result = await renderDiagrams({ html: PAGE(PRE('graph TD')), launch });
    expect(result).toEqual({ kind: 'unavailable', why: 'Mermaid did not load from jsDelivr: is the network reachable?' });
    expect(log).toContain('closed');
  });

  it('is unavailable when the page breaks mid-render', async () => {
    const broken: RenderLaunch = () => Promise.resolve({ newPage: () => Promise.reject(new Error('page crashed')), close: () => Promise.resolve() });
    expect(await renderDiagrams({ html: PAGE(PRE('graph TD')), launch: broken })).toEqual({ kind: 'unavailable', why: 'page crashed' });
  });
});

describe('repositoryLaunch', () => {
  it('says Playwright is not installed when the repository has none', async () => {
    await expect(repositoryLaunch('/nonexistent-omni-repo')()).rejects.toThrow('Playwright is not installed in this repository');
  });
});

// PRD 2239, s1: the grading of a before/after page of the two-tab shape (spec §4) — one violation per
// rule, each naming the file; a page without the meta is graded on nothing here.
import { describe, expect, it } from 'vitest';
import { gradeBeforeAfter } from './grade.ts';
import { parsePrd } from '../ids.ts';

const FILE = '.omni-loop/delivery/inbox/2239-x/before-after.html';
const META = '<meta name="omni-before-after" content="2">';

/** A page of the two-tab shape whose every section is filled: `head` and the two tabs' bodies can be swapped. */
function page({
  meta = META,
  head = '',
  functional = '<section data-tab="functional"><div data-service="kit"><div data-section="functional" data-state="filled">Today, after.</div><div data-section="pixel-perfect" data-state="na">N/A — Pixel perfect: no screen changes</div></div></section>',
  technical = '<section data-tab="technical"><div data-section="flow" data-state="filled"><svg viewBox="0 0 1 1"><use href="#arrow"/></svg></div><div data-section="deploy" data-state="na">N/A — one service</div><div data-service="kit"><div data-section="db" data-state="na">N/A</div><div data-section="api" data-state="gap">To settle — the flag</div><div data-section="behaviour" data-state="filled">x</div></div></section>',
}: { meta?: string; head?: string; functional?: string; technical?: string } = {}): string {
  return `<!doctype html><html><head><meta charset="utf-8">${meta}<title>PRD 2239</title><style>.add{color:green}</style>${head}</head><body>${functional}${technical}<script>if(location.hash==='#technical'){}</script></body></html>`;
}

const grade = (html: string, prd: number | null = 2239): string[] =>
  gradeBeforeAfter({ file: FILE, html, prd: prd === null ? null : parsePrd(prd) });

describe('gradeBeforeAfter (PRD 2239, spec §4)', () => {
  it('finds nothing wrong with a good page', () => {
    expect(grade(page())).toEqual([]);
  });

  it('grades nothing on a page without the meta, however it breaks the rules', () => {
    const broken = page({ meta: '', technical: '<pre class="mermaid">graph TD; A-->B</pre><!-- FILL --><script src="https://cdn.example/m.js"></script>' });
    expect(grade(broken)).toEqual([]);
    expect(grade(page({ meta: '<meta name="omni-before-after" content="1">', technical: '' }))).toEqual([]);
    expect(grade(page({ meta: '<meta name="omni-pitch" content="2">', technical: '' }))).toEqual([]);
    expect(grade(page({ meta: '<div name="omni-before-after" content="2"></div>', technical: '' }))).toEqual([]);
  });

  it('reads the meta whatever its attribute order and the case of its names, its values exactly as written', () => {
    expect(grade(page({ meta: '<META content="2" NAME="omni-before-after" />', technical: '' }))).toEqual([`${FILE}: no "technical" tab`]);
    expect(grade(page({ meta: '<meta name=" omni-before-after" content="2">', technical: '' }))).toEqual([]);
    expect(grade(page({ meta: '<meta name="omni-before-after" content="2 ">', technical: '' }))).toEqual([]);
  });

  it('refuses a page missing a tab, naming it', () => {
    expect(grade(page({ technical: '' }))).toEqual([`${FILE}: no "technical" tab`]);
    expect(grade(page({ functional: '' }))).toEqual([`${FILE}: no "functional" tab`]);
    expect(grade(page({ functional: '', technical: '' }))).toEqual([`${FILE}: no "functional" tab`, `${FILE}: no "technical" tab`]);
  });

  it('refuses a section with no data-state, naming the section, its service and its tab', () => {
    const technical = '<section data-tab="technical"><div data-service="kit"><div data-section="db">x</div></div></section>';
    expect(grade(page({ technical }))).toEqual([`${FILE}: section "db" of service "kit" in the "technical" tab has no data-state (filled, na or gap)`]);
  });

  it('refuses a section with an unknown state, naming the state', () => {
    const technical = '<section data-tab="technical"><div data-section="flow" data-state="done">x</div></section>';
    expect(grade(page({ technical }))).toEqual([`${FILE}: section "flow" in the "technical" tab has data-state "done", not filled, na or gap`]);
  });

  it('refuses an empty data-state, and reads a state in any case as written', () => {
    const technical = '<section data-tab="technical"><div data-section="flow" data-state="">x</div><div data-section="deploy" data-state="NA">x</div></section>';
    expect(grade(page({ technical }))).toEqual([
      `${FILE}: section "flow" in the "technical" tab has data-state "", not filled, na or gap`,
      `${FILE}: section "deploy" in the "technical" tab has data-state "NA", not filled, na or gap`,
    ]);
  });

  it('accepts each of the three states', () => {
    for (const state of ['filled', 'na', 'gap']) {
      const technical = `<section data-tab="technical"><div data-section="flow" data-state="${state}">x</div></section>`;
      expect(grade(page({ technical }))).toEqual([]);
    }
  });

  it('grades a section outside any tab or service too, saying where it is not', () => {
    const technical = '<section data-tab="technical"></section><div data-section="flow">x</div>';
    expect(grade(page({ technical }))).toEqual([`${FILE}: section "flow" has no data-state (filled, na or gap)`]);
  });

  it('names the innermost service and tab of a nested section', () => {
    const functional = '<section data-tab="functional"><div data-service="galaxy"><div><div data-section="functional">x</div></div></div><div data-section="pixel-perfect" data-state="na">x</div></section>';
    expect(grade(page({ functional }))).toEqual([`${FILE}: section "functional" of service "galaxy" in the "functional" tab has no data-state (filled, na or gap)`]);
  });

  it('refuses a <!-- FILL --> left, counting them', () => {
    const one = '<section data-tab="technical"><div data-section="flow" data-state="filled"><!-- FILL --></div></section>';
    expect(grade(page({ technical: one }))).toEqual([`${FILE}: 1 <!-- FILL --> marker left`]);
    const three = '<section data-tab="technical"><div data-section="flow" data-state="filled"><!--FILL--><!--   FILL   --><!--\nFILL\n--></div></section>';
    expect(grade(page({ technical: three }))).toEqual([`${FILE}: 3 <!-- FILL --> markers left`]);
  });

  it('does not take another comment, or the word FILL in the text, for the marker', () => {
    const technical = '<section data-tab="technical"><div data-section="flow" data-state="filled"><!-- FILLED --><!-- fill --> FILL the form</div></section>';
    expect(grade(page({ technical }))).toEqual([]);
  });

  it('refuses a <pre class="mermaid"> left, counting them and naming the render command', () => {
    const one = '<section data-tab="technical"><div data-section="flow" data-state="filled"><pre class="mermaid">graph TD; A-->B</pre></div></section>';
    expect(grade(page({ technical: one }))).toEqual([`${FILE}: 1 diagram not rendered (omni before-after render 2239)`]);
    const two = '<section data-tab="technical"><div data-section="flow" data-state="filled"><pre class="mermaid">a</pre><PRE class="diagram  mermaid wide">b</PRE></div></section>';
    expect(grade(page({ technical: two }))).toEqual([`${FILE}: 2 diagrams not rendered (omni before-after render 2239)`]);
  });

  it('names a placeholder PRD in the render command when the folder gives none', () => {
    const one = '<section data-tab="technical"><div data-section="flow" data-state="filled"><pre class="mermaid">a</pre></div></section>';
    expect(grade(page({ technical: one }), null)).toEqual([`${FILE}: 1 diagram not rendered (omni before-after render <n>)`]);
  });

  it('does not take a <pre> of another class, or a rendered diagram, for an unrendered one', () => {
    const technical = '<section data-tab="technical"><div data-section="flow" data-state="filled"><pre class="mermaid-source">a</pre><pre>b</pre><div class="mermaid" data-source="graph TD"><svg></svg></div></div></section>';
    expect(grade(page({ technical }))).toEqual([]);
  });

  it.each([
    ['<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>', '<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js">'],
    ['<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inter">', '<link href="https://fonts.googleapis.com/css?family=Inter">'],
    ['<link rel="icon" href="favicon.ico">', '<link href="favicon.ico">'],
    ['<img src="today.png" alt="">', '<img src="today.png">'],
    ['<img srcset="after.png 2x">', '<img srcset="after.png 2x">'],
    ['<img srcset="data:image/svg+xml,a 1x">', '<img srcset="data:image/svg+xml,a 1x">'],
    ['<a src="a.png">x</a>', '<a src="a.png">'],
    ['<iframe src="//example.com"></iframe>', '<iframe src="//example.com">'],
    ['<video poster="p.jpg"></video>', '<video poster="p.jpg">'],
    ['<object data="d.svg"></object>', '<object data="d.svg">'],
    ['<svg><image href="https://x/y.png"/></svg>', '<image href="https://x/y.png">'],
    ['<svg><use xlink:href="sprite.svg#a"/></svg>', '<use xlink:href="sprite.svg#a">'],
  ])('refuses an external resource: %s', (markup, named) => {
    expect(grade(page({ head: markup }))).toEqual([`${FILE}: ${named} loads an external resource`]);
  });

  it('accepts what loads nothing: data: URLs, fragments, links, an empty src and an inline script or style', () => {
    const head = [
      '<img src="data:image/svg+xml,%3Csvg%3E">',
      '<img src="DATA:image/png;base64,AA==">',
      '<img srcset=" ">',
      '<svg><use href="#arrow"/><use xlink:href="#b"/><a xlink:href="https://x">a link in a drawing</a></svg>',
      '<a href="https://github.com/acme/widgets/pull/1">the PR</a>',
      '<a href="#technical">Technical</a>',
      '<area href="https://x">',
      '<img src=" ">',
      '<object data="data:image/svg+xml,%3Csvg%3E"></object>',
      '<object></object>',
      '<div data="https://x">not an object</div>',
      '<script>const src = "https://x";</script>',
      '<style>.a{background:none}</style>',
    ].join('');
    expect(grade(page({ head }))).toEqual([]);
  });

  it('reports one violation per resource, in page order, after the other rules', () => {
    const head = '<script src="a.js"></script><img src="b.png">';
    const technical = '<section data-tab="technical"><div data-section="flow"><pre class="mermaid">x</pre><!-- FILL --></div></section>';
    expect(grade(page({ head, technical, functional: '' }))).toEqual([
      `${FILE}: no "functional" tab`,
      `${FILE}: section "flow" in the "technical" tab has no data-state (filled, na or gap)`,
      `${FILE}: 1 <!-- FILL --> marker left`,
      `${FILE}: 1 diagram not rendered (omni before-after render 2239)`,
      `${FILE}: <script src="a.js"> loads an external resource`,
      `${FILE}: <img src="b.png"> loads an external resource`,
    ]);
  });
});

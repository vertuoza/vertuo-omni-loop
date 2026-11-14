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

// PRD 2850, s2: the three-tab shape, one test per rule of the spec's "The grader".
const META3 = '<meta name="omni-before-after" content="3">';

/** One marked screen: its marks as written, its markup in a `<template>` as the page template draws it. */
function screen(marks: { name?: string; ref?: string; when?: string; viewport?: string } = {}): string {
  const { name = 'quote-list', ref = '1.A', when = 'after', viewport = '1280' } = marks;
  return `<div data-screen="${name}" data-ref="${ref}" data-when="${when}" data-viewport="${viewport}"><template><main>x</main></template></div>`;
}

const GOOD_SCREENS = [screen({ when: 'today' }), screen(), screen({ name: 'app-shell', ref: '2.A', viewport: '390' })].join('');

const pixelTab = (inner: string, state = 'filled'): string =>
  `<section data-tab="pixel-perfect"><div data-section="pixel-perfect" data-state="${state}">${inner}</div></section>`;

/** A page of the three-tab shape that keeps the nine rules; each tab can be swapped. */
function page3({
  functional = '<section data-tab="functional"><div data-service="kit"><div data-section="functional" data-state="filled">Today, after.</div></div></section>',
  technical = '<section data-tab="technical"><div data-section="flow" data-state="filled">x</div></section>',
  pixel = pixelTab(`<p>screens: quote-list · app-shell</p>${GOOD_SCREENS}`),
}: { functional?: string; technical?: string; pixel?: string } = {}): string {
  return page({ meta: META3, functional, technical }).replace('<script>', `${pixel}<script>`);
}

describe('gradeBeforeAfter, version 3 (PRD 2850, spec §4)', () => {
  it('accepts a page that keeps the nine rules', () => {
    expect(grade(page3())).toEqual([]);
  });

  it('accepts the other two states of the Pixel perfect section, with no screen', () => {
    expect(grade(page3({ pixel: pixelTab('<p>Pixel perfect: no screen changes</p>', 'na') }))).toEqual([]);
    expect(grade(page3({ pixel: pixelTab('To settle — the width', 'gap') }))).toEqual([]);
  });

  it('rule 1: refuses a missing tab, naming it, the Pixel perfect one included', () => {
    expect(grade(page3({ pixel: '' }))).toEqual([`${FILE}: no "pixel-perfect" tab`, `${FILE}: no "pixel-perfect" section`]);
    expect(grade(page3({ technical: '' }))).toEqual([`${FILE}: no "technical" tab`]);
    expect(grade(page3({ functional: '' }))).toEqual([`${FILE}: no "functional" tab`]);
  });

  it('rule 2: refuses several Pixel perfect sections', () => {
    const two = '<section data-tab="pixel-perfect"><div data-section="pixel-perfect" data-state="na">a</div><div data-section="pixel-perfect" data-state="na">b</div></section>';
    expect(grade(page3({ pixel: two }))).toEqual([`${FILE}: 2 "pixel-perfect" sections, not one for the page`]);
  });

  it('rule 2: refuses a Pixel perfect section outside its tab, in a service or on the page', () => {
    const inService =
      '<section data-tab="functional"><div data-service="kit"><div data-section="functional" data-state="filled">x</div><div data-section="pixel-perfect" data-state="na">x</div></div></section>';
    expect(grade(page3({ functional: inService, pixel: '<section data-tab="pixel-perfect"></section>' }))).toEqual([
      `${FILE}: section "pixel-perfect" of service "kit" in the "functional" tab sits outside the "pixel-perfect" tab`,
    ]);
    expect(grade(page3({ pixel: '<div data-section="pixel-perfect" data-state="na">x</div>' }))).toEqual([
      `${FILE}: no "pixel-perfect" tab`,
      `${FILE}: section "pixel-perfect" sits outside the "pixel-perfect" tab`,
    ]);
  });

  it('rule 2: refuses a page with no Pixel perfect section', () => {
    expect(grade(page3({ pixel: '<section data-tab="pixel-perfect"></section>' }))).toEqual([`${FILE}: no "pixel-perfect" section`]);
  });

  it('rule 3: refuses a marked screen outside the Pixel perfect tab, naming it and its reference', () => {
    const inner = screen({ name: 'invoice', ref: '3.A' });
    const functional = `<section data-tab="functional"><div data-service="kit"><div data-section="functional" data-state="filled">${inner}</div></div></section>`;
    expect(grade(page3({ functional }))).toEqual([`${FILE}: screen "invoice" (3.A) sits in the "functional" tab, not the "pixel-perfect" tab`]);
    const loose = screen({ name: 'loose', ref: '3.A' });
    expect(grade(page3({ pixel: `${pixelTab(`<p>screens: quote-list · app-shell</p>${GOOD_SCREENS}`)}${loose}` }))).toEqual([
      `${FILE}: screen "loose" (3.A) sits outside any tab, not the "pixel-perfect" tab`,
    ]);
  });

  it('rule 4: refuses a filled section with no marked screen', () => {
    expect(grade(page3({ pixel: pixelTab('<p>screens: none</p>') }))).toEqual([
      `${FILE}: section "pixel-perfect" in the "pixel-perfect" tab is filled but holds no marked screen (data-screen)`,
    ]);
  });

  it('rule 5: refuses a screen with no data-ref, data-when or data-viewport, naming the screen', () => {
    const bare = pixelTab('<p>screens: quote-list</p><div data-screen="quote-list"></div>');
    expect(grade(page3({ pixel: bare }))).toEqual([
      `${FILE}: screen "quote-list" has no data-ref`,
      `${FILE}: screen "quote-list" has no data-when (today or after)`,
      `${FILE}: screen "quote-list" has no data-viewport (a width in CSS pixels, 320 to 2560)`,
    ]);
  });

  it('rule 5: refuses a malformed data-ref, data-when or data-viewport, naming the value', () => {
    const bad = pixelTab('<p>screens: quote-list</p><div data-screen="quote-list" data-ref="2C" data-when="before" data-viewport="wide"></div>');
    expect(grade(page3({ pixel: bad }))).toEqual([
      `${FILE}: screen "quote-list" has data-ref "2C", not <number>.<letter> as 2.C`,
      `${FILE}: screen "quote-list" has data-when "before", not today or after`,
      `${FILE}: screen "quote-list" has data-viewport "wide", not a whole number of CSS pixels from 320 to 2560`,
    ]);
  });

  it('rule 5: holds the width to a whole number from 320 to 2560', () => {
    const one = (viewport: string): string => pixelTab(`<p>screens: quote-list</p>${screen({ viewport })}`);
    for (const viewport of ['319', '2561', '1280.5', '0', '-1', '', '01280']) {
      expect(grade(page3({ pixel: one(viewport) }))).toEqual([
        `${FILE}: screen "quote-list" (1.A) has data-viewport "${viewport}", not a whole number of CSS pixels from 320 to 2560`,
      ]);
    }
    for (const viewport of ['320', '2560', '1280', '390']) expect(grade(page3({ pixel: one(viewport) }))).toEqual([]);
  });

  it('rule 5: holds the reference to a number and a capital letter', () => {
    const one = (ref: string): string => pixelTab(`<p>screens: quote-list</p>${screen({ ref })}`);
    for (const ref of ['0.A', '1.a', '1.AB', '01.A', '1.', '.A', '1A']) {
      expect(grade(page3({ pixel: one(ref) }))).toEqual([`${FILE}: screen "quote-list" has data-ref "${ref}", not <number>.<letter> as 2.C`]);
    }
    for (const ref of ['12.Z', '1.A', '10.B']) expect(grade(page3({ pixel: one(ref) }))).toEqual([]);
  });

  it('rule 6: refuses a pair of reference and side written twice, naming it and counting', () => {
    const inner = `<p>screens: quote-list</p>${screen()}${screen()}${screen()}${screen({ when: 'today' })}`;
    expect(grade(page3({ pixel: pixelTab(inner) }))).toEqual([`${FILE}: reference 1.A after is written 3 times, not once`]);
  });

  it('rule 7: refuses a reference with no after', () => {
    const inner = `<p>screens: quote-list</p>${screen()}${screen({ ref: '1.B', when: 'today' })}`;
    expect(grade(page3({ pixel: pixelTab(inner) }))).toEqual([`${FILE}: reference 1.B has no after`]);
  });

  it('rule 7: accepts an after with no today, a state that does not exist today', () => {
    expect(grade(page3({ pixel: pixelTab(`<p>screens: quote-list</p>${screen()}`) }))).toEqual([]);
  });

  it('rule 8: refuses a number carrying two screens', () => {
    const inner = `<p>screens: a · b</p>${screen({ name: 'a', ref: '1.A' })}${screen({ name: 'b', ref: '1.B' })}`;
    expect(grade(page3({ pixel: pixelTab(inner) }))).toEqual([`${FILE}: number 1 carries "a" and "b", not one screen`]);
  });

  it('rule 8: refuses a screen under two numbers', () => {
    const inner = `<p>screens: a · b</p>${screen({ name: 'a', ref: '1.A' })}${screen({ name: 'a', ref: '2.A' })}${screen({ name: 'b', ref: '3.A' })}`;
    expect(grade(page3({ pixel: pixelTab(inner) }))).toEqual([`${FILE}: screen "a" sits under numbers 1 and 2, not one`]);
  });

  it('rule 8: accepts several states of one screen under one number', () => {
    const inner = `<p>screens: a · b</p>${screen({ name: 'a', ref: '1.A' })}${screen({ name: 'a', ref: '1.B' })}${screen({ name: 'b', ref: '2.A' })}`;
    expect(grade(page3({ pixel: pixelTab(inner) }))).toEqual([]);
  });

  it('rule 9: refuses a screens: line that leaves a screen out, or that is missing', () => {
    const left = 'section "pixel-perfect" in the "pixel-perfect" tab: its screens: line does not name screen';
    expect(grade(page3({ pixel: pixelTab(`<p>screens: quote-list</p>${GOOD_SCREENS}`) }))).toEqual([`${FILE}: ${left} "app-shell"`]);
    expect(grade(page3({ pixel: pixelTab(GOOD_SCREENS) }))).toEqual([`${FILE}: ${left} "quote-list"`, `${FILE}: ${left} "app-shell"`]);
    expect(grade(page3({ pixel: pixelTab(`<p>see screens: quote-list · app-shell</p>${GOOD_SCREENS}`) }))).toHaveLength(2);
  });

  it('rule 9: reads the screens: line with inline markup, other lines around it, and any case', () => {
    const around = '<p>Screens below.</p><p>screens: <code>quote-list</code> · <b>app-shell</b></p><p class="note">Every screen is whole.</p>';
    expect(grade(page3({ pixel: pixelTab(`${around}${GOOD_SCREENS}`) }))).toEqual([]);
    expect(grade(page3({ pixel: pixelTab(`<div>Screens: quote-list · app-shell</div>${GOOD_SCREENS}`) }))).toEqual([]);
  });

  it('grades the states, the FILL marks, the diagrams and the resources as on a version 2 page', () => {
    const technical = '<section data-tab="technical"><div data-section="flow"><pre class="mermaid">x</pre><!-- FILL --></div></section>';
    expect(grade(page3({ technical }).replace('<style>', '<img src="a.png"><style>'))).toEqual([
      `${FILE}: section "flow" in the "technical" tab has no data-state (filled, na or gap)`,
      `${FILE}: 1 <!-- FILL --> marker left`,
      `${FILE}: 1 diagram not rendered (omni before-after render 2239)`,
      `${FILE}: <img src="a.png"> loads an external resource`,
    ]);
  });

  it('puts the section rules before the states, and the screens after', () => {
    const pixel = '<section data-tab="pixel-perfect"><div data-section="pixel-perfect"><div data-screen="a"></div></div></section>';
    expect(grade(page3({ technical: '', pixel }))).toEqual([
      `${FILE}: no "technical" tab`,
      `${FILE}: section "pixel-perfect" in the "pixel-perfect" tab: its screens: line does not name screen "a"`,
      `${FILE}: section "pixel-perfect" in the "pixel-perfect" tab has no data-state (filled, na or gap)`,
      `${FILE}: screen "a" has no data-ref`,
      `${FILE}: screen "a" has no data-when (today or after)`,
      `${FILE}: screen "a" has no data-viewport (a width in CSS pixels, 320 to 2560)`,
    ]);
  });

  it('leaves a version 2 page and a page with no meta as they were: no rule of the screens reaches them', () => {
    const marked = `<section data-tab="functional"><div data-service="kit"><div data-section="functional" data-state="filled">${screen({ ref: 'bad' })}</div><div data-section="pixel-perfect" data-state="filled">x</div></div></section>`;
    expect(grade(page({ functional: marked }))).toEqual([]);
    expect(grade(page({ meta: '', functional: marked }))).toEqual([]);
    expect(grade(page({ meta: '<meta name="omni-before-after" content="4">', functional: marked }))).toEqual([]);
    expect(grade(page({ functional: '', technical: '' }))).toEqual([`${FILE}: no "functional" tab`, `${FILE}: no "technical" tab`]);
  });
});

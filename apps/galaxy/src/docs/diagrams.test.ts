import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { HastElement } from './badges';
import { diagramFigure, diagramsNamed, isDiagramPath, readSvg, remarkDiagrams, svgProblem } from './diagrams';

// A diagram of the guide: an SVG file beside the pages, read when the guide is compiled and set in
// the page as the drawing itself, so the theme's tokens paint it.

const GUIDE = fileURLToPath(new URL('../../../../docs/guide', import.meta.url));

describe('reading an SVG file', () => {
  it('keeps the drawing: its elements, its classes as className, its words with their entities', () => {
    const svg = readSvg([
      '<?xml version="1.0"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">',
      '  <!-- a note -->',
      '  <rect x="1" class="dg-box dg-edge-you"/>',
      '  <text x="2" y="3" class="dg-small">plan &amp; build <tspan class="dg-you">&lt;n&gt;</tspan> <tspan>&#8594;</tspan></text>',
      '</svg>',
    ].join('\n'));
    expect(svg).toEqual({
      type: 'element', tagName: 'svg', properties: { viewBox: '0 0 10 10' }, children: [
        { type: 'element', tagName: 'rect', properties: { x: '1', className: ['dg-box', 'dg-edge-you'] }, children: [] },
        { type: 'element', tagName: 'text', properties: { x: '2', y: '3', className: ['dg-small'] }, children: [
          { type: 'text', value: 'plan & build ' },
          { type: 'element', tagName: 'tspan', properties: { className: ['dg-you'] }, children: [{ type: 'text', value: '<n>' }] },
          { type: 'text', value: ' ' },
          { type: 'element', tagName: 'tspan', properties: {}, children: [{ type: 'text', value: '→' }] },
        ] },
      ],
    });
  });

  it('leaves its own style, title and description out', () => {
    const svg = readSvg('<svg><title>T</title><desc>D</desc><style>text { fill: #000; }</style><g/></svg>');
    expect(svg.children).toEqual([{ type: 'element', tagName: 'g', properties: {}, children: [] }]);
  });

  it.each([
    ['<svg>\n<g>\n</svg>', 'line 3: </svg> closes <g>'],
    ['<svg><g>', 'line 1: <g> is never closed'],
    ['</g>', 'line 1: </g> closes nothing'],
    ['<g/>', 'line 1: <g> outside the one <svg>'],
    ['<svg/><svg/>', 'line 1: <svg> outside the one <svg>'],
    ['words <svg/>', 'line 1: text outside the <svg>'],
    ['<svg><text>a < b</text></svg>', 'line 1: a < that opens no tag (write &lt;)'],
    ['', 'line 1: no <svg>'],
  ])('refuses %j: %s', (source, problem) => {
    expect(svgProblem(source)).toBe(problem);
  });

  it('reads every diagram of the guide', () => {
    for (const file of readdirSync(join(GUIDE, 'diagrams'))) {
      expect(svgProblem(readFileSync(join(GUIDE, 'diagrams', file), 'utf8')), file).toBeNull();
    }
  });
});

describe('the figure', () => {
  it('holds the drawing, an image named by the alt text', () => {
    const svg: HastElement = { type: 'element', tagName: 'svg', properties: { viewBox: '0 0 1 1' }, children: [] };
    expect(diagramFigure(svg, 'The loop')).toEqual({
      type: 'element', tagName: 'figure', properties: { className: ['docs-figure'] },
      children: [{ ...svg, properties: { viewBox: '0 0 1 1', role: 'img', 'aria-label': 'The loop' } }],
    });
  });
});

describe('what a page shows', () => {
  it('finds each SVG image named relative to the page, and whether it stands alone', () => {
    const page = 'Words.\n\n![The loop](diagrams/loop.svg)\n\nSee ![it](a.svg).\n![Remote](https://x.io/a.svg) ![Root](/a.svg) ![Photo](a.png)';
    expect(diagramsNamed(page)).toEqual([
      { line: 3, alt: 'The loop', src: 'diagrams/loop.svg', alone: true },
      { line: 5, alt: 'it', src: 'a.svg', alone: false },
    ]);
    expect([isDiagramPath('diagrams/a.SVG'), isDiagramPath('https://x.io/a.svg'), isDiagramPath('/a.svg')]).toEqual([true, false, false]);
  });
});

describe('the compile step', () => {
  let dir = '';
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  type Node = { type: string; url?: string; alt?: string; value?: string; children?: Node[]; data?: Record<string, unknown> };
  const image = (url: string, alt = 'The loop'): Node => ({ type: 'image', url, alt });
  const paragraph = (...children: Node[]): Node => ({ type: 'paragraph', children });

  let dependencies: string[] = [];
  function compile(tree: Node) {
    dependencies = [];
    const _compiler = { addDependency: (file: string) => { dependencies.push(file); } };
    remarkDiagrams()(tree, { dirname: dir, path: join(dir, 'page.md'), data: { _compiler } });
    return tree;
  }

  it('turns a paragraph that is one diagram into its figure, and leaves any other image alone', () => {
    dir = mkdtempSync(join(tmpdir(), 'omni-diagram-'));
    writeFileSync(join(dir, 'a.svg'), '<svg viewBox="0 0 1 1"><g class="dg-box"/></svg>');
    const inSentence = paragraph({ type: 'text', value: 'See ' }, image('a.svg'));
    const photo = paragraph(image('a.png'));
    const tree = compile({ type: 'root', children: [paragraph(image('a.svg')), inSentence, photo] });
    expect(tree.children?.[0]).toEqual({
      type: 'diagram',
      data: {
        hName: 'figure',
        hProperties: { className: ['docs-figure'] },
        hChildren: [{
          type: 'element', tagName: 'svg', properties: { viewBox: '0 0 1 1', role: 'img', 'aria-label': 'The loop' },
          children: [{ type: 'element', tagName: 'g', properties: { className: ['dg-box'] }, children: [] }],
        }],
      },
    });
    expect(tree.children?.slice(1)).toEqual([inSentence, photo]);
  });

  it('makes the diagram\'s file a dependency of the page, so changing it compiles the page again', () => {
    dir = mkdtempSync(join(tmpdir(), 'omni-diagram-'));
    writeFileSync(join(dir, 'a.svg'), '<svg/>');
    compile({ type: 'root', children: [paragraph(image('a.svg'))] });
    expect(dependencies).toEqual([join(dir, 'a.svg')]);
  });

  it('stops the build on a diagram whose file is missing, naming it and its page', () => {
    dir = mkdtempSync(join(tmpdir(), 'omni-diagram-'));
    expect(() => compile({ type: 'root', children: [paragraph(image('gone.svg'))] }))
      .toThrow(`the diagram gone.svg of ${join(dir, 'page.md')} does not read`);
  });
});

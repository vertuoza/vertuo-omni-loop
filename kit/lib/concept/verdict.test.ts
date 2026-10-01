// What a concept's page may hold (PRD 686): inline CSS, inline SVG and inline script, loading nothing
// from the network. `omni concept`'s own checks run end to end in `kit/bin/concept.test.ts`; this
// holds open the one rule that reads HTML, and the folder name a concept's number gives.
import { describe, expect, it } from 'vitest';
import { folderPrefix, networkLoads } from './verdict.ts';

describe('networkLoads', () => {
  it('finds nothing in a self-contained page, its links a person follows included', () => {
    const page = [
      '<!doctype html><html><head><style>body { background: url("data:image/svg+xml;base64,PHN2Zy8+"); }</style></head>',
      '<body><a href="https://example.com/reference">a reference</a><area href="//example.com/map">',
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use href="#star"/></svg>',
      '<img src="data:image/svg+xml;base64,PHN2Zy8+"><p>Read https://example.com from "https://example.com" too.</p>',
      '<script>const next = () => document.querySelector("#b2").click();</script></body></html>',
    ].join('\n');
    expect(networkLoads(page)).toEqual([]);
  });

  it.each([
    ['a script', '<script src="https://cdn.example.com/app.js"></script>', '<script src> https://cdn.example.com/app.js'],
    ['a protocol-relative script', "<script src='//cdn.example.com/app.js'></script>", '<script src> //cdn.example.com/app.js'],
    ['a stylesheet', '<link rel="stylesheet" href="https://fonts.example.com/css">', '<link href> https://fonts.example.com/css'],
    ['an image', '<img src=http://example.com/a.png>', '<img src> http://example.com/a.png'],
    ['a srcset candidate', '<img srcset="a.png 1x, https://example.com/b.png 2x">', '<img srcset> https://example.com/b.png'],
    ['a frame', '<iframe src="https://example.com/embed"></iframe>', '<iframe src> https://example.com/embed'],
    ['an SVG image', '<svg><image href="https://example.com/a.png"/></svg>', '<image href> https://example.com/a.png'],
    ['an @import', '<style>@import url("https://fonts.example.com/css");</style>', '@import https://fonts.example.com/css'],
    ['a bare @import', "<style>@import 'https://example.com/a.css';</style>", '@import https://example.com/a.css'],
    ['a font in CSS', "<style>@font-face { src: url(https://example.com/f.woff2); }</style>", 'url() https://example.com/f.woff2'],
    ['a style attribute', '<div style="background: url(\'https://example.com/a.png\')"></div>', 'url() https://example.com/a.png'],
    ['a module import', '<script type="module">import confetti from "https://esm.example.com/confetti";</script>', 'import https://esm.example.com/confetti'],
    ['a dynamic import', '<script>import("https://esm.example.com/x.js")</script>', 'import https://esm.example.com/x.js'],
    ['a fetch', '<script>fetch(`https://api.example.com/data`)</script>', 'fetch https://api.example.com/data'],
  ])('finds %s', (_what, page, load) => {
    expect(networkLoads(page)).toEqual([load]);
  });
});

describe('folderPrefix', () => {
  it("pads the concept's number to four digits and never truncates it", () => {
    expect(folderPrefix(712)).toBe('0712-');
    expect(folderPrefix(12345)).toBe('12345-');
  });
});

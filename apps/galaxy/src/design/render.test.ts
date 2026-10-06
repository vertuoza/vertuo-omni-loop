import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  INK, LOGO_DRAWINGS, OMNI_LOOP, OMNI_POSES, POSTER_MAX_SCALE, SPRITE_DEFS, TYPE_SCALE, contrast,
} from '@omni/design';
import { DEMO_PROJECTS } from '@omni/galaxy';
import { sure } from '../arcade/test/sure';
import { DesignScreen } from './DesignScreen';
import { ICONS, LOGO_SCALES, POSTER_SCALE } from './catalogue';

// /design as the server renders it: everything on it is drawn from @omni/design, so a module that
// grows shows up here, and a test finds each piece by its name.

const html = renderToStaticMarkup(createElement(DesignScreen));

/** The part of the markup from a section's opening tag to its end. */
const section = (id: string) => {
  const from = html.indexOf(`<section id="${id}"`);
  expect(from, id).toBeGreaterThanOrEqual(0);
  return html.slice(from, html.indexOf('</section>', from));
};
/** Every value of a data attribute in some markup, in order. */
const values = (markup: string, attr: string) => [...markup.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))].map((m) => m[1]);

describe('the /design page', () => {
  it('is headed by the Omni Loop crest and names the product', () => {
    const head = html.slice(0, html.indexOf('</header>'));
    expect(head).toContain('<svg');
    expect(head).toContain(OMNI_LOOP.name);
    expect(head).toContain(OMNI_LOOP.tagline);
  });

  it('links a contents entry to every section', () => {
    for (const id of ['logo', 'colours', 'type', 'sprites', 'heroes', 'poses', 'icons']) {
      expect(html).toContain(`href="#${id}"`);
      section(id);
    }
  });

  describe('the logo', () => {
    const logo = section('logo');

    it('shows every form in colour on a dark and a light ground, and in one colour on a light one, at every scale', () => {
      for (const form of LOGO_DRAWINGS) {
        for (const scale of LOGO_SCALES) {
          for (const [ground, ink] of [['dark', 'colour'], ['light', 'colour'], ['light', 'mono']]) {
            expect(logo, `${form} ${ground} ${ink} ${scale}×`)
              .toContain(`data-logo="${form}" data-ground="${ground}" data-ink="${ink}" data-scale="${scale}"`);
          }
        }
      }
    });

    it('draws each at a whole-number scale: the SVG is that many times its pixels', () => {
      expect(LOGO_SCALES.every((k) => Number.isInteger(k) && k >= 1)).toBe(true);
      const marks = [...logo.matchAll(/data-logo="mark"[^>]*data-scale="(\d+)"[^>]*>(?:<span [^>]*>)?<svg [^>]*width="(\d+)" height="(\d+)"/g)];
      expect(marks.length).toBeGreaterThan(0);
      for (const [, k, w, h] of marks) expect([Number(w), Number(h)]).toEqual([20 * Number(k), 18 * Number(k)]);
    });
  });

  it('shows every INK colour with its name, its hex, and its contrast on the void and on white', () => {
    const colours = section('colours');
    expect(values(colours, 'data-colour')).toEqual(Object.keys(INK));
    for (const [name, hex] of Object.entries(INK)) {
      const swatch = colours.slice(colours.indexOf(`data-colour="${name}"`));
      const card = swatch.slice(0, swatch.indexOf('</li>'));
      expect(card).toContain(`>${name}<`);
      expect(card).toContain(hex);
      expect(card).toContain(`${contrast(hex, INK.void).toFixed(1)}:1`);
      expect(card).toContain(`${contrast(hex, INK.white).toFixed(1)}:1`);
    }
  });

  it('shows every step of the type scale, with its role, face, size, line height and slant', () => {
    const type = section('type');
    expect(values(type, 'data-step')).toEqual(Object.keys(TYPE_SCALE));
    for (const [name, step] of Object.entries(TYPE_SCALE)) {
      const row = type.slice(type.indexOf(`data-step="${name}"`));
      const card = row.slice(0, row.indexOf('</li>'));
      expect(card).toContain(step.face);
      expect(card).toContain(`${step.size}px`);
      expect(card).toContain(`var(--type-${name}-size)`);
      if (step.slant) expect(card).toContain(`${step.slant}°`);
    }
  });

  it('shows every sprite in every frame, the icons in their own section', () => {
    const shown = new Set([...html.matchAll(/data-sprite="([^"]+)" data-frame="(\d)"/g)].map((m) => `${m[1]}#${m[2]}`));
    for (const name of Object.keys(SPRITE_DEFS)) {
      for (const frame of [0, 1]) expect(shown.has(`${name}#${frame}`), `${name} frame ${frame}`).toBe(true);
    }
    const icons = section('icons');
    expect(ICONS.length).toBeGreaterThan(0);
    expect(new Set(values(icons, 'data-sprite'))).toEqual(new Set(ICONS));
    expect(values(section('sprites'), 'data-sprite').some((n) => n !== undefined && ICONS.includes(n))).toBe(false);
  });

  it('dresses both heroes in every fleet’s colours', () => {
    const heroes = section('heroes');
    for (const [name, fleet] of Object.entries(DEMO_PROJECTS.teams)) {
      for (const body of ['girl', 'boy']) expect(heroes, `${body} ${name}`).toContain(`data-hero="${body}" data-fleet="${name}"`);
      expect(heroes).toContain(fleet.label ?? name);
    }
  });

  it('draws the three OmniMan poses at poster scale, in both frames', () => {
    const poses = section('poses');
    const scale: number = POSTER_SCALE;
    const most: number = POSTER_MAX_SCALE;
    expect(Number.isInteger(scale) && scale >= 2 && scale <= most).toBe(true);
    for (const pose of OMNI_POSES) {
      for (const frame of [0, 1]) {
        const at = poses.indexOf(`data-pose="${pose}" data-frame="${frame}"`);
        expect(at, `${pose} ${frame}`).toBeGreaterThanOrEqual(0);
        const svg = sure(poses.slice(at).match(/<svg [^>]*width="(\d+)" height="(\d+)"/), `the ${pose} ${frame} drawing`);
        expect([Number(svg[1]), Number(svg[2])]).toEqual([32 * POSTER_SCALE, 48 * POSTER_SCALE]);
      }
    }
  });

  it('draws every pixel crisp: no SVG on the page is smoothed', () => {
    const svgs = sure(html.match(/<svg [^>]*>/g), 'the page\'s drawings');
    expect(svgs.length).toBeGreaterThan(100);
    for (const svg of svgs) expect(svg).toContain('shape-rendering="crispEdges"');
  });
});

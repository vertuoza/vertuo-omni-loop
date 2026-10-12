import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OMNI_LOOP } from '@omni/design';
import { Doorway } from './Doorway';

// The doorway (PRD 1705), as the server renders it around a page's card: the ask root and its theme
// script, the starfield, the crest linking to HOME, the card, a Docs link, and no part of the app.

const html = renderToStaticMarkup(createElement(Doorway, null, createElement('section', { className: 'ask-card' }, 'the card')));
const css = readFileSync(new URL('./doorway.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the doorway (PRD 1705)', () => {
  it('writes the theme tokens, then the ask root with its theme script as its first child', () => {
    expect(html).toMatch(/^<style>[^<]*--ask-ground/);
    expect(html).toMatch(/<div class="ask doorway"><script\b/);
  });

  it('lays the starfield behind everything, hidden from assistive technology', () => {
    expect(html).toMatch(/<div class="doorway-stars" aria-hidden="true"><svg\b[^>]*viewBox="0 0 320 270"/);
  });

  it('puts the crest\'s full form above the card, named and linking to HOME, at 3×', () => {
    const mark = /<a class="doorway-mark" href="\/">(<svg[^>]*>)/.exec(html);
    expect(mark?.[1]).toContain(`aria-label="${OMNI_LOOP.name}"`);
    expect(mark?.[1]).toContain('width="366" height="54"');
  });

  it('holds the page\'s card in the column, then a Docs link', () => {
    expect(html).toMatch(/<main class="ask-main doorway-main"><a class="doorway-mark"[\s\S]*<div class="doorway-card"><section class="ask-card">the card<\/section><\/div><p class="doorway-foot"><a href="\/docs">Docs<\/a><\/p><\/main>/);
  });

  it('draws no part of the app: no sidebar, no top bar, no theme switch, no Game mode', () => {
    expect(html).not.toMatch(/app-shell|<nav\b|<header\b|<aside\b|Game mode|aria-label="Theme"/);
  });

  it('hides the stars under Light, draws the crest at whole-number scales only, and names no colour', () => {
    expect(css).toMatch(/\.ask\[data-ask-theme='light'\] \.doorway-stars \{ display: none; \}/);
    expect(css).toMatch(/\.doorway-mark svg \{[^}]*width: 366px; height: 54px;/);
    expect(css).toMatch(/@media \(max-width: 899px\) \{\s*\.doorway-mark svg \{ width: 244px; height: 36px; \}/);
    expect(css).toMatch(/\.doorway-card \{ width: 100%; max-width: 460px; \}/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
  });
});

import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Advance } from './Advance';
import { Handheld, type BodyProps } from './Handheld';
import { sure } from './test/sure';

// The two Game Boy bodies, rendered as the server would: with the app to leave for, each carries the
// GAME ▮▯ APP switch (PRD 238), the upright one at the right end of its wordmark row, the sideways one
// under the grille on its right wing. Without the app (the single-file artifact), neither has one.
// That it fires on touch-down and opens OPEN THE APP? is checked by hand: nothing here runs a browser.

const BODIES: [string, FunctionComponent<BodyProps>][] = [['Handheld', Handheld], ['Advance', Advance]];
const base: BodyProps = { season: '2026-09', muted: false, onAction: () => {}, onSound: () => {} };
const html = (Body: FunctionComponent<BodyProps>, props: Partial<BodyProps> = {}) =>
  renderToStaticMarkup(createElement(Body, { ...base, ...props }));

/** The switch's button, whole, in a body's markup. */
const SWITCH = /<button[^>]*aria-label="Switch to the app"[^>]*>[\s\S]*?<\/button>/g;
const switches = (markup: string) => markup.match(SWITCH) ?? [];
const onApp = () => {};

describe('the GAME ▮▯ APP switch', () => {
  for (const [name, Body] of BODIES) {
    it(`is on the ${name} body with the app: one button, named "Switch to the app", reading GAME and APP`, () => {
      const found = switches(html(Body, { onApp }));
      expect(found).toHaveLength(1);
      const button = sure(found[0], 'found[0]');
      expect(button).toMatch(/^<button type="button" class="gb-switch"/);
      expect(button.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean)).toEqual(['GAME', 'APP']);
    });

    it(`is not on the ${name} body without the app`, () => {
      const markup = html(Body);
      expect(switches(markup)).toEqual([]);
      expect(markup).not.toContain('gb-switch');
    });

    it(`adds nothing else to the ${name} body: the rest of it is the same, part for part`, () => {
      for (const muted of [false, true]) {
        const withSwitch = html(Body, { onApp, muted });
        expect(switches(withSwitch)).toHaveLength(1);
        expect(withSwitch.replace(SWITCH, '')).toBe(html(Body, { muted }));
      }
    });

    it(`rests its knob on GAME on the ${name} body, and shows APP while OPEN THE APP? is up`, () => {
      expect(switches(html(Body, { onApp }))[0]).toContain('data-side="game"');
      expect(switches(html(Body, { onApp, leaving: false }))[0]).toContain('data-side="game"');
      expect(switches(html(Body, { onApp, leaving: true }))[0]).toContain('data-side="app"');
    });
  }

  it('sits at the right end of the upright body\'s wordmark row: right after the wordmark, before the pad', () => {
    const markup = html(Handheld, { onApp });
    const word = markup.indexOf('<p class="gb-word">'), sw = markup.search(SWITCH), pad = markup.indexOf('class="gb-pad"');
    expect(word).toBeGreaterThanOrEqual(0);
    expect(sure(markup.slice(word).match(/^<p class="gb-word">[\s\S]*?<\/p>/), 'markup.slice(word).match(/^<p class="gb-word">[\s\S]*?<\/p>/)')[0].length + word).toBe(sw);
    expect(sw).toBeLessThan(pad);
  });

  it('sits under the grille on the sideways body\'s right wing, and the wordmark stays under the lens', () => {
    const markup = html(Advance, { onApp });
    const right = markup.slice(markup.indexOf('gb-wing-right'), markup.indexOf('<p class="gb-word">'));
    const grille = right.indexOf('class="gb-grille"'), sw = right.search(SWITCH);
    expect(grille).toBeGreaterThanOrEqual(0);
    expect(sw).toBeGreaterThan(grille);
    expect(markup.slice(0, markup.indexOf('gb-wing-right'))).not.toContain('gb-switch');
  });
});

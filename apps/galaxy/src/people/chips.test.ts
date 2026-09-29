import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { faceOf } from './face';
import { FleetChip } from './FleetChip';
import { PersonChip } from './PersonChip';

// The two chips (PRD 652, design A · bare sprite), to static markup: the picture inline, decorative,
// then the name or the label, so a row's text is the same as before the picture came.

const text = (html: string) => html.replace(/<[^>]+>/g, '').trim();
const HERO = { v: 1, body: 'boy', skin: 1, hair: 0, suit: 0, cape: 1 };
const person = (face: ReturnType<typeof faceOf>) => renderToStaticMarkup(createElement(PersonChip, { person: { name: 'ADA', face } }));

describe('PersonChip', () => {
  it('draws a hero hidden from screen readers, then the name', () => {
    const html = person(faceOf({ name: 'ADA', hero: HERO, color: '#3355ff' }));
    expect(html).toMatch(/<span class="person-face is-hero" aria-hidden="true"><svg /);
    expect(text(html)).toBe('ADA');
  });

  it('draws a photo with an empty alt, over a neutral circle, then the name', () => {
    const html = person(faceOf({ name: 'ADA', login: 'ada-gh' }));
    expect(html).toContain('<img class="person-face is-photo" src="https://github.com/ada-gh.png?size=48" alt=""');
    expect(text(html)).toBe('ADA');
  });

  it('draws an initial that adds no text, then the name', () => {
    const html = person(faceOf({ name: 'ADA' }));
    expect(html).toContain('<span class="person-face is-initial" aria-hidden="true" data-initial="A"></span>');
    expect(text(html)).toBe('ADA');
  });

  it('is 24 px in a table and 18 px in a sentence', () => {
    const face = faceOf({ name: 'ADA' });
    expect(renderToStaticMarkup(createElement(PersonChip, { person: { name: 'ADA', face } }))).toContain('class="person-chip is-table"');
    expect(renderToStaticMarkup(createElement(PersonChip, { person: { name: 'ADA', face }, size: 'inline' }))).toContain('class="person-chip is-inline"');
  });
});

describe('FleetChip', () => {
  const chip = (fleet: Parameters<typeof FleetChip>[0]['fleet']) => renderToStaticMarkup(createElement(FleetChip, { fleet }));

  it('draws the mascot, hidden, then the label in the fleet colour', () => {
    const html = chip({ name: 'octo', label: 'OCTO', color: '#3355ff', mascot: 'octopod' });
    expect(html).toContain('style="--fleet:#3355ff"');
    expect(html).toMatch(/<span class="fleet-chip-mascot" aria-hidden="true"><svg /);
    expect(html).not.toMatch(/<title|role="img"/);
    expect(text(html)).toBe('OCTO');
  });

  it('draws a caped hero for a fleet with no mascot, and no colour that is not one', () => {
    const none = chip({ name: 'x', label: 'X', color: 'red;background:url(x)', mascot: null });
    expect(none).toMatch(/<span class="fleet-chip-mascot" aria-hidden="true"><svg /);
    expect(none).not.toContain('url(x)');
    expect(none).not.toContain('--fleet');
    expect(text(none)).toBe('X');
    expect(chip({ name: 'x', label: 'X', color: '#3355ff', mascot: null })).not.toBe(chip({ name: 'x', label: 'X', color: '#ff3355', mascot: null }));
  });

  it('reads SOLO for a player with no fleet', () => {
    const html = chip('solo');
    expect(html).toBe('<span class="fleet-chip is-solo">SOLO</span>');
  });
});

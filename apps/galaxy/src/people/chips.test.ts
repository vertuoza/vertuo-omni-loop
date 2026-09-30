import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { faceOf } from './face';
import { FleetChip } from './FleetChip';
import { nestedLinks } from './nested-links';
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

// PRD 698 s1: a chip is a link. A person with a login opens their profile, a fleet opens its board;
// a chip drawn inside another link or button passes link={false} and stays the plain span of before.
describe('the chips as links (PRD 698)', () => {
  const face = faceOf({ name: 'ADA' });
  const personChip = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(PersonChip, { person: { name: 'ADA', face }, ...props } as never));
  const fleetChip = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(FleetChip, props as never));
  const OCTO = { name: 'octo', label: 'OCTO', color: '#3355ff', mascot: 'octopod' };

  it('a person with a login links to their profile, the name alone in its own span', () => {
    const html = personChip({ person: { name: 'ADA', face, login: 'ada-gh' } });
    expect(html).toMatch(/^<a class="person-chip is-table" href="\/app\/people\/ada-gh">/);
    expect(html).toContain('<span class="person-chip-name">ADA</span></a>');
    expect(text(html)).toBe('ADA');
  });

  it('a login is put in lower case and escaped in the address', () => {
    expect(personChip({ person: { name: 'ADA', face, login: 'Ada GH' } })).toContain('href="/app/people/ada%20gh"');
  });

  it('a person with no login stays a span', () => {
    expect(personChip({})).toMatch(/^<span class="person-chip is-table">/);
    expect(personChip({})).not.toContain('<a');
  });

  it('link={false} keeps a person with a login a span', () => {
    const html = personChip({ person: { name: 'ADA', face, login: 'ada-gh' }, link: false });
    expect(html).toMatch(/^<span class="person-chip is-table">/);
    expect(html).not.toContain('<a');
  });

  it('a fleet links to its board, the label as the name', () => {
    const html = fleetChip({ fleet: OCTO });
    expect(html).toMatch(/^<a class="fleet-chip is-table" href="\/app\/fleet\?fleet=octo" style="--fleet:#3355ff">/);
    expect(html).toContain('<span class="fleet-chip-label">OCTO</span></a>');
  });

  it('a fleet name is escaped in the address', () => {
    expect(fleetChip({ fleet: { ...OCTO, name: 'a&b c' } })).toContain('href="/app/fleet?fleet=a%26b%20c"');
  });

  it('link={false} keeps a fleet a span, and SOLO is never a link', () => {
    expect(fleetChip({ fleet: OCTO, link: false })).toMatch(/^<span class="fleet-chip is-table"/);
    expect(fleetChip({ fleet: 'solo' })).toBe('<span class="fleet-chip is-solo">SOLO</span>');
  });

  it('nestedLinks counts a link opened inside another, and nothing else', () => {
    expect(nestedLinks('<a href="/x">x <span>y</span></a> <a href="/z">z</a>')).toBe(0);
    expect(nestedLinks('<a href="/x">x <a class="person-chip" href="/p">p</a></a>')).toBe(1);
    expect(nestedLinks('<abbr>a</abbr><a href="/x">x</a>')).toBe(0);
    expect(nestedLinks(`<a href="/x">${personChip({ person: { name: 'ADA', face, login: 'ada-gh' } })}</a>`)).toBe(1);
  });

  it('underlines only the name, on hover or focus, and rings the focused chip', () => {
    const css = readFileSync(new URL('./people.css', import.meta.url), 'utf8');
    expect(css).toMatch(/a\.person-chip, a\.fleet-chip \{[^}]*text-decoration: none/);
    expect(css).toContain('a.person-chip:hover .person-chip-name, a.person-chip:focus-visible .person-chip-name,\na.fleet-chip:hover .fleet-chip-label, a.fleet-chip:focus-visible .fleet-chip-label { text-decoration: underline; }');
    expect(css).toMatch(/a\.person-chip:focus-visible, a\.fleet-chip:focus-visible \{[^}]*outline: 2px solid/);
  });
});

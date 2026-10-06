// The words of /releases (PRD 262): the page's own, the initial release's headline and intro, and the
// way it writes a day, a week and its counts, in English, whatever the server's locale.
import { describe, expect, it } from 'vitest';
import { brusselsDay } from './weeks';
import { countsOf, dayOf, isoDateOf, prdOf, RELEASES, weekOf } from './words';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

describe('the page\'s words', () => {
  it('are the spec\'s', () => {
    expect(RELEASES.sub).toBe('Releases');
    expect(RELEASES.title).toBe('Release notes · Omni Loop');
    expect(RELEASES.heading).toBe('What’s new in Omni Loop');
    expect(RELEASES.line).toBe('Every PRD the loop ships, in plain words. Newest first.');
    expect(RELEASES.unavailable).toBe('Release notes are unavailable right now.');
  });

  it('carry the initial release\'s name, headline and intro', () => {
    expect(RELEASES.initial.name).toBe('Initial release');
    expect(RELEASES.initial.headline).toBe('From idea to merged PR, on a loop.');
    expect(RELEASES.initial.intro).toBe(
      'The first public release of Omni Loop gathers everything shipped from 24 to 27 September 2026: the kit and its '
      + 'Claude Code plugin, the omni-loop GitHub App, ask mode and its question history, a knowledge base that fills itself, '
      + 'PRD dossiers, a design system, and the arcade that turns delivery into a game.',
    );
  });

  it('describe the page in one line for search engines and link previews, naming no link', () => {
    expect(RELEASES.description.length).toBeGreaterThan(40);
    expect(RELEASES.description.length).toBeLessThanOrEqual(160);
    expect(RELEASES.description).not.toMatch(/https?:|www\.|github/i);
  });
});

describe('a day, a week and its counts', () => {
  const sunday = brusselsDay('2026-09-27T13:29:53+00:00');

  it('write a release\'s day as its weekday, its date and its month', () => {
    expect(dayOf(sunday)).toBe('Sun 27 Sep');
    expect(dayOf(brusselsDay('2026-09-28T23:30:00+00:00'))).toBe('Tue 29 Sep');
    expect(dayOf(brusselsDay('2027-01-04T09:00:00+00:00'))).toBe('Mon 4 Jan');
  });

  it('head a week with its Monday, in full', () => {
    expect(weekOf({ year: 2026, month: 9, day: 21, weekday: 0 })).toBe('Week of 21 Sep 2026');
    expect(weekOf({ year: 2026, month: 12, day: 28, weekday: 0 })).toBe('Week of 28 Dec 2026');
  });

  it('give a day as a machine reads it', () => {
    expect(isoDateOf(sunday)).toBe('2026-09-27');
    expect(isoDateOf({ year: 2027, month: 1, day: 4, weekday: 0 })).toBe('2027-01-04');
  });

  it('count releases and PRDs, one or many', () => {
    expect(countsOf(1, 21)).toBe('1 release · 21 PRDs');
    expect(countsOf(2, 2)).toBe('2 releases · 2 PRDs');
    expect(countsOf(1, 1)).toBe('1 release · 1 PRD');
  });

  it('name a PRD by its number, as plain words', () => {
    expect(prdOf(parsePrd(262))).toBe('PRD 262');
  });
});

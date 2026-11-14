import { describe, expect, it } from 'vitest';
import { HERO_ROLES } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import type { Hero } from './heroes.contract';
import { heroSvg, missingRoles, rowOf, WORDS } from './heroes';

// The Heroes tab's rules (PRD 2842 s6): the sprite each role is drawn with, in the fleet's colour at a
// whole-number scale; each hero's row and words; the roles a fleet may still add.

const hero = (role: Hero['role'], skills: string[]): Hero => ({
  id: '22222222-2222-4222-8222-222222222222', fleet: 'night-shift', name: role.toUpperCase(), role, skills, agent: 'claude', model: 'sonnet', limits: ['It never merges into the default branch.'], position: 0,
});

describe('heroSvg', () => {
  it('draws each role as a crisp SVG at a whole-number scale, in the fleet\'s colour', () => {
    const colours = new Set<string>();
    for (const role of HERO_ROLES) {
      const svg = heroSvg(role, '#4fb0ff', 'x', 3);
      expect(svg).toMatch(/^<svg [^>]*shape-rendering="crispEdges"/);
      expect(svg.toLowerCase()).toContain('#4fb0ff'.slice(0, 3));
      colours.add(svg);
    }
    expect(colours.size).toBe(HERO_ROLES.length);
  });

  it('wears the fleet\'s colour on the suit, and a neutral grey when it has none', () => {
    expect(heroSvg('qa', '#ff0000', '', 2)).not.toBe(heroSvg('qa', '#00ff00', '', 2));
    expect(heroSvg('qa', null, '', 2)).toBe(heroSvg('qa', '#cfd4e6', '', 2));
  });

  it('is twice as wide at twice the scale', () => {
    const width = (svg: string) => Number(/width="(\d+)"/.exec(svg)?.[1]);
    expect(width(heroSvg('pm', null, '', 4))).toBe(2 * width(heroSvg('pm', null, '', 2)));
  });

  it('refuses a scale that is not whole', () => {
    expect(() => heroSvg('pm', null, '', 1.5)).toThrow(/whole number/);
  });
});

describe('rowOf', () => {
  it('writes an Engineer as an agent that works alone, its skills as the kit names them', () => {
    const row = rowOf(hero('engineer', ['yolo', 'wave']));
    expect(row).toMatchObject({ heading: 'Engineer · agent', skills: ['/omni:yolo', '/omni:wave'], preferred: 'claude · sonnet', alone: true, line: WORDS.alone, why: null });
  });

  it('writes a role no unattended skill runs as `A person does this today`, with why', () => {
    expect(rowOf(hero('pm', ['pitch', 'plan']))).toMatchObject({ heading: 'PM · agent', alone: false, line: WORDS.person, why: 'Its brainstorm and roadmap need a person.' });
    expect(rowOf(hero('reviewer', []))).toMatchObject({ skills: [], alone: false, why: 'Its review skill is not built yet.' });
  });

  it('reads the hero\'s own skills, not its role\'s: a QA with none does not work alone', () => {
    expect(rowOf(hero('qa', [])).alone).toBe(false);
    expect(rowOf(hero('qa', ['prove'])).alone).toBe(true);
  });
});

describe('missingRoles', () => {
  it('lists the roles no hero holds, in the drawer\'s order', () => {
    expect(missingRoles([hero('qa', []), hero('pm', [])])).toEqual(['engineer', 'reviewer', 'architect']);
    expect(missingRoles([])).toEqual([...HERO_ROLES]);
    expect(missingRoles(HERO_ROLES.map((role) => hero(role, [])))).toEqual([]);
  });
});

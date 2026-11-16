import { describe, expect, it } from 'vitest';
import { HERO_ROLES, roleOf } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import type { Hero } from './heroes.contract';
import { heroSvg, missingRoles, rowOf, WORDS } from './heroes';

// The Heroes tab's rules (PRD 2842 s6, PRD 2873 s3): the sprite each role is drawn with, in the fleet's colour at
// a whole-number scale; each hero's row, its count line and its skills marked from the runner's list; the roles a
// fleet may still add.

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
  it('writes an Engineer as an agent with its count line, its skills as the kit names them, those that run alone first', () => {
    const row = rowOf(hero('engineer', [...roleOf('engineer').skills]));
    expect(row).toMatchObject({ heading: 'Engineer · agent', preferred: 'claude · sonnet', alone: true, line: 'Runs 10 of 13 skills alone' });
    expect(row.skills.map((s) => `${s.name} ${s.words}`)).toEqual([
      '/omni:yolo runs alone', '/omni:yolo-fix runs alone', '/omni:wave runs alone', '/omni:do-work runs alone', '/omni:pr-care runs alone',
      '/omni:bug-fix runs alone', '/omni:mega-bug-fix runs alone', '/omni:ultra-yolo runs alone', '/omni:ultra-yolo-fix runs alone',
      '/omni:ultra-wave runs alone', '/omni:mega-pr-care needs a person', '/omni:drive needs a person', '/omni:mega-drive needs a person',
    ]);
  });

  it('puts the skills that run alone first, whatever order the hero holds them in', () => {
    expect(rowOf(hero('pm', ['mission', 'pitch', 'brainstorm', 'plan'])).skills.map((s) => s.name)).toEqual(['/omni:pitch', '/omni:brainstorm', '/omni:plan', '/omni:mission']);
  });

  it('writes a Reviewer with its review as an agent that runs it alone, its tech-review a person\'s (PRD 2871)', () => {
    const row = rowOf(hero('reviewer', [...roleOf('reviewer').skills]));
    expect(row).toMatchObject({ heading: 'Reviewer · agent', alone: true, line: 'Runs 1 of 2 skills alone' });
    expect(row.skills.map((s) => `${s.name} ${s.words}`)).toEqual(['/omni:review runs alone', '/omni:tech-review needs a person']);
  });

  it('writes a hero none of whose skills runs alone as `A person does this today`, with no why', () => {
    const row = rowOf(hero('reviewer', ['tech-review']));
    expect(row).toMatchObject({ heading: 'Reviewer · agent', alone: false, line: WORDS.person, skills: [{ name: '/omni:tech-review', mark: 'person', words: 'needs a person' }] });
    expect(row).not.toHaveProperty('why');
    expect(rowOf(hero('reviewer', []))).toMatchObject({ skills: [], alone: false, line: WORDS.person });
  });

  it('reads the hero\'s own skills, not its role\'s: a QA with none runs nothing alone', () => {
    expect(rowOf(hero('qa', [])).alone).toBe(false);
    expect(rowOf(hero('qa', ['prove'])).line).toBe('Runs 1 of 1 skill alone');
  });

  it('writes the Designer\'s three skills, one of which runs alone', () => {
    expect(rowOf(hero('designer', [...roleOf('designer').skills]))).toMatchObject({ heading: 'Designer · agent', line: 'Runs 1 of 3 skills alone' });
  });
});

describe('missingRoles', () => {
  it('lists the roles no hero holds, in the drawer\'s order', () => {
    expect(missingRoles([hero('qa', []), hero('pm', [])])).toEqual(['engineer', 'reviewer', 'architect', 'designer']);
    expect(missingRoles([])).toEqual([...HERO_ROLES]);
    expect(missingRoles(HERO_ROLES.map((role) => hero(role, [])))).toEqual([]);
  });
});

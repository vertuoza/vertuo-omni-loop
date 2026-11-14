import { describe, expect, it } from 'vitest';
import { HERO_ROLES, HeroRoleSchema, PERSON_TODAY, ROLES, roleLine, roleOf, worksAlone } from './roles.ts';

// The five roles of a Virtual Hero (PRD 2842 s1): one list, in the drawer's order, each with the skills
// its role runs, and whether it works alone read from those skills.

describe('the roles of a Virtual Hero', () => {
  it('lists the five roles once each, in the drawer\'s order, those that work alone first', () => {
    expect(ROLES.map((r) => r.role)).toEqual([...HERO_ROLES]);
    expect(HERO_ROLES).toEqual(['engineer', 'qa', 'reviewer', 'pm', 'architect']);
  });

  it('gives each role the skills the spec names', () => {
    expect(roleOf('engineer').skills).toEqual(['yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix']);
    expect(roleOf('qa').skills).toEqual(['prove', 'bug-fix']);
    expect(roleOf('pm').skills).toEqual(['pitch', 'plan']);
    expect(roleOf('architect').skills).toEqual(['plan']);
    expect(roleOf('reviewer').skills).toEqual([]);
  });

  it('names each hero by its role, never a person\'s first name', () => {
    expect(ROLES.map((r) => r.name)).toEqual(['Engineer', 'QA', 'Reviewer', 'PM', 'Architect']);
  });

  it('gives each hero an agent, a model and limits in whole sentences', () => {
    for (const r of ROLES) {
      expect(r.agent).toBe('claude');
      expect(r.model).toMatch(/^[a-z]+$/);
      expect(r.limits.length).toBeGreaterThan(0);
      for (const limit of r.limits) expect(limit).toMatch(/^[A-Z].*\.$/);
      expect(r.limits).toContain('It never merges into the default branch.');
    }
  });

  it('reads a role as working alone when one of its skills runs with nobody at it', () => {
    expect(worksAlone(['plan'])).toBe(false);
    expect(worksAlone([])).toBe(false);
    expect(worksAlone(['pitch', 'prove'])).toBe(true);
    expect(ROLES.filter((r) => worksAlone(r.skills)).map((r) => r.role)).toEqual(['engineer', 'qa']);
  });

  it('says on screen what a role does alone, or that a person does it today, and why', () => {
    expect(roleLine('engineer')).toEqual({ alone: true, line: 'Builds PRDs alone', why: null });
    expect(roleLine('qa')).toEqual({ alone: true, line: 'Proves the work alone', why: null });
    for (const role of ['reviewer', 'pm', 'architect'] as const) {
      const line = roleLine(role);
      expect(line.alone).toBe(false);
      expect(line.line).toBe(PERSON_TODAY);
      expect(line.why).toMatch(/^[A-Z].*\.$/);
    }
    // A hero whose skills changed reads from its own skills, not its role's defaults.
    expect(roleLine('pm', ['prove']).alone).toBe(true);
    expect(roleLine('engineer', []).line).toBe(PERSON_TODAY);
  });

  it('refuses a role it does not know', () => {
    expect(HeroRoleSchema.safeParse('designer').success).toBe(false);
    expect(HeroRoleSchema.parse('qa')).toBe('qa');
    expect(() => roleOf('designer' as never)).toThrow(/designer/);
  });
});

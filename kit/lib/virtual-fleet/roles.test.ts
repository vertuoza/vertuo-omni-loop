import { describe, expect, it } from 'vitest';
import { RUNNABLE_SKILLS } from '../runner/line.ts';
import { HERO_ROLES, HeroRoleSchema, PERSON_TODAY, ROLES, roleLine, roleOf, skillMarks, worksAlone } from './roles.ts';

// The six roles of a Virtual Hero (PRD 2842 s1, PRD 2873 s3): one list, in the drawer's order, each with
// every skill of its role, each skill marked `alone` or `person` from the runner's own list, and the
// hero's count line read from those marks.

describe('the roles of a Virtual Hero', () => {
  it('lists the six roles once each, in the drawer\'s order, the Designer last', () => {
    expect(ROLES.map((r) => r.role)).toEqual([...HERO_ROLES]);
    expect(HERO_ROLES).toEqual(['engineer', 'qa', 'reviewer', 'pm', 'architect', 'designer']);
  });

  it('gives each role every skill of its role, as the spec\'s table lists them', () => {
    expect(roleOf('engineer').skills).toEqual([
      'yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix', 'mega-bug-fix', 'ultra-yolo', 'ultra-yolo-fix', 'ultra-wave', 'mega-pr-care', 'drive', 'mega-drive', 'repair',
    ]);
    expect(roleOf('qa').skills).toEqual(['qa', 'prove', 'bug-fix', 'validate-e2e']);
    expect(roleOf('reviewer').skills).toEqual(['review', 'tech-review']);
    expect(roleOf('pm').skills).toEqual(['pitch', 'plan', 'brainstorm', 'roadmap', 'mega-brainstorm', 'mega-roadmap', 'mission']);
    expect(roleOf('architect').skills).toEqual(['plan', 'tech-review']);
    expect(roleOf('designer').skills).toEqual(['visual-fix', 'pixel-perfect', 'think-big']);
  });

  it('gives the Reviewer its six limits, in the spec\'s words and order (PRD 2871)', () => {
    expect(roleOf('reviewer').limits).toEqual([
      'It never merges into the default branch.',
      'It never answers for a person.',
      'It never approves on GitHub.',
      'It marks ready on its pass only.',
      'It raises five findings at most.',
      'It reviews two rounds at most.',
    ]);
    expect(roleOf('reviewer').model).toBe('opus');
  });

  it('gives QA its four limits after every hero\'s two, and drops "It reports what it saw" (PRD 3001)', () => {
    expect(roleOf('qa').limits).toEqual([
      'It never merges into the default branch.',
      'It never answers for a person.',
      'It never writes the branch.',
      'It reports bugs to the Engineer.',
      'It reports five bugs at most.',
      'It checks two rounds at most.',
    ]);
    expect(roleOf('qa').limits).not.toContain('It reports what it saw; a person decides.');
  });

  it('puts no skill of no role on a hero', () => {
    const all = ROLES.flatMap((r) => r.skills);
    for (const skill of ['retro-apply', 'rewind', 'rewind-apply', 'knowledge-add', 'help', 'status']) expect(all).not.toContain(skill);
  });

  it('names each hero by its role, never a person\'s first name', () => {
    expect(ROLES.map((r) => r.name)).toEqual(['Engineer', 'QA', 'Reviewer', 'PM', 'Architect', 'Designer']);
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

  it('gives the Designer claude and opus, and the limits the spec names', () => {
    expect(roleOf('designer')).toMatchObject({
      agent: 'claude', model: 'opus',
      limits: ['It never merges into the default branch.', 'It never answers for a person.', 'It never locks a screen: a person does.'],
    });
  });

  it('refuses a role it does not know', () => {
    expect(HeroRoleSchema.safeParse('designer').success).toBe(true);
    expect(HeroRoleSchema.safeParse('writer').success).toBe(false);
    expect(HeroRoleSchema.parse('qa')).toBe('qa');
    expect(() => roleOf('writer' as never)).toThrow(/writer/);
  });
});

describe('skillMarks', () => {
  it('marks a skill `alone` exactly when the runner\'s list holds it, `person` otherwise', () => {
    for (const r of ROLES) {
      for (const { skill, mark } of skillMarks(r.skills)) expect(mark).toBe(RUNNABLE_SKILLS.includes(skill) ? 'alone' : 'person');
    }
  });

  it('changes a mark when the runner\'s list changes, and nothing else', () => {
    expect(skillMarks(['tech-review'])).toEqual([{ skill: 'tech-review', mark: 'person' }]);
    expect(skillMarks(['tech-review'], [...RUNNABLE_SKILLS, 'tech-review'])).toEqual([{ skill: 'tech-review', mark: 'alone' }]);
  });

  it('lists the skills that run alone first, each group in its own order', () => {
    expect(skillMarks(['drive', 'yolo', 'mega-drive', 'wave']).map((m) => `${m.skill}:${m.mark}`)).toEqual(['yolo:alone', 'wave:alone', 'drive:person', 'mega-drive:person']);
    expect(skillMarks([])).toEqual([]);
  });
});

describe('the count line', () => {
  it('reads `Runs <k> of <n> skills alone` for each role with a skill that runs alone', () => {
    expect(roleLine('engineer')).toEqual({ alone: true, line: 'Runs 11 of 14 skills alone' });
    // PRD 3001: QA runs /omni:qa, /omni:prove and /omni:bug-fix alone; /omni:validate-e2e still needs a person.
    expect(roleLine('qa')).toEqual({ alone: true, line: 'Runs 3 of 4 skills alone' });
    expect(roleLine('pm').line).toBe('Runs 7 of 7 skills alone');
    expect(roleOf('pm').limits).toContain('It never approves a PRD it wrote, nor one outside a mission\'s committee.');
    expect(roleLine('architect').line).toBe('Runs 1 of 2 skills alone');
    expect(roleLine('designer').line).toBe('Runs 1 of 3 skills alone');
    // PRD 2871: the Reviewer runs its review alone; its tech-review still needs a person.
    expect(roleLine('reviewer')).toEqual({ alone: true, line: 'Runs 1 of 2 skills alone' });
  });

  it('reads `A person does this today` for a hero none of whose skills runs alone, with no why', () => {
    expect(roleLine('reviewer', ['tech-review'])).toEqual({ alone: false, line: PERSON_TODAY });
    expect(PERSON_TODAY).toBe('A person does this today');
    expect(roleLine('engineer', [])).toEqual({ alone: false, line: PERSON_TODAY });
  });

  it('reads the hero\'s own skills, and the runner\'s list it is given', () => {
    expect(roleLine('pm', ['prove']).line).toBe('Runs 1 of 1 skill alone');
    expect(roleLine('reviewer', ['tech-review'], [...RUNNABLE_SKILLS, 'tech-review'])).toEqual({ alone: true, line: 'Runs 1 of 1 skill alone' });
  });

  it('works alone when one of its skills runs with nobody at it', () => {
    expect(worksAlone(['tech-review'])).toBe(false);
    expect(worksAlone([])).toBe(false);
    expect(worksAlone(['pitch', 'think-big'])).toBe(true);
    expect(worksAlone(['review'])).toBe(true);
    expect(ROLES.filter((r) => !worksAlone(r.skills)).map((r) => r.role)).toEqual([]);
  });
});

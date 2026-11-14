/**
 * **The six roles of a Virtual Hero** (PRD 2842, slice s1; PRD 2873, slice s3).
 *
 * A Virtual Fleet is a fleet whose members are Virtual Heroes: agents, one per role, never players. A
 * hero is a role with its skills. This module is the one list of the roles, in the order the New
 * virtual fleet drawer shows them, each with what a new hero of that role starts with: its name (its
 * role, never a person's first name), every kit skill of its role, its preferred agent and model
 * (recorded only: the runner's accounts still decide), and its limits in sentences.
 *
 * `supabase/migrations/20270122121000_heroes_every_skill.sql` keeps the same defaults in
 * `virtual_hero_roles()`, which `create_virtual_fleet()` and `add_virtual_hero()` copy onto each hero
 * they make; the arcade's `virtual-fleets/roles-sql.test.ts` fails when the two differ.
 *
 * **Runs alone** is read from the runner's own list ({@link RUNNABLE_SKILLS}), never a list of its own:
 * a skill runners take reads `alone`, any other `person`, so a skill a later PRD lets runners take
 * reads `alone` the day it ships (bug #2870).
 */
import { z } from 'zod';
import { RUNNABLE_SKILLS } from '../runner/line.ts';

/** The roles, in the drawer's order. */
export const HERO_ROLES = ['engineer', 'qa', 'reviewer', 'pm', 'architect', 'designer'] as const;

export type HeroRole = (typeof HERO_ROLES)[number];

export const HeroRoleSchema = z.enum(HERO_ROLES);

/** What a new hero of a role starts with. */
export interface RoleDefaults {
  role: HeroRole;
  /** Its name: its role, never a person's first name. */
  name: string;
  /** Every kit skill of its role, without the `omni:` prefix. */
  skills: readonly string[];
  /** The agent and model it prefers: recorded, not routed (PRD 2842 leaves that to the runner's accounts). */
  agent: string;
  model: string;
  /** What it never does, one sentence each. */
  limits: readonly string[];
}

/** What every hero never does, whatever its role (the mission's mandate). */
const EVERY_HERO: readonly string[] = ['It never merges into the default branch.', 'It never answers for a person.'];

export const ROLES: readonly RoleDefaults[] = [
  {
    role: 'engineer', name: 'Engineer',
    skills: ['yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix', 'mega-bug-fix', 'ultra-yolo', 'ultra-yolo-fix', 'ultra-wave', 'mega-pr-care', 'drive', 'mega-drive'],
    agent: 'claude', model: 'sonnet', limits: [...EVERY_HERO, 'It waits for a person wherever one is needed.'],
  },
  {
    role: 'qa', name: 'QA', skills: ['prove', 'bug-fix', 'validate-e2e'],
    agent: 'claude', model: 'sonnet', limits: [...EVERY_HERO, 'It reports what it saw; a person decides.'],
  },
  {
    role: 'reviewer', name: 'Reviewer', skills: ['tech-review'],
    agent: 'claude', model: 'opus', limits: [...EVERY_HERO, 'It never approves a pull request.'],
  },
  {
    role: 'pm', name: 'PM', skills: ['pitch', 'plan', 'brainstorm', 'roadmap', 'mega-brainstorm', 'mega-roadmap', 'mission'],
    agent: 'claude', model: 'opus', limits: [...EVERY_HERO, 'It never approves a PRD.'],
  },
  {
    role: 'architect', name: 'Architect', skills: ['plan', 'tech-review'],
    agent: 'claude', model: 'opus', limits: [...EVERY_HERO, 'It never approves a plan.'],
  },
  {
    role: 'designer', name: 'Designer', skills: ['visual-fix', 'pixel-perfect', 'think-big'],
    agent: 'claude', model: 'opus', limits: [...EVERY_HERO, 'It never locks a screen: a person does.'],
  },
];

/** A role's defaults. */
export function roleOf(role: HeroRole): RoleDefaults {
  const found = ROLES.find((r) => r.role === role);
  if (!found) throw new Error(`no defaults for the role ${role}`);
  return found;
}

/** A skill's one mark: `alone` when a runner runs it with nobody at it, `person` otherwise. No third. */
export type SkillMark = 'alone' | 'person';

/** Each skill with its mark, read from `runnable` (the runner's list), those that run alone first, each
 * group in the order given. */
export function skillMarks(skills: readonly string[], runnable: readonly string[] = RUNNABLE_SKILLS): { skill: string; mark: SkillMark }[] {
  const marked = skills.map((skill) => ({ skill, mark: (runnable.includes(skill) ? 'alone' : 'person') as SkillMark }));
  return [...marked.filter((m) => m.mark === 'alone'), ...marked.filter((m) => m.mark === 'person')];
}

/** True when one of the skills is one a runner runs with nobody at it. */
export function worksAlone(skills: readonly string[], runnable: readonly string[] = RUNNABLE_SKILLS): boolean {
  return skills.some((skill) => runnable.includes(skill));
}

/** The words a hero carries on screen: whether it runs anything alone, and its count line. */
export interface RoleLine {
  alone: boolean;
  /** `Runs <k> of <n> skills alone`, or `A person does this today`. */
  line: string;
}

export const PERSON_TODAY = 'A person does this today';

/** A hero's count line, from its skills (its role's by default) and the runner's list. */
export function roleLine(role: HeroRole, skills: readonly string[] = roleOf(role).skills, runnable: readonly string[] = RUNNABLE_SKILLS): RoleLine {
  const k = skills.filter((skill) => runnable.includes(skill)).length;
  if (k === 0) return { alone: false, line: PERSON_TODAY };
  return { alone: true, line: `Runs ${String(k)} of ${String(skills.length)} ${skills.length === 1 ? 'skill' : 'skills'} alone` };
}

/**
 * **The five roles of a Virtual Hero** (PRD 2842, slice s1).
 *
 * A Virtual Fleet is a fleet whose members are Virtual Heroes: agents, one per role, never players. A
 * hero is a role with its skills. This module is the one list of the roles, in the order the New
 * virtual fleet drawer shows them (those that work alone first), each with what a new hero of that
 * role starts with: its name (its role, never a person's first name), the skills it runs, its
 * preferred agent and model (recorded only: the runner's accounts still decide), and its limits in
 * sentences.
 *
 * `supabase/migrations/20270122090000_virtual_fleets.sql` keeps the same defaults in
 * `virtual_hero_roles()`, which `create_virtual_fleet()` copies onto each hero it makes; the arcade's
 * `virtual-fleets/roles-sql.test.ts` fails when the two differ.
 *
 * **Works alone** is a rule, not a flag: a role works alone when one of its skills is one a runner runs
 * with nobody at it ({@link UNATTENDED_SKILLS}). Today that is the Engineer and the QA.
 */
import { z } from 'zod';

/** The roles, in the drawer's order. */
export const HERO_ROLES = ['engineer', 'qa', 'reviewer', 'pm', 'architect'] as const;

export type HeroRole = (typeof HERO_ROLES)[number];

export const HeroRoleSchema = z.enum(HERO_ROLES);

/** The skills a runner runs with nobody at it: the Engineer's build skills, and the QA's proof. */
const UNATTENDED_SKILLS: readonly string[] = ['yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix', 'prove'];

/** What a new hero of a role starts with. */
export interface RoleDefaults {
  role: HeroRole;
  /** Its name: its role, never a person's first name. */
  name: string;
  /** The kit skills it runs, without the `omni:` prefix. */
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
    role: 'engineer', name: 'Engineer', skills: ['yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix'],
    agent: 'claude', model: 'sonnet', limits: [...EVERY_HERO, 'It waits for a person wherever one is needed.'],
  },
  {
    role: 'qa', name: 'QA', skills: ['prove', 'bug-fix'],
    agent: 'claude', model: 'sonnet', limits: [...EVERY_HERO, 'It reports what it saw; a person decides.'],
  },
  {
    role: 'reviewer', name: 'Reviewer', skills: [],
    agent: 'claude', model: 'opus', limits: [...EVERY_HERO, 'It has no skill to run yet.'],
  },
  {
    role: 'pm', name: 'PM', skills: ['pitch', 'plan'],
    agent: 'claude', model: 'opus', limits: [...EVERY_HERO, 'It never approves a PRD.'],
  },
  {
    role: 'architect', name: 'Architect', skills: ['plan'],
    agent: 'claude', model: 'opus', limits: [...EVERY_HERO, 'It never approves a plan.'],
  },
];

/** A role's defaults. */
export function roleOf(role: HeroRole): RoleDefaults {
  const found = ROLES.find((r) => r.role === role);
  if (!found) throw new Error(`no defaults for the role ${role}`);
  return found;
}

/** True when one of the skills is one a runner runs with nobody at it. */
export function worksAlone(skills: readonly string[]): boolean {
  return skills.some((skill) => UNATTENDED_SKILLS.includes(skill));
}

/** Why a role does not work alone today, in one sentence; null for a role that does. */
const WHY_NOT_ALONE: Readonly<Record<HeroRole, string | null>> = {
  engineer: null,
  qa: null,
  reviewer: 'Its review skill is not built yet.',
  pm: 'Its brainstorm and roadmap need a person.',
  architect: 'Its plan needs a person.',
};

/** The words a role carries on screen: one line on whether it works alone, and, when it does not, why. */
export interface RoleLine {
  alone: boolean;
  /** One short line: what it does alone, or `A person does this today`. */
  line: string;
  why: string | null;
}

/** What it does alone, by role, for the roles that do. */
const ALONE_LINE: Readonly<Partial<Record<HeroRole, string>>> = {
  engineer: 'Builds PRDs alone',
  qa: 'Proves the work alone',
};

export const PERSON_TODAY = 'A person does this today';

/** A role's line on screen, from its skills (the rule above) and its words. */
export function roleLine(role: HeroRole, skills: readonly string[] = roleOf(role).skills): RoleLine {
  const alone = worksAlone(skills);
  if (alone) return { alone, line: ALONE_LINE[role] ?? 'Works alone', why: null };
  return { alone, line: PERSON_TODAY, why: WHY_NOT_ALONE[role] ?? 'It has no skill a runner runs alone yet.' };
}

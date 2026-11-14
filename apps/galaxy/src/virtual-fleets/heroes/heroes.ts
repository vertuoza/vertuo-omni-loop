import { heroLook, spritePixels } from '@omni/design';
import { HERO_ROLES, roleLine, roleOf, type HeroRole } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import { pixelSvg } from '../../design/pixel-svg';
import type { Hero } from './heroes.contract';

// The Heroes tab's rules (PRD 2842 s6, the `fleet-seats` screen), pure so each is tested without a browser:
// the sprite each role is drawn with, in the fleet's colour at a whole-number scale; one row per hero, its
// words (`Works alone` or `A person does this today`, and why); the roles a fleet may still add. A hero is
// always shown as an agent (`Engineer · agent`), never as a person: no face, no first name.

export const WORDS = {
  tab: 'Heroes',
  agent: 'agent',
  alone: 'Works alone',
  person: 'A person does this today',
  noSkill: 'No skill yet',
  add: 'Add a hero',
  adding: 'Adding…',
  addTitle: 'Add a hero of a role this fleet lacks',
  remove: 'Remove',
  removing: 'Removing…',
  ownersOnly: 'Only an owner of the workspace adds or removes a hero.',
  demo: 'The demo world keeps its own fleets.',
} as const;

/** How each role is drawn: a preset hero look of the arcade, the fleet's colour on its suit, a cape each. */
const LOOKS: Readonly<Record<HeroRole, { body: 'girl' | 'boy'; skin: number; hair: number; cape: number }>> = {
  engineer: { body: 'boy', skin: 1, hair: 0, cape: 1 },
  qa: { body: 'girl', skin: 2, hair: 6, cape: 4 },
  reviewer: { body: 'boy', skin: 3, hair: 5, cape: 7 },
  pm: { body: 'girl', skin: 0, hair: 4, cape: 3 },
  architect: { body: 'boy', skin: 4, hair: 1, cape: 8 },
};

/** A role's sprite in the fleet's colour, as a crisp SVG string at a whole-number `scale`. */
export function heroSvg(role: HeroRole, color: string | null, title: string, scale = 3): string {
  const look = LOOKS[role];
  const { sprite, tint } = heroLook({ v: 1, ...look, suit: 0 }, color ?? '#cfd4e6');
  return pixelSvg(spritePixels(sprite, { tint }), { scale, title });
}

/** One hero as the tab writes it. */
export interface HeroRow {
  id: string;
  name: string;
  /** `Engineer · agent`: always an agent. */
  heading: string;
  /** The skills it runs, as the kit writes them (`/omni:yolo`); none yet reads `No skill yet`. */
  skills: string[];
  /** `claude · sonnet`: recorded, the runner's accounts still decide. */
  preferred: string;
  limits: string[];
  alone: boolean;
  /** `Works alone` or `A person does this today`. */
  line: string;
  why: string | null;
  role: HeroRole;
}

export function rowOf(hero: Hero): HeroRow {
  const said = roleLine(hero.role, hero.skills);
  return {
    id: hero.id,
    name: hero.name,
    heading: `${roleOf(hero.role).name} · ${WORDS.agent}`,
    skills: hero.skills.map((skill) => `/omni:${skill}`),
    preferred: `${hero.agent} · ${hero.model}`,
    limits: hero.limits,
    alone: said.alone,
    line: said.alone ? WORDS.alone : WORDS.person,
    why: said.why,
    role: hero.role,
  };
}

/** The roles a fleet may still add: those none of its heroes holds, in the drawer's order. */
export function missingRoles(heroes: readonly Pick<Hero, 'role'>[]): HeroRole[] {
  return HERO_ROLES.filter((role) => !heroes.some((hero) => hero.role === role));
}

/** What the tab shows a fleet's heroes as: its rows, and whether the viewer may change them. */
export interface HeroesView {
  workspace: string | null;
  fleet: string;
  color: string | null;
  heroes: Hero[];
  /** True for an owner of the workspace. */
  canEdit: boolean;
}

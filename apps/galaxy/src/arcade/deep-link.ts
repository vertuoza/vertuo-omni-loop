// The arcade's deep links: the screen an address's hash opens, past the boot and the title (`/#map`,
// `/#menu`, `/#planet-2332`), and the address the arcade writes for the screen it is on, so a reload
// or a shared address comes back to it. `/#menu` is the game's home, where the app's Game mode lands
// (PRD 238, src/switch/switch.ts).
//
// Every link goes through the one door (onboarding.ts's `allowed`): signed out, it lands on INSERT
// COIN, whether the page holds a galaxy or not. Signed in, it opens the screen it names once the
// galaxy is there to show; a page that holds none (out of reach, or an account outside the crew)
// starts at the boot, as `/` does.
import type { GalaxyView } from '@omni/galaxy';
import { allowed } from './onboarding';
import type { SceneName } from './scenes';
import type { Session } from './types';

/** The screens an address may name by their own name. */
export const DEEP_LINKS: readonly SceneName[] = ['map', 'chart', 'fleets', 'heroes', 'games', 'briefing', 'menu'];

/** Where a link opens: a screen and, on a planet's, the planet's place in the galaxy. */
export interface Landing { scene: SceneName; sel?: number }

const PLANET = /^planet-(\d+)$/;

const named = (h: string): h is SceneName => (DEEP_LINKS as readonly string[]).includes(h);

/** The screen a hash names, with or without its `#`; a planet only when the galaxy holds it. */
export function readHash(hash: string, view: GalaxyView | null): Landing | null {
  const h = hash.replace(/^#/, '');
  if (named(h)) return { scene: h };
  const m = PLANET.exec(h);
  if (m && view) {
    const sel = view.planets.findIndex((p) => p.prd === Number(m[1]));
    if (sel >= 0) return { scene: 'planet', sel };
  }
  return null;
}

/** Where the arcade opens on an address's hash, through the one door; null: at the boot. */
export function landing(hash: string, at: { view: GalaxyView | null; session: Session | null }): Landing | null {
  const link = readHash(hash, at.view);
  if (!link || (at.session && !at.view)) return null;
  return { ...link, scene: allowed(link.scene, at.session) as SceneName };
}

/** The hash of the screen the arcade is on: a deep link's own, or none. */
function hashOf({ scene, sel }: { scene: SceneName; sel: number }, view: GalaxyView | null): string {
  if (scene === 'planet') {
    const prd = view?.planets[sel]?.prd;
    return prd === undefined ? '' : `#planet-${prd}`;
  }
  return named(scene) ? `#${scene}` : '';
}

/** The address the arcade writes for the screen it is on: the page's own path, and the screen's hash. */
export function addressAt(pathname: string, at: { scene: SceneName; sel: number }, view: GalaxyView | null): string {
  return `${pathname}${hashOf(at, view)}`;
}

// Who goes where, as pure functions (docs/superpowers/specs/2026-09-25-omni-loop-teams-and-heroes-design.md §2).
//
//   START ─ signed out ─▶ INSERT COIN ─▶ Google ─▶ PRESS START ─▶ INTRO ─▶ FLEET ─▶ NAME ─▶ HERO ─▶ GITHUB ─▶ READY ─▶ MENU
//         └ a player with an active fleet ─▶ WELCOME BACK ─▶ MENU
//
// A flow says why a screen is open: the first visit (`onboard`), or one menu entry (`myhero`,
// `change`, `link`). The same screens serve all four; only where they lead differs.
import { validHero } from '@omni/sprites';
import type { FleetRow, Player, Session } from './types';

export type Flow = 'onboard' | 'myhero' | 'change' | 'link';
export type Step = 'coin' | 'outsider' | 'gate' | 'intro' | 'select' | 'name' | 'hero' | 'link' | 'ready' | 'welcome' | 'menu';

const activeFleet = (fleets: FleetRow[], name: string | null | undefined) => fleets.find((f) => f.name === name && !f.retired) ?? null;

/** A player who can go straight to the menu: an active fleet and a hero. */
export function isReady(me: Player | null, fleets: FleetRow[]): me is Player {
  return Boolean(me && activeFleet(fleets, me.team) && validHero(me.hero));
}

/** A player whose fleet was retired since they chose it. */
export function isDisbanded(me: Player | null, fleets: FleetRow[]): boolean {
  return Boolean(me?.team && fleets.some((f) => f.name === me.team && f.retired));
}

/** Where START on the title leads. */
export function afterStart(session: Session | null, me: Player | null, fleets: FleetRow[]): Step {
  if (!session) return 'coin';
  if (!session.crew) return 'outsider';
  if (isReady(me, fleets)) return 'welcome';
  return 'gate';
}

/** Where PRESS START leads: a returning player to the welcome, a disbanded one to the fleets, a new one to the intro. */
export function afterGate(me: Player | null, fleets: FleetRow[]): Step {
  if (isReady(me, fleets)) return 'welcome';
  if (isDisbanded(me, fleets)) return 'select';
  return 'intro';
}

/** The screen after a step is done, in a flow. */
export function nextStep(step: Step, flow: Flow, me: Player | null): Step {
  switch (step) {
    case 'intro': return 'select';
    case 'select': return flow === 'change' ? 'menu' : 'name';
    case 'name': return 'hero';
    case 'hero': return flow === 'onboard' ? (me?.github_login ? 'ready' : 'link') : 'menu';
    case 'link': return flow === 'onboard' ? 'ready' : 'menu';
    case 'ready': case 'welcome': return 'menu';
    default: return 'menu';
  }
}

/** The screen B leads back to from a step, in a flow. */
export function backStep(step: Step, flow: Flow): Step | 'title' {
  if (flow !== 'onboard') return step === 'hero' && flow === 'myhero' ? 'name' : 'menu';
  switch (step) {
    case 'select': return 'title';
    case 'name': return 'select';
    case 'hero': return 'name';
    case 'link': return 'ready';
    default: return 'title';
  }
}

/** The screens only a signed-in player may see: everything past INSERT COIN. */
const SIGNED_IN_ONLY = new Set([
  'gate', 'intro', 'select', 'name', 'hero', 'link', 'ready', 'welcome',
  'menu', 'map', 'planet', 'fleets', 'heroes', 'briefing',
]);

/** Where a screen may be shown to this visitor: anywhere past INSERT COIN needs a session. */
export function allowed(scene: string, session: Session | null): string {
  return !session && SIGNED_IN_ONLY.has(scene) ? 'coin' : scene;
}

/** What the page's query string says happened while the player was away (Google, GitHub). */
export type Return =
  | { kind: 'signin' }
  | { kind: 'signin_error'; message: string }
  | { kind: 'linked'; login: string }
  | { kind: 'link_error'; message: string };

export function readReturn(search: string): Return | null {
  const q = new URLSearchParams(search);
  if (q.has('signin_error')) return { kind: 'signin_error', message: q.get('signin_error') || 'Sign-in failed.' };
  if (q.has('link_error')) return { kind: 'link_error', message: q.get('link_error') || 'Linking GitHub failed.' };
  if (q.has('linked')) return { kind: 'linked', login: q.get('linked') ?? '' };
  if (q.get('signin') === 'ok') return { kind: 'signin' };
  return null;
}

/** The screen to open on a return: the page is new, so every one of them waits for a key (sound). */
export function afterReturn(r: Return, session: Session | null, me: Player | null, fleets: FleetRow[]): Step {
  switch (r.kind) {
    case 'signin_error': return 'coin';
    case 'signin': return !session ? 'coin' : !session.crew ? 'outsider' : 'gate';
    case 'linked': case 'link_error': return session ? 'link' : 'coin';
  }
  return afterStart(session, me, fleets);
}

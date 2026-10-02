// Who goes where, as pure functions (docs/superpowers/specs/2026-09-25-omni-loop-teams-and-heroes-design.md §2).
//
//   START ─ signed out ─▶ INSERT COIN ─▶ GitHub ─▶ PRESS START ─▶ INTRO ─▶ FLEET ─▶ NAME ─▶ HERO ─▶ READY ─▶ MENU
//         ├ in no workspace ─▶ OUTSIDER (the way to /signup)
//         └ a player (in a fleet or solo) ─▶ WELCOME BACK ─▶ MENU
//
// A fleet is optional (PRD 400): the FLEET step offers the workspace's active fleets and PLAY SOLO,
// and is skipped when there are none; a solo player's row has no team.
//
//   … ─▶ MENU, a level not yet celebrated on this device ─▶ LEVEL UP ─▶ MENU (A on a game it opened: the game)
//
// Everyone signs in with GitHub, and the callback links it on every sign-in (PRD 359): a signed-in
// member of a workspace is a player at once, with no link step.
//
// A flow says why a screen is open: the first visit (`onboard`), or one menu entry (`myhero`,
// `change`). The same screens serve all three; only where they lead differs.
import { validHero } from '@omni/design';
import type { FleetRow, Player, Session } from './types';

export type Flow = 'onboard' | 'myhero' | 'change';
export type Step = 'coin' | 'outsider' | 'gate' | 'intro' | 'select' | 'name' | 'hero' | 'ready' | 'welcome' | 'menu';

/** The workspace has a fleet to join: at least one active one. */
export const hasFleets = (fleets: FleetRow[]): boolean => fleets.some((f) => !f.retired);

/** Signed in, in a workspace: this account plays (its GitHub is its sign-in). */
export function isPlayer(session: Session | null): boolean {
  return Boolean(session?.crew);
}

/**
 * A player who can go straight to the menu: a player row and a hero, in a fleet or solo. One whose
 * fleet was retired picks again while another fleet flies, and plays on when none does.
 */
export function isReady(me: Player | null, fleets: FleetRow[]): boolean {
  return Boolean(me && validHero(me.hero) && !(isDisbanded(me, fleets) && hasFleets(fleets)));
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

/**
 * Where PRESS START leads: a returning player to the welcome, a disbanded player to the fleets (while
 * any fly), a new player to the intro.
 */
export function afterGate(me: Player | null, fleets: FleetRow[]): Step {
  if (isReady(me, fleets)) return 'welcome';
  if (isDisbanded(me, fleets) && hasFleets(fleets)) return 'select';
  if (me) return 'welcome';
  return 'intro';
}

/** The screen after a step is done, in a flow: the intro leads to the fleets, or past them when there are none. */
export function nextStep(step: Step, flow: Flow, me: Player | null, fleets: FleetRow[]): Step {
  switch (step) {
    case 'intro': return hasFleets(fleets) ? 'select' : 'name';
    case 'select': return flow === 'change' ? 'menu' : 'name';
    case 'name': return 'hero';
    case 'hero': return flow === 'onboard' ? 'ready' : 'menu';
    case 'ready': case 'welcome': return 'menu';
    default: return 'menu';
  }
}

/** The screen B leads back to from a step, in a flow. */
export function backStep(step: Step, flow: Flow, fleets: FleetRow[]): Step | 'title' {
  if (flow !== 'onboard') return step === 'hero' && flow === 'myhero' ? 'name' : 'menu';
  switch (step) {
    case 'select': return 'title';
    case 'name': return hasFleets(fleets) ? 'select' : 'title';
    case 'hero': return 'name';
    default: return 'title';
  }
}

/** The screens a signed-in account may see: everything past INSERT COIN, playing included. */
const SIGNED_IN_ONLY = new Set([
  'gate', 'intro', 'select', 'name', 'hero', 'ready', 'welcome',
  'menu', 'map', 'planet', 'fleets', 'heroes', 'briefing', 'chart', 'system', 'games', 'invaders', 'platformer', 'levelup',
]);

/**
 * Where a screen may be shown: past INSERT COIN needs a session. The one door every route goes
 * through (a deep link, a crafted return URL, a stale screen).
 */
export function allowed<S extends string>(scene: S, session: Session | null): S | 'coin' {
  if (!session && SIGNED_IN_ONLY.has(scene)) return 'coin';
  return scene;
}

/**
 * The screen a route to `scene` opens: the menu plays the level-up first when one is `due` (the
 * player's level is higher than the one this device last celebrated: levelup.ts decides); every
 * other screen opens as asked.
 */
export function arrive<S extends string>(scene: S, due: boolean): S | 'levelup' {
  return scene === 'menu' && due ? 'levelup' : scene;
}

/** What the page's query string says happened while the player was away at GitHub. */
export type Return =
  | { kind: 'signin' }
  | { kind: 'signin_error'; message: string };

export function readReturn(search: string): Return | null {
  const q = new URLSearchParams(search);
  if (q.has('signin_error')) return { kind: 'signin_error', message: q.get('signin_error') || 'Sign-in failed.' };
  if (q.get('signin') === 'ok') return { kind: 'signin' };
  return null;
}

/** The screen to open on a return: the page is new, so every one of them waits for a key (sound). */
export function afterReturn(r: Return, session: Session | null, me: Player | null, fleets: FleetRow[]): Step {
  switch (r.kind) {
    case 'signin_error': return 'coin';
    case 'signin': return !session ? 'coin' : !session.crew ? 'outsider' : 'gate';
  }
  return afterStart(session, me, fleets);
}

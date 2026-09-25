// Who goes where, as pure functions (docs/superpowers/specs/2026-09-25-omni-loop-teams-and-heroes-design.md §2).
//
//   START ─ signed out ─▶ INSERT COIN ─▶ Google ─▶ PRESS START ─▶ GITHUB ─▶ INTRO ─▶ FLEET ─▶ NAME ─▶ HERO ─▶ READY ─▶ MENU
//         │                                                        └ B: visit only ─▶ MENU (look, don't play)
//         └ a player with an active fleet ─▶ WELCOME BACK ─▶ MENU
//
// Google lets a @vertuoza.com account in as a visitor; linking GitHub makes them a player.
//
// A flow says why a screen is open: the first visit (`onboard`), or one menu entry (`myhero`,
// `change`, `link`). The same screens serve all four; only where they lead differs.
import { validHero } from '@omni/sprites';
import type { FleetRow, Player, Session } from './types';

export type Flow = 'onboard' | 'myhero' | 'change' | 'link';
export type Step = 'coin' | 'outsider' | 'gate' | 'intro' | 'select' | 'name' | 'hero' | 'link' | 'ready' | 'welcome' | 'menu';

const activeFleet = (fleets: FleetRow[], name: string | null | undefined) => fleets.find((f) => f.name === name && !f.retired) ?? null;

/** GitHub is linked: this visitor may play. */
export function isLinked(session: Session | null, me: Player | null): boolean {
  return Boolean(me?.github_login || session?.github);
}

/** A player who can go straight to the menu: GitHub linked, an active fleet and a hero. */
export function isReady(me: Player | null, fleets: FleetRow[]): boolean {
  return Boolean(me && me.github_login && activeFleet(fleets, me.team) && validHero(me.hero));
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
 * Where PRESS START leads (and where a fresh GitHub link leads): a returning player to the welcome,
 * a visitor to the GitHub link, a disbanded player to the fleets, a new player to the intro.
 */
export function afterGate(me: Player | null, fleets: FleetRow[], session: Session | null = null): Step {
  if (isReady(me, fleets)) return 'welcome';
  if (!isLinked(session, me)) return 'link';
  if (isDisbanded(me, fleets)) return 'select';
  if (me && activeFleet(fleets, me.team)) return 'welcome';
  return 'intro';
}

/** The screen after a step is done, in a flow. */
export function nextStep(step: Step, flow: Flow, me: Player | null): Step {
  switch (step) {
    case 'intro': return 'select';
    case 'select': return flow === 'change' ? 'menu' : 'name';
    case 'name': return 'hero';
    case 'hero': return flow === 'onboard' ? 'ready' : 'menu';
    case 'link': return 'menu'; // B, visit only: after a link, afterGate decides
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
    case 'link': return 'menu';
    default: return 'title';
  }
}

/** The screens a signed-in visitor may see: everything past INSERT COIN. */
const SIGNED_IN_ONLY = new Set([
  'gate', 'intro', 'select', 'name', 'hero', 'link', 'ready', 'welcome',
  'menu', 'map', 'planet', 'fleets', 'heroes', 'briefing',
]);
/** The screens only a player may see: playing starts with a linked GitHub account. */
const PLAYERS_ONLY = new Set(['intro', 'select', 'name', 'hero', 'ready', 'welcome']);

/**
 * Where a screen may be shown: past INSERT COIN needs a session, and playing needs GitHub linked.
 * The one door every route goes through (a deep link, a crafted return URL, a stale screen).
 */
export function allowed(scene: string, session: Session | null, linked = false): string {
  if (!session && SIGNED_IN_ONLY.has(scene)) return 'coin';
  if (!linked && PLAYERS_ONLY.has(scene)) return 'link';
  return scene;
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

'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GalaxyView } from '@omni/galaxy';
import { randomHero, type Hero } from '@omni/sprites';
import { drawFrame, H, layoutMap, neighbour, W, type FrameState, type SceneName } from './scenes';
import { motif, music, setMuted as setAudioMuted, sfx, unlock, type Sfx } from './sound';
import type { SongName } from './score';
import {
  BootOverlay, BriefingOverlay, FleetsOverlay, HeroesOverlay, MapOverlay, MenuOverlay, PlanetOverlay, TitleOverlay,
  PLANET_TABS, menuItems, titlePhaseAt,
} from './screens';
import {
  BuilderOverlay, CoinOverlay, GateOverlay, IntroOverlay, LinkOverlay, NameOverlay, OutsiderOverlay, ReadyOverlay,
  SelectOverlay, WelcomeOverlay, type LinkState,
} from './join-screens';
import { FleetSprite, Sprite } from './Sprite';
import { fleet, setFleets } from './fleets';
import { foldChar, foldName, nameInit, nameReduce, nameValue, NAME_RULE, type NameAction, type NameState } from './name-entry';
import { BUILDER_ROWS, cycleHero } from './builder';
import { afterGate, afterReturn, afterStart, allowed, backStep, isDisbanded, isLinked, nextStep, readReturn, type Flow, type Step } from './onboarding';
import type { Account, FleetRow, Player, PlayerPatch, Session } from './types';

export type Action = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'select';

// The pad: arrows or WASD move, Enter is START, Z/Space/K is A, X/Esc/J/Backspace is B, Tab is SELECT.
// On the name screen letters type instead (see onKey).
const KEYS: Record<string, Action> = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  z: 'a', Z: 'a', k: 'a', K: 'a', ' ': 'a',
  Enter: 'start',
  x: 'b', X: 'b', j: 'b', J: 'b', Escape: 'b', Backspace: 'b',
  Tab: 'select', Shift: 'select',
};

// The music each screen plays; the rest are silent but for their effects.
const TRACK: Partial<Record<SceneName, SongName>> = {
  intro: 'intro', select: 'select', name: 'name', hero: 'name', link: 'name', ready: 'launch', welcome: 'welcome',
};

export interface UI {
  scene: SceneName; sel: number; tab: number; menu: number; fleet: number; since: number;
  flow: Flow;
  pick: number; lockedAt: number | null; lockSaved: boolean; confirm: boolean;
  name: NameState; shake: number;
  hero: Hero; heroRow: number;
  link: LinkState; linkLogin: string | null;
  away: boolean;
  error: string | null;
  toast: string | null;
}

const DEEP_LINKS: SceneName[] = ['map', 'fleets', 'heroes', 'briefing'];
const FLOW_KEY = 'omni-loop:flow'; // survives the trip to GitHub and back

function readHash(view: GalaxyView | null): Partial<UI> | null {
  if (typeof window === 'undefined' || !view) return null;
  const h = window.location.hash.replace('#', '');
  if ((DEEP_LINKS as string[]).includes(h)) return { scene: h as SceneName };
  const m = /^planet-(\d+)$/.exec(h);
  if (m) {
    const i = view.planets.findIndex((p) => p.prd === Number(m[1]));
    if (i >= 0) return { scene: 'planet', sel: i };
  }
  return null;
}

function writeHash(ui: UI, view: GalaxyView | null) {
  try {
    const h = ui.scene === 'planet' ? `planet-${view?.planets[ui.sel]?.prd}` : (DEEP_LINKS as string[]).includes(ui.scene) ? ui.scene : '';
    const url = `${window.location.pathname}${h ? `#${h}` : ''}`;
    window.history.replaceState(null, '', url);
  } catch { /* sandboxed frames may refuse; the hash is a convenience */ }
}

function readMuted() {
  try { return window.localStorage.getItem('omni-loop:muted') === '1'; } catch { return false; }
}

const store = {
  get(key: string) { try { return window.sessionStorage.getItem(key); } catch { return null; } },
  set(key: string, v: string | null) { try { if (v === null) window.sessionStorage.removeItem(key); else window.sessionStorage.setItem(key, v); } catch { /* ignore */ } },
};

export interface ArcadeProps {
  /** The galaxy; null while signed out (or when it cannot be read: see `problem`). */
  view: GalaxyView | null;
  /** Every fleet, retired ones included. */
  fleets: FleetRow[];
  account: Account;
  session?: Session | null;
  me?: Player | null;
  crew?: Player[];
  problem?: string | null;
}

export function ArcadeApp({ view, fleets, account, session: session0 = null, me: me0 = null, crew: crew0 = [], problem = null }: ArcadeProps) {
  setFleets(fleets);
  const active = useMemo(() => fleets.filter((f) => !f.retired), [fleets]);
  const layout = useMemo(() => (view ? layoutMap(view) : []), [view]);
  const start = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const now = () => (performance.now() - start.current) / 1000;
  const firstPlanet = view ? Math.max(0, view.planets.findIndex((p) => p.state === 'distress')) : 0;

  const [session, setSession] = useState<Session | null>(session0);
  const [me, setMe] = useState<Player | null>(me0);
  const [crew, setCrew] = useState<Player[]>(crew0);
  const [ui, setUi] = useState<UI>(() => ({
    scene: 'boot', sel: firstPlanet, tab: 0, menu: 0, fleet: 0, since: 0,
    flow: 'onboard', pick: 0, lockedAt: null, lockSaved: false, confirm: false,
    name: nameInit(''), shake: -1, hero: me0?.hero ?? { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 }, heroRow: 0,
    link: 'ask', linkLogin: null, away: false, error: null, toast: null,
  }));
  const [muted, setMuted] = useState(false);
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const meRef = useRef(me);
  meRef.current = me;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const go = useCallback((patch: Partial<UI>, effect?: Sfx) => {
    if (effect) sfx(effect);
    setUi((u) => ({ ...u, ...patch, since: patch.scene && patch.scene !== u.scene ? now() : u.since }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Opens a joining step with what it needs: the fleet under the cursor, the name, the hero draft. */
  const open = useCallback((step: Step | SceneName, patch: Partial<UI> = {}, effect?: Sfx) => {
    const m = meRef.current, s = sessionRef.current;
    const extra: Partial<UI> = { error: null, away: false, confirm: false, lockedAt: null, lockSaved: false };
    if (step === 'select') {
      const i = active.findIndex((f) => f.name === m?.team);
      extra.pick = i >= 0 ? i : 0;
    }
    if (step === 'name') extra.name = nameInit(m?.display_name ?? foldName(s?.givenName ?? ''));
    if (step === 'hero') { extra.hero = m?.hero ?? randomHero(); extra.heroRow = 0; }
    if (step === 'link') extra.link = 'ask';
    if (step === 'menu') extra.flow = 'onboard';
    go({ ...extra, ...patch, scene: step as SceneName }, effect);
  }, [active, go]);

  const save = useCallback(async (patch: PlayerPatch) => {
    const row = await account.save(patch, meRef.current);
    setMe(row);
    meRef.current = row;
    setCrew((c) => [...c.filter((p) => p.id !== row.id), row]);
    return row;
  }, [account]);

  // ── First render: the demo's remembered guest, a return from Google or GitHub, a deep link ──
  useEffect(() => {
    setMuted(readMuted());
    let s = session0, m = me0;
    if (account.restore) {
      const r = account.restore();
      s = r.session; m = r.me;
      setSession(s); setMe(m); meRef.current = m; sessionRef.current = s;
    }
    const back = readReturn(window.location.search);
    if (back) {
      window.history.replaceState(null, '', window.location.pathname);
      const flow = (store.get(FLOW_KEY) as Flow | null) ?? 'link';
      store.set(FLOW_KEY, null);
      const step = afterReturn(back, s, m, fleets);
      if (back.kind === 'signin_error') return open('coin', { error: back.message });
      if (step === 'coin') return open('coin');
      if (back.kind === 'linked') {
        // Show the login the database holds (link_github() set it), never one read from the URL.
        const login = account.kind === 'supabase' ? s?.github ?? m?.github_login ?? null : back.login || s?.github || m?.github_login || null;
        if (!login) return open('link', { flow, link: 'error', error: 'Linking GitHub did not finish. Try again.' });
        return open('link', { flow, link: 'done', linkLogin: login });
      }
      if (back.kind === 'link_error') return open('link', { flow, link: 'error', error: back.message });
      return open(step, { flow: 'onboard' });
    }
    const linked = readHash(view);
    if (linked) setUi((u) => ({ ...u, ...linked, since: now() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (ui.scene !== 'boot') writeHash(ui, view); }, [ui, view]);
  // The one door: whatever route led here (a deep link, a crafted return URL, a stale screen after
  // signing out), nothing past INSERT COIN shows without a session.
  useEffect(() => {
    const door = allowed(ui.scene, session, isLinked(session, me));
    if (door !== ui.scene) setUi((u) => ({ ...u, scene: door as SceneName, since: now(), away: false, error: null, link: 'ask' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.scene, session, me]);
  useEffect(() => { setAudioMuted(muted); }, [muted]);
  useEffect(() => { if (ui.lockedAt === null) music(TRACK[ui.scene] ?? null); }, [ui.scene, ui.lockedAt]);

  // ── Timed hand-overs ──
  useEffect(() => {
    const later = (ms: number, fn: () => void) => { const id = window.setTimeout(fn, ms); return () => window.clearTimeout(id); };
    if (ui.scene === 'boot') return later(3200, () => go({ scene: 'title' }));
    if (ui.scene === 'intro') return later(20200, () => open('select', { flow: 'onboard' }));
    if (ui.scene === 'welcome') return later(3200, () => open('menu'));
    // The lock-in plays for 1.8 s, and moves on once the fleet is saved (whichever comes last).
    if (ui.scene === 'select' && ui.lockedAt !== null && ui.lockSaved) {
      return later(Math.max(0, 1800 - (now() - ui.lockedAt) * 1000), () => open(nextStep('select', uiRef.current.flow, meRef.current)));
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.scene, ui.lockedAt, ui.lockSaved, go, open]);
  useEffect(() => {
    if (!ui.toast) return;
    const id = window.setTimeout(() => go({ toast: null }), 2600);
    return () => window.clearTimeout(id);
  }, [ui.toast, go]);

  // ── Leaving for Google or GitHub ──
  const signIn = useCallback(() => {
    go({ away: true, error: null }, 'coin');
    account.signIn().then((s) => {
      if (!s) return; // Supabase: the page is leaving for Google
      setSession(s); sessionRef.current = s;
      open(afterStart(s, meRef.current, fleets) === 'welcome' ? 'welcome' : 'gate', { flow: 'onboard' }, 'start');
    }).catch((err: Error) => go({ away: false, error: err.message }, 'buzz'));
  }, [account, fleets, go, open]);

  const linkGithub = useCallback(() => {
    store.set(FLOW_KEY, uiRef.current.flow);
    go({ link: 'away', error: null }, 'away');
    account.linkGithub().then((login) => {
      if (!login) return; // Supabase: the page is leaving for GitHub
      store.set(FLOW_KEY, null);
      const s = sessionRef.current ? { ...sessionRef.current, github: login } : null;
      if (s) { setSession(s); sessionRef.current = s; }
      const m = meRef.current ? { ...meRef.current, github_login: login } : null;
      if (m) { setMe(m); meRef.current = m; setCrew((c) => [...c.filter((p) => p.id !== m.id), m]); }
      go({ link: 'done', linkLogin: login }, 'linked');
    }).catch((err: Error) => go({ link: 'error', error: err.message }, 'buzz'));
  }, [account, go]);

  const signOut = useCallback(() => {
    account.signOut().then(() => {
      if (account.kind === 'supabase') { window.location.assign('/'); return; }
      setSession(null); sessionRef.current = null;
      go({ scene: 'title', flow: 'onboard' }, 'back');
    }).catch((err: Error) => go({ toast: err.message }, 'buzz'));
  }, [account, go]);

  // ── The fleet is locked in: the player row is created (or its fleet changed) ──
  const lockIn = useCallback(() => {
    const u = uiRef.current, f = active[u.pick];
    if (!f) return;
    const m = meRef.current, s = sessionRef.current;
    if (u.flow === 'change' && m?.team === f.name) return open('menu', {}, 'back');
    if (u.flow === 'change' && m?.team && !u.confirm) return go({ confirm: true }, 'select');
    const patch: PlayerPatch = m
      ? { team: f.name }
      : { team: f.name, display_name: foldName(s?.givenName ?? '') || 'PLAYER-1', hero: randomHero() };
    go({ confirm: false, lockedAt: now(), lockSaved: false });
    music('fanfare');
    save(patch)
      .then(() => go({ lockSaved: true }))
      .catch((err: Error) => go({ lockedAt: null, toast: err.message }, 'buzz'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, go, open, save]);

  const nameDone = useCallback(() => {
    const u = uiRef.current, value = nameValue(u.name);
    if (!NAME_RULE.test(value)) return go({ shake: now(), error: 'A name needs at least one letter or number.' }, 'buzz');
    save({ display_name: value })
      .then(() => open(nextStep('name', u.flow, meRef.current), { flow: u.flow }, 'select'))
      .catch((err: Error) => go({ error: err.message }, 'buzz'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, open, save]);

  const heroDone = useCallback(() => {
    const u = uiRef.current;
    save({ hero: u.hero })
      .then((row) => {
        const next = nextStep('hero', u.flow, row);
        open(next, next === 'menu' ? {} : { flow: u.flow }, 'select');
      })
      .catch((err: Error) => go({ error: err.message }, 'buzz'));
  }, [go, open, save]);

  const nameAction = useCallback((a: NameAction) => {
    const { state, sound } = nameReduce(uiRef.current.name, a);
    go({ name: state, error: null }, sound);
  }, [go]);

  const leave = useCallback((step: Step) => {
    const to = backStep(step, uiRef.current.flow);
    if (to === 'title') return go({ scene: 'title', flow: 'onboard' }, 'back');
    return open(to, to === 'menu' ? {} : { flow: uiRef.current.flow }, 'back');
  }, [go, open]);

  const act = useCallback((action: Action) => {
    const u = uiRef.current;
    const planets = view?.planets.length ?? 0;
    const items = menuItems({ joined: Boolean(meRef.current?.team), linked: isLinked(sessionRef.current, meRef.current), signedIn: Boolean(sessionRef.current) });
    switch (u.scene) {
      case 'boot': return go({ scene: 'title' });
      case 'title':
        if (action === 'a' || action === 'start') {
          const step = afterStart(sessionRef.current, meRef.current, fleets);
          return open(step, { flow: 'onboard' }, 'start');
        }
        return;
      case 'coin':
        if (u.away) return;
        if ((action === 'a' || action === 'start') && account.kind === 'closed') return sfx('buzz');
        if (action === 'a' || action === 'start') return signIn();
        if (action === 'b') return go({ scene: 'title', error: null }, 'back');
        return;
      case 'outsider':
        if (action === 'a' || action === 'start') return signOut();
        if (action === 'b') return go({ scene: 'title' }, 'back');
        return;
      case 'gate':
        if (action === 'a' || action === 'start') return open(afterGate(meRef.current, fleets, sessionRef.current), { flow: 'onboard' }, 'start');
        return;
      case 'intro':
        if (action === 'a' || action === 'start') return open('select', { flow: 'onboard' }, 'select');
        return;
      case 'select': {
        if (u.lockedAt !== null) return;
        if (u.confirm) {
          if (action === 'a' || action === 'start') return lockIn();
          if (action === 'b') return go({ confirm: false }, 'back');
          return;
        }
        if (action === 'left' || action === 'right' || action === 'up' || action === 'down' || action === 'select') {
          const n = active.length || 1;
          const pick = (u.pick + (action === 'left' || action === 'up' ? n - 1 : 1)) % n;
          go({ pick });
          if (active[pick]) motif(active[pick].name);
          return;
        }
        if (action === 'a' || action === 'start') return lockIn();
        if (action === 'b') return leave('select');
        return;
      }
      case 'name':
        if (action === 'up') return nameAction({ type: 'spin', dir: -1 });
        if (action === 'down') return nameAction({ type: 'spin', dir: 1 });
        if (action === 'left') return nameAction({ type: 'move', dir: -1 });
        if (action === 'right') return nameAction({ type: 'move', dir: 1 });
        if (action === 'a') return nameAction({ type: 'advance' });
        if (action === 'start') return nameDone();
        if (action === 'b') return u.name.chars.length ? nameAction({ type: 'erase' }) : leave('name');
        return;
      case 'hero': {
        const row = BUILDER_ROWS[u.heroRow];
        if (action === 'up') return go({ heroRow: (u.heroRow + BUILDER_ROWS.length - 1) % BUILDER_ROWS.length }, 'move');
        if (action === 'down') return go({ heroRow: (u.heroRow + 1) % BUILDER_ROWS.length }, 'move');
        if ((action === 'left' || action === 'right') && row !== 'RANDOM' && row !== 'DONE') {
          return go({ hero: cycleHero(u.hero, row, action === 'left' ? -1 : 1), error: null }, 'tick');
        }
        if (action === 'select' || (action === 'a' && row === 'RANDOM')) {
          return go({ hero: randomHero(Math.random, { suit: Math.floor(Math.random() * 8) }), error: null }, 'random');
        }
        if (action === 'start' || (action === 'a' && row === 'DONE')) return heroDone();
        if (action === 'a') return go({ heroRow: u.heroRow + 1 }, 'move');
        if (action === 'b') return leave('hero');
        return;
      }
      case 'link':
        if (u.link === 'away') return;
        if (u.link === 'done') return open(afterGate(meRef.current, fleets, sessionRef.current), { flow: 'onboard' }, 'start');
        if (action === 'a' || action === 'start') return linkGithub();
        if (action === 'b') return open('menu', {}, 'back'); // visit only
        return;
      case 'ready':
        if (now() - u.since > 0.6) open('menu', {}, 'select');
        return;
      case 'welcome':
        if (now() - u.since > 0.4) open('menu', {}, 'select');
        return;
      case 'menu': {
        const i = Math.min(u.menu, items.length - 1);
        if (action === 'up') return go({ menu: (i + items.length - 1) % items.length }, 'move');
        if (action === 'down' || action === 'select') return go({ menu: (i + 1) % items.length }, 'move');
        if (action === 'b') return go({ scene: 'title' }, 'back');
        if (action !== 'a' && action !== 'start') return;
        const item = items[i];
        if (item.scene) return view ? go({ scene: item.scene, menu: i }, 'select') : go({ toast: problem ?? 'SIGN IN TO SEE THE GALAXY' }, 'buzz');
        if (item.id === 'myhero') return open('name', { flow: 'myhero', menu: i }, 'select');
        if (item.id === 'change') return open('select', { flow: 'change', menu: i }, 'select');
        if (item.id === 'link') return open('link', { flow: 'link', menu: i }, 'select');
        if (item.id === 'signout') return signOut();
        return;
      }
      case 'map':
        if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
          const next = neighbour(layout, u.sel, action);
          return next === u.sel ? undefined : go({ sel: next }, 'move');
        }
        if ((action === 'a' || action === 'start') && planets) return go({ scene: 'planet', tab: 0 }, 'select');
        if (action === 'select') return go({ sel: (u.sel + 1) % Math.max(1, planets) }, 'move');
        if (action === 'b') return go({ scene: 'menu' }, 'back');
        return;
      case 'planet':
        if (action === 'left') return go({ tab: (u.tab + PLANET_TABS.length - 1) % PLANET_TABS.length }, 'tab');
        if (action === 'right' || action === 'a' || action === 'select') return go({ tab: (u.tab + 1) % PLANET_TABS.length }, 'tab');
        if (action === 'up') return go({ sel: (u.sel + planets - 1) % planets }, 'move');
        if (action === 'down') return go({ sel: (u.sel + 1) % planets }, 'move');
        if (action === 'b' || action === 'start') return go({ scene: 'map' }, 'back');
        return;
      case 'fleets': {
        const n = view?.teams.length ?? 0;
        if (!n) return action === 'b' ? go({ scene: 'menu' }, 'back') : undefined;
        if (action === 'left' || action === 'up') return go({ fleet: (u.fleet + n - 1) % n }, 'move');
        if (action === 'right' || action === 'down' || action === 'select') return go({ fleet: (u.fleet + 1) % n }, 'move');
        if (action === 'a' || action === 'start') {
          const team = view!.teams[u.fleet]?.name;
          const i = view!.planets.findIndex((p) => p.ownerTeam === team);
          return go({ scene: 'map', ...(i >= 0 ? { sel: i } : {}) }, 'select');
        }
        if (action === 'b') return go({ scene: 'menu' }, 'back');
        return;
      }
      default:
        if (action === 'a' || action === 'b' || action === 'start') return go({ scene: 'menu' }, 'back');
    }
  }, [view, fleets, active, layout, go, open, leave, signIn, signOut, linkGithub, lockIn, nameAction, nameDone, heroDone, problem]);

  // ── Keyboard: the pad everywhere, a text mode on the name screen ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Let Space and Enter activate a focused button natively; the button calls `act` itself.
      if (e.target instanceof Element && e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
      unlock();
      if (uiRef.current.scene === 'name') {
        const k = e.key;
        let handled = true;
        if (k === 'Enter') nameDone();
        else if (k === 'Escape') leave('name');
        else if (k === 'Backspace') nameAction({ type: 'erase' });
        else if (k === 'ArrowUp') nameAction({ type: 'spin', dir: -1 });
        else if (k === 'ArrowDown') nameAction({ type: 'spin', dir: 1 });
        else if (k === 'ArrowLeft') nameAction({ type: 'move', dir: -1 });
        else if (k === 'ArrowRight') nameAction({ type: 'move', dir: 1 });
        else if (k === 'Tab') { /* no Tab on the name screen */ }
        else if (k.length === 1) { const c = foldChar(k); if (c) nameAction({ type: 'type', char: c }); }
        else handled = false;
        if (handled) e.preventDefault();
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        setMuted((m) => { try { window.localStorage.setItem('omni-loop:muted', m ? '0' : '1'); } catch { /* per-viewer only */ } return !m; });
        return;
      }
      const action = KEYS[e.key];
      if (!action) return;
      e.preventDefault();
      if (e.repeat && (action === 'a' || action === 'b' || action === 'start')) return;
      act(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, leave, nameAction, nameDone]);

  // The title cycles its attract phases.
  const [, tick] = useState(0);
  useEffect(() => {
    if (ui.scene !== 'title') return;
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [ui.scene]);

  // ── Canvas loop ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef({ view, layout, active, me });
  frameRef.current = { view, layout, active, me };
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    const loop = () => {
      const t = now();
      const u = uiRef.current;
      const f = frameRef.current;
      const picking = u.scene === 'select' ? f.active[u.pick]?.name ?? null : null;
      const frame: FrameState = {
        scene: u.scene, view: f.view, layout: f.layout, sel: u.sel, fleetSel: u.fleet, t, sceneT: t - u.since, reduced: reducedQuery.matches,
        join: {
          fleets: f.active, pick: u.pick, lockedAt: u.lockedAt, away: u.away || u.link === 'away',
          team: picking ?? f.me?.team ?? null,
          hero: u.scene === 'hero' ? u.hero : f.me?.hero ?? u.hero,
        },
      };
      const phase = titlePhaseAt(t - u.since);
      drawFrame(ctx, frame, !f.view && phase === 'hiscore' ? 'title' : phase); // no high scores without the galaxy
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fit the 640×360 screen into whatever room the console leaves it ──
  const slotRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      const s = Math.min(width / (W), Math.max(height, 200) / (H));
      setScale(Math.max(0.3, s));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    unlock();
    const u = uiRef.current;
    if (u.scene === 'boot' || u.scene === 'title' || u.scene === 'gate') return act('start');
    if (u.scene !== 'map') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const hit = layout.find((s) => Math.hypot(s.x - x, s.y - y) <= s.r + 5);
    if (!hit) return;
    if (hit.index === u.sel) go({ scene: 'planet', tab: 0 }, 'select');
    else go({ sel: hit.index }, 'move');
  };

  const crewCount = useMemo(() => {
    const counts: Record<string, number> = {};
    if (account.kind === 'supabase') {
      for (const p of crew) if (p.team) counts[p.team] = (counts[p.team] ?? 0) + 1;
    } else {
      // The demo has no players, only the logins in its ledger, plus the guest.
      for (const t of view?.teams ?? []) counts[t.name] = t.members.length;
      if (me?.team) counts[me.team] = (counts[me.team] ?? 0) + 1;
    }
    return counts;
  }, [account.kind, crew, me, view]);

  const phase = titlePhaseAt(now() - ui.since);
  const sel = view?.planets[ui.sel];
  const items = menuItems({ joined: Boolean(me?.team), linked: isLinked(session, me), signedIn: Boolean(session) });
  const displayName = me?.display_name ?? (session ? foldName(session.givenName) || 'RECRUIT' : '');
  const who = session
    ? `${account.kind === 'demo' ? 'DEMO · ' : ''}P1 ${displayName}`
    : account.kind === 'demo' ? 'DEMO GALAXY' : account.kind === 'closed' ? 'SIGN-IN NOT OPEN YET' : problem ? 'GALAXY OUT OF REACH' : 'SIGNED OUT';
  const overlay = (() => {
    switch (ui.scene) {
      case 'boot': return <BootOverlay />;
      case 'title': return <TitleOverlay view={view} phase={view ? phase : phase === 'hiscore' ? 'title' : phase} sceneT={now() - ui.since} who={who} signedIn={Boolean(session)} />;
      case 'coin': return <CoinOverlay away={ui.away} error={ui.error} demo={account.kind === 'demo'} closed={account.kind === 'closed'} />;
      case 'outsider': return <OutsiderOverlay email={session?.email ?? ''} />;
      case 'gate': return <GateOverlay name={me?.team ? me.display_name : null} />;
      case 'intro': return <IntroOverlay fleets={active} />;
      case 'select': return (
        <SelectOverlay fleets={active} pick={ui.pick} change={ui.flow === 'change'} locked={ui.lockedAt !== null} confirm={ui.confirm}
          current={me?.team ?? null} disbanded={isDisbanded(me, fleets)} crew={crewCount}
          onPick={(i) => { if (i === ui.pick) act('a'); else { go({ pick: i }); motif(active[i].name); } }} />
      );
      case 'name': return <NameOverlay state={ui.name} shake={now() - ui.shake < 0.35} team={me?.team ?? null} error={ui.error} />;
      case 'hero': return <BuilderOverlay hero={ui.hero} row={ui.heroRow} team={me?.team ?? null} name={displayName} error={ui.error} onRow={(i) => { if (i === ui.heroRow) act('a'); else go({ heroRow: i }, 'move'); }} />;
      case 'link': return <LinkOverlay state={ui.link} name={displayName} login={ui.linkLogin ?? session?.github ?? me?.github_login ?? null} error={ui.error} demo={account.kind === 'demo'} />;
      case 'ready': return <ReadyOverlay name={displayName} team={me?.team ?? null} />;
      case 'welcome': return <WelcomeOverlay name={displayName} team={me?.team ?? null} />;
      case 'menu': return <MenuOverlay view={view} items={items} index={Math.min(ui.menu, items.length - 1)} me={me} onPick={(i) => { go({ menu: i }); act('a'); }} />;
      case 'map': return view ? <MapOverlay view={view} layout={layout} sel={ui.sel} onLand={() => act('a')} /> : null;
      case 'planet': return view && sel ? <PlanetOverlay view={view} planet={sel} tab={ui.tab} onTab={(tab) => go({ tab }, 'tab')} /> : null;
      case 'fleets': return view ? <FleetsOverlay view={view} crew={crew} index={ui.fleet} onPick={(i) => go({ fleet: i }, 'move')} /> : null;
      case 'heroes': return view ? <HeroesOverlay view={view} crew={crew} /> : null;
      case 'briefing': return view ? <BriefingOverlay view={view} /> : null;
    }
  })();

  const top = view?.teams[0];
  const left = active.slice(0, 3), right = active.slice(3, 5);
  return (
    <div className="cabinet">
      <aside className="side-art side-left" aria-hidden="true">
        {left.map((t, i) => (
          <div key={t.name} className="side-card" style={{ ['--tilt' as string]: `${i % 2 ? 3 : -3}deg`, ['--fleet' as string]: t.color }}>
            <FleetSprite name={t.name} scale={fleet(t.name).sprite.startsWith('hero') ? 4 / 3 : 2} animate />
            <span>{t.label}</span>
          </div>
        ))}
      </aside>

      <main className="console">
        <header className="marquee">
          <span className="marquee-title">OMNI LOOP</span>
          <span className="marquee-sub">GALAXY COMMAND{view ? ` · SEASON ${view.season}` : ''}</span>
        </header>

        <div className="screen-slot" ref={slotRef}>
          <div className="bezel" style={{ width: W * scale + 24, height: H * scale + 24 }}>
            <div className="screen-fit" style={{ width: W * scale, height: H * scale }}>
              <div className={`screen scene-${ui.scene}`} style={{ transform: `scale(${scale})` }}>
                <canvas
                  ref={canvasRef}
                  width={W}
                  height={H}
                  className="stage"
                  onClick={onCanvasClick}
                  aria-label="Galaxy screen"
                />
                <div className="overlay">
                  {overlay}
                  {ui.toast && <p className="j-toast" role="status">{ui.toast}</p>}
                </div>
                <div className="crt" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>

        <p className="turn">TURN YOUR PHONE SIDEWAYS FOR THE FULL SCREEN</p>
        <div className="deck">
          <div className="plate">
            <span className="plate-big">{session ? 'PRESS START' : 'INSERT COIN'}</span>
            <span className="plate-small plate-keys">ENTER · Z = A · X = B · ARROWS</span>
          </div>
          <div className="emblem" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="plate">
            <span className="plate-big">{top && top.points > 0 ? `HI ${top.points}` : 'FREE PLAY'}</span>
            <span className="plate-small">{me?.team ? `P1 ${me.display_name} · ${fleet(me.team).label}` : session ? 'NEW RECRUIT' : 'INSERT COIN'} · {muted ? 'SOUND OFF (M)' : 'SOUND ON (M)'}</span>
          </div>
        </div>

        <nav className="pad" aria-label="Controller">
          <div className="dpad">
            <button type="button" className="d-up" aria-label="Up" onClick={() => { unlock(); act('up'); }} />
            <button type="button" className="d-left" aria-label="Left" onClick={() => { unlock(); act('left'); }} />
            <button type="button" className="d-right" aria-label="Right" onClick={() => { unlock(); act('right'); }} />
            <button type="button" className="d-down" aria-label="Down" onClick={() => { unlock(); act('down'); }} />
          </div>
          <div className="pills">
            <button type="button" onClick={() => { unlock(); act('select'); }}>SELECT</button>
            <button type="button" onClick={() => { unlock(); act('start'); }}>START</button>
          </div>
          <div className="ab">
            <button type="button" className="btn-b" onClick={() => { unlock(); act('b'); }} aria-label="B, back">B</button>
            <button type="button" className="btn-a" onClick={() => { unlock(); act('a'); }} aria-label="A, confirm">A</button>
          </div>
        </nav>
      </main>

      <aside className="side-art side-right" aria-hidden="true">
        <div className="side-card side-omni" style={{ ['--tilt' as string]: '2deg', ['--fleet' as string]: '#a45cff' }}>
          <Sprite name="omni" scale={2} animate />
          <span>OMNI-MAN</span>
        </div>
        {right.map((t, i) => (
          <div key={t.name} className="side-card" style={{ ['--tilt' as string]: `${i % 2 ? 3 : -3}deg`, ['--fleet' as string]: t.color }}>
            <FleetSprite name={t.name} scale={fleet(t.name).sprite.startsWith('hero') ? 4 / 3 : 2} animate />
            <span>{t.label}</span>
          </div>
        ))}
      </aside>
    </div>
  );
}

'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GalaxyView } from '@omni/galaxy';
import { randomHero, type Hero } from '@omni/design';
import {
  chartKey, drawFrame, layoutChart, layoutMap, layoutSystem, neighbour, sunAt, worldAt, type ChartSource, type FrameState, type SceneName,
} from './scenes';
import { useForm } from './form';
import { useFullscreen } from './fullscreen';
import { frameFor, gridFor, pagesFor, TALL, turnPage, WIDE } from './grid';
import { planetAt, Screen, type GridPoint, type ScreenInfo } from './Screen';
import { Handheld, Lens } from './Handheld';
import { Advance } from './Advance';
import { HeldPad } from './Controls';
import { createHeld } from './held';
import { march, motif, music, setMuted as setAudioMuted, sfx, unlock, type Sfx } from './sound';
import { Press } from './hint';
import { keyAction, type Action } from './keys';
import type { SongName } from './score';
import { BootOverlay, HeroesOverlay, TitleOverlay, titlePhaseAt } from './scenes/attract.tsx';
import {
  CoinOverlay, GateOverlay, IntroOverlay, LinkOverlay, OutsiderOverlay, ReadyOverlay, WelcomeOverlay, type LinkState,
} from './scenes/join.tsx';
import { BuilderOverlay, NameOverlay, SelectOverlay } from './scenes/recruit.tsx';
import { BriefingOverlay, doorOf, MenuOverlay, menuItems } from './scenes/menu.tsx';
import { cardPages, ChartOverlay, SystemOverlay } from './scenes/chart.tsx';
import { MapOverlay } from './scenes/map.tsx';
import { PLANET_TABS, PlanetOverlay } from './scenes/planet.tsx';
import { FleetsOverlay } from './scenes/fleets.tsx';
import { GamesOverlay } from './scenes/games.tsx';
import { InvadersOverlay } from './scenes/invaders.tsx';
import { LevelUpOverlay } from './scenes/levelup.tsx';
import { cabinetDoor, cabinets, xpStatus } from './games/room';
import { GAMES } from './games';
import {
  hudOf, newGame, OVER_SECONDS, pause as pauseGame, press as pressGame, sameHud, step as stepGame, type Game, type GameEvent, type GameHud,
} from './games/invaders';
import { failed, hiOf, overPress, saved, sending, withBest, type ScoreSend } from './scenes/invaders-score';
import { setFleets } from './fleets';
import { brandLook, HOUSE_BRAND, type Brand } from './brand';
import { stripesOf, themeVars } from './theme';
import { Stripes } from './Sprite';
import { foldChar, foldName, nameInit, nameReduce, nameValue, NAME_RULE, type NameAction, type NameState } from './name-entry';
import { BUILDER_ROWS, cycleHero } from './builder';
import { afterGate, afterReturn, afterStart, allowed, arrive, backStep, isDisbanded, isLinked, nextStep, readReturn, type Flow, type Step } from './onboarding';
import { createSeen, fanfareOf, levelUpFor, type LevelUp, type Local } from './levelup';
import { addressAt, landing } from './deep-link';
import { leaveMove, openOver } from './leave.ts';
import { LeaveOverlay } from './leave.tsx';
import type { Account, FleetRow, Player, PlayerPatch, ScoresRead, Session, XpRead } from './types';
import './shell.css';

// The music each screen plays; the rest are silent but for their effects.
const TRACK: Partial<Record<SceneName, SongName>> = {
  intro: 'intro', select: 'select', name: 'name', hero: 'name', link: 'name', ready: 'launch', welcome: 'welcome',
};

// What Entropy Invaders sounds like: its march is the marching bass, a note a step; the rest are effects.
const GAME_SFX: Record<Exclude<GameEvent, 'march'>, Sfx> = { fire: 'fire', hit: 'hit', hurt: 'hurt', wave: 'wave', over: 'over' };
const playGame = (e: GameEvent, g: Game) => (e === 'march' ? march(g.marchStep) : sfx(GAME_SFX[e]));
// A game keeps the grid it started on: turning the phone letterboxes it rather than changing its field.
const GAME_GRID = { wide: WIDE, tall: TALL } as const;
// Entropy Invaders' key in the registry: its crew table's, and the one its scores are sent under.
const INVADERS = GAMES.find((g) => g.scene === 'invaders')?.id ?? 'invaders';

export interface UI {
  scene: SceneName; sel: number; tab: number; menu: number; fleet: number; since: number;
  page: number; // the page shown, on a scene its group splits into pages; back to the first on each scene
  flow: Flow;
  pick: number; lockedAt: number | null; lockSaved: boolean; confirm: boolean;
  name: NameState; shake: number;
  hero: Hero; heroRow: number;
  link: LinkState; linkLogin: string | null;
  away: boolean;
  error: string | null;
  toast: string | null;
  sun: number; world: number; // the star chart's sun and the system's world under the cursor
  card: boolean; cardPage: number; // the reading card over the system, and its page
  cabinet: number; // the game room's cabinet under the cursor (wide), the page shown (tall)
  levelUp: LevelUp | null; // what the level-up screen celebrates, set as it opens
  leaving: boolean; // OPEN THE APP? is up, over the scene (leave.ts): the scene under it is left as it was
}

const FLOW_KEY = 'omni-loop:flow'; // survives the trip to GitHub and back
const GAMES_SEEN_KEY = 'omni-loop:games-seen'; // GAMES carries a NEW tag until the room is opened on this device
// This browser's storage, where each login's last celebrated level is kept (levelup.ts): reaching it can throw.
const LOCAL: Local = () => window.localStorage;

// The address follows the screen (deep-link.ts): a reload or a shared address comes back to it.
function writeHash(ui: UI, view: GalaxyView | null) {
  try {
    window.history.replaceState(null, '', addressAt(window.location.pathname, ui, view));
  } catch { /* sandboxed frames may refuse; the hash is a convenience */ }
}

function readMuted() {
  try { return window.localStorage.getItem('omni-loop:muted') === '1'; } catch { return false; }
}

function readGamesSeen() {
  try { return window.localStorage.getItem(GAMES_SEEN_KEY) === '1'; } catch { return true; } // no storage: no tag that never goes
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
  /** Whose arcade it is: its name draws the mark's letter and the boot's and the title's words, its theme colours the arcade. The house brand when none is given. */
  brand?: Brand;
  /** The star chart's knowledge: the crew's and the demo's only; `'none'` in a build without it (see ChartSource). */
  knowledge?: ChartSource;
  /**
   * The player's XP: their player_xp row, null when they have none, 'unreadable' when it could not be
   * read (the default: a page that says nothing of XP shows no level, and never guesses one).
   */
  xp?: XpRead;
  /**
   * Each game's crew table, by the game's id, as the page read it. None given (the demo, the
   * artifact), the arcade asks the account for them once, on its first render.
   */
  scores?: Record<string, ScoresRead>;
  /**
   * The app the arcade leaves for, from SELECT MODE's APP MODE row after OPEN THE APP? (`/app`, from
   * the page). None in the single-file artifact, which has no app: no row, and nothing leaves.
   */
  app?: string;
}

export function ArcadeApp({ view, fleets, account, session: session0 = null, me: me0 = null, crew: crew0 = [], problem = null, brand = HOUSE_BRAND, knowledge = null, xp = 'unreadable', scores: scores0, app }: ArcadeProps) {
  setFleets(fleets);
  // The brand's look: its theme, written as custom properties on the root element below and read by
  // the canvas, and its mark in the theme's colours. The theme {} is today's arcade.
  const { theme, mark, logo } = useMemo(() => brandLook(brand), [brand]);
  const themeStyle = useMemo(() => themeVars(theme) as CSSProperties, [theme]);
  const active = useMemo(() => fleets.filter((f) => !f.retired), [fleets]);
  // The form follows the device (a mouse, or touch upright or sideways); turning the phone changes
  // the body around the screen and the grid a scene is drawn on, never the game's state.
  const form = useForm();
  const formRef = useRef(form);
  formRef.current = form;
  const mapGrid = gridFor(form, 'map');
  const layout = useMemo(() => (view ? layoutMap(view, mapGrid) : []), [view, mapGrid]);
  const graph = knowledge && knowledge !== 'none' ? knowledge : null;
  const chartGrid = gridFor(form, 'chart'), systemGrid = gridFor(form, 'system');
  const chart = useMemo(() => (graph ? layoutChart(graph, chartGrid) : { suns: [], lanes: [] }), [graph, chartGrid]);
  const start = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const now = () => (performance.now() - start.current) / 1000;
  const firstPlanet = view ? Math.max(0, view.planets.findIndex((p) => p.state === 'distress')) : 0;

  const [session, setSession] = useState<Session | null>(session0);
  const [me, setMe] = useState<Player | null>(me0);
  const [crew, setCrew] = useState<Player[]>(crew0);
  const [ui, setUi] = useState<UI>(() => ({
    scene: 'boot', sel: firstPlanet, tab: 0, menu: 0, fleet: 0, since: 0, page: 0,
    flow: 'onboard', pick: 0, lockedAt: null, lockSaved: false, confirm: false,
    name: nameInit(''), shake: -1, hero: me0?.hero ?? { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 }, heroRow: 0,
    link: 'ask', linkLogin: null, away: false, error: null, toast: null,
    sun: 0, world: 0, card: false, cardPage: 0, cabinet: 0, levelUp: null, leaving: false,
  }));
  const [muted, setMuted] = useState(false);
  const [gamesSeen, setGamesSeen] = useState(true); // read from this device on the first render
  const system = useMemo(() => {
    const sun = chart.suns[ui.sun];
    return graph && sun ? layoutSystem(graph, sun.name, systemGrid) : null;
  }, [graph, chart, ui.sun, systemGrid]);
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const meRef = useRef(me);
  meRef.current = me;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  // Entropy Invaders: the held buttons it reads, the game (stepped by the canvas loop, never by
  // React), and what its text layer shows, set only when that changes.
  const held = useMemo(() => createHeld(), []);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<GameHud | null>(null);
  const hudRef = useRef<GameHud | null>(null);
  const showHud = useCallback((g: Game | null) => {
    const next = g ? hudOf(g) : null;
    if (sameHud(next, hudRef.current)) return;
    hudRef.current = next;
    setHud(next);
  }, []);
  // The crew's tables, and the game over's score: sent once (`send`), for the game `run` counts, so
  // an answer that comes back after a new game started changes the table but not the new game.
  const [scores, setScores] = useState<Record<string, ScoresRead>>(scores0 ?? {});
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const [send, setSend] = useState<ScoreSend | null>(null);
  const sendRef = useRef<ScoreSend | null>(null);
  const runRef = useRef(0);
  const showSend = useCallback((s: ScoreSend | null) => { sendRef.current = s; setSend(s); }, []);
  const sendScore = useCallback((score: number, tries = 1) => {
    const run = runRef.current;
    const attempt = sending(score, tries);
    const board = scoresRef.current[INVADERS];
    const before = board && board !== 'unreadable' ? board.mine : null;
    showSend(attempt);
    account.submitScore(INVADERS, score).then((best) => {
      const m = meRef.current;
      if (m) setScores((all) => ({ ...all, [INVADERS]: withBest(all[INVADERS], { id: m.id, name: m.display_name, hero: m.hero, team: m.team, best }) }));
      // Then the table as stored, with whatever the crew scored meanwhile.
      account.scores(INVADERS).then((b) => setScores((all) => ({ ...all, [INVADERS]: b }))).catch(() => { /* the line above stands */ });
      if (run !== runRef.current) return;
      const done = saved(attempt, best, before);
      showSend(done);
      if (done.state === 'saved' && done.newBest) sfx('linked');
    }).catch((err: Error) => {
      console.error(err);
      if (run !== runRef.current) return;
      showSend(failed(attempt));
      sfx('buzz');
    });
  }, [account, showSend]);
  const sendScoreRef = useRef(sendScore);
  sendScoreRef.current = sendScore;

  // The level-up: the levels each login last celebrated on this device, and the one due now, if any.
  const seen = useMemo(() => createSeen(LOCAL), []);
  const loginOf = () => meRef.current?.github_login ?? sessionRef.current?.github ?? null;
  const levelUpDue = useRef<() => LevelUp | null>(() => null);
  levelUpDue.current = () => {
    const login = loginOf();
    return login ? levelUpFor(xpStatus(isLinked(sessionRef.current, meRef.current), xp), seen.get(login)) : null;
  };

  const go = useCallback((patch: Partial<UI>, effect?: Sfx) => {
    if (effect) sfx(effect);
    // Every route to the menu arrives through here: with a level not yet celebrated on this device,
    // the level-up plays first.
    const due = patch.scene === 'menu' ? levelUpDue.current() : null;
    const next = patch.scene && arrive(patch.scene, Boolean(due)) === 'levelup' ? { ...patch, scene: 'levelup' as const, levelUp: due } : patch;
    setUi((u) => {
      const moved = next.scene !== undefined && next.scene !== u.scene;
      return { ...u, page: moved ? 0 : u.page, ...next, since: moved ? now() : u.since };
    });
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

  /** A on the unlocked cabinet: a new game, laid out for the grid it is shown on, each alien paying the rules' close value. */
  const playInvaders = useCallback(() => {
    if (!view) return go({ toast: problem ?? 'GALAXY OUT OF REACH' }, 'buzz');
    const g = newGame({ layout: gridFor(formRef.current, 'invaders').name, values: view.rules.woundClose, seed: Math.floor(Math.random() * 2 ** 31) });
    held.clear(); // a finger lifted outside a game was never heard: each game starts with nothing held
    runRef.current += 1;
    showSend(null);
    gameRef.current = g;
    showHud(g);
    go({ scene: 'invaders' }, 'start');
  }, [view, problem, go, showHud, showSend, held]);

  /**
   * Opens OPEN THE APP? over whatever scene is showing: the one way to it, from the menu's APP MODE
   * row and from the Game Boy's switch alike. A game in play pauses first, so B comes back to the
   * pause (leave.ts). Without an app to leave for, nothing opens.
   */
  const askLeave = useCallback((patch: Partial<UI> = {}) => {
    if (!app || uiRef.current.leaving) return;
    const g = uiRef.current.scene === 'invaders' ? gameRef.current : null;
    const under = openOver(g);
    if (under !== g) { gameRef.current = under; showHud(under); }
    held.clear();
    go({ ...patch, leaving: true }, 'select');
  }, [app, go, showHud, held]);

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
    setGamesSeen(readGamesSeen());
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
    // A deep link, through the one door; the menu's, like every route to it, through `go`.
    const link = landing(window.location.hash, { view, session: s, linked: isLinked(s, m) });
    if (link) go(link);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The crew's tables the page did not bring (the demo's, the artifact's): the account's, once.
  useEffect(() => {
    if (scores0) return;
    for (const { id } of GAMES) {
      account.scores(id)
        .then((b) => setScores((all) => ({ ...all, [id]: b })))
        .catch(() => setScores((all) => ({ ...all, [id]: 'unreadable' })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (ui.scene !== 'boot') writeHash(ui, view); }, [ui, view]);
  // Back from the app to a page the browser kept as it was: the scene shows again, OPEN THE APP? closed.
  useEffect(() => {
    const back = (e: PageTransitionEvent) => { if (e.persisted) setUi((u) => (u.leaving ? { ...u, leaving: false } : u)); };
    window.addEventListener('pageshow', back);
    return () => window.removeEventListener('pageshow', back);
  }, []);
  // The one door: whatever route led here (a deep link, a crafted return URL, a stale screen after
  // signing out), nothing past INSERT COIN shows without a session.
  useEffect(() => {
    const door = allowed(ui.scene, session, isLinked(session, me));
    if (door !== ui.scene) setUi((u) => ({ ...u, scene: door as SceneName, since: now(), page: 0, away: false, error: null, link: 'ask' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.scene, session, me]);
  useEffect(() => { setAudioMuted(muted); }, [muted]);
  // The game room, once opened on this device, takes GAMES's NEW tag away.
  useEffect(() => {
    if (ui.scene !== 'games' || gamesSeen) return;
    setGamesSeen(true);
    try { window.localStorage.setItem(GAMES_SEEN_KEY, '1'); } catch { /* per-device courtesy only */ }
  }, [ui.scene, gamesSeen]);
  useEffect(() => {
    if (ui.lockedAt !== null) return;
    music(ui.scene === 'levelup' && ui.levelUp ? fanfareOf(ui.levelUp) : TRACK[ui.scene] ?? null);
  }, [ui.scene, ui.lockedAt, ui.levelUp]);
  // A game is only ever on its own scene: one left by another route is over, and the scene with no
  // game goes back to the room.
  useEffect(() => {
    if (ui.scene === 'invaders' && !gameRef.current) go({ scene: 'games' });
    if (ui.scene !== 'invaders' && gameRef.current) { gameRef.current = null; showHud(null); }
  }, [ui.scene, go, showHud]);
  // A window that loses focus or a hidden tab never hears its keys and fingers go up: nothing stays
  // held, and a game pauses.
  useEffect(() => {
    const lost = () => {
      held.clear();
      const g = gameRef.current;
      if (uiRef.current.scene !== 'invaders' || !g) return;
      gameRef.current = pauseGame(g);
      showHud(gameRef.current);
    };
    const onVisibility = () => { if (document.hidden) lost(); };
    window.addEventListener('blur', lost);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', lost);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [held, showHud]);

  // ── Timed hand-overs ──
  // They wait while OPEN THE APP? is up, so B finds the scene it covered, and start again from there.
  useEffect(() => {
    const later = (ms: number, fn: () => void) => { const id = window.setTimeout(fn, ms); return () => window.clearTimeout(id); };
    if (ui.leaving) return undefined;
    if (ui.scene === 'boot') return later(3200, () => go({ scene: 'title' }));
    if (ui.scene === 'intro') return later(20200, () => open('select', { flow: 'onboard' }));
    if (ui.scene === 'welcome') return later(3200, () => open('menu'));
    // The lock-in plays for 1.8 s, and moves on once the fleet is saved (whichever comes last).
    if (ui.scene === 'select' && ui.lockedAt !== null && ui.lockSaved) {
      return later(Math.max(0, 1800 - (now() - ui.lockedAt) * 1000), () => open(nextStep('select', uiRef.current.flow, meRef.current)));
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.scene, ui.lockedAt, ui.lockSaved, ui.leaving, go, open]);
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

  /** Sound on or off: M on the keyboard, the grille on a Game Boy. Kept under the same key across reloads. */
  const toggleSound = useCallback(() => {
    setMuted((m) => { try { window.localStorage.setItem('omni-loop:muted', m ? '0' : '1'); } catch { /* per-viewer only */ } return !m; });
  }, []);

  const leave = useCallback((step: Step) => {
    const to = backStep(step, uiRef.current.flow);
    if (to === 'title') return go({ scene: 'title', flow: 'onboard' }, 'back');
    return open(to, to === 'menu' ? {} : { flow: uiRef.current.flow }, 'back');
  }, [go, open]);

  /** Opens the menu's item `i`: with A or START on the row under the cursor, or with a tap on any row. */
  const openItem = useCallback((i: number) => {
    const items = menuItems({ joined: Boolean(meRef.current?.team), linked: isLinked(sessionRef.current, meRef.current), signedIn: Boolean(sessionRef.current), newGames: !gamesSeen, app: Boolean(app) });
    const item = items[i];
    if (!item) return;
    const door = doorOf(item, { view, chart: knowledge, problem });
    if (door) return 'scene' in door ? go({ scene: door.scene, menu: i, card: false }, 'select') : go({ menu: i, toast: door.refused }, 'buzz');
    if (item.id === 'myhero') return open('name', { flow: 'myhero', menu: i }, 'select');
    if (item.id === 'change') return open('select', { flow: 'change', menu: i }, 'select');
    if (item.id === 'link') return open('link', { flow: 'link', menu: i }, 'select');
    if (item.id === 'app') return askLeave({ menu: i });
    if (item.id === 'signout') return signOut();
  }, [view, knowledge, go, open, signOut, problem, gamesSeen, app, askLeave]);

  const act = useCallback((action: Action) => {
    const u = uiRef.current;
    // OPEN THE APP? takes every press while it is up: A (or START) leaves for the app in this tab,
    // B closes it on the scene as it was, and nothing else is read (leave.ts).
    if (u.leaving) {
      const move = leaveMove(action);
      if (move === 'go' && app) { sfx('start'); return window.location.assign(app); }
      if (move) return go({ leaving: false }, 'back');
      return;
    }
    const planets = view?.planets.length ?? 0;
    const items = menuItems({ joined: Boolean(meRef.current?.team), linked: isLinked(sessionRef.current, meRef.current), signedIn: Boolean(sessionRef.current), newGames: !gamesSeen, app: Boolean(app) });
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
        return openItem(i);
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
      case 'chart': case 'system': {
        const entry = system?.worlds[u.world]?.entry;
        const pages = () => (graph && entry ? cardPages(graph, entry, gridFor(formRef.current, 'system').name).length : 1);
        const move = chartKey({ ...u, scene: u.scene }, action, { chart, system, pages });
        return move ? go(move.patch, move.sound) : undefined;
      }
      case 'games': {
        // ◀ ▶ choose a cabinet on the wide grid and turn the page on the tall one: one cursor for both.
        const status = xpStatus(isLinked(sessionRef.current, meRef.current), xp);
        const room = cabinets(status);
        const at = Math.min(u.cabinet, room.length - 1);
        if (action === 'left' || action === 'right') return go({ cabinet: turnPage(at, room.length, action) }, 'move');
        if (action === 'select') return go({ cabinet: turnPage(at, room.length, 'right') }, 'move');
        if (action === 'a' || action === 'start') {
          const door = cabinetDoor(room[at], status);
          if (!('scene' in door)) return go({ toast: door.refused }, 'buzz');
          return door.scene === 'invaders' ? playInvaders() : go({ scene: door.scene }, 'select');
        }
        if (action === 'b') return go({ scene: 'menu' }, 'back');
        return;
      }
      case 'levelup': {
        // A (or START) plays the game the level opened at once; B, and A with no game opened, go on
        // to the menu. Either saves the level as celebrated on this device, so it plays once.
        if (action !== 'a' && action !== 'b' && action !== 'start') return;
        const login = loginOf();
        if (u.levelUp && login) seen.set(login, u.levelUp.xp.level);
        const game = action === 'b' ? null : u.levelUp?.game ?? null;
        if (game?.scene === 'invaders') return view ? playInvaders() : open('menu', { toast: problem ?? 'GALAXY OUT OF REACH' }, 'buzz');
        if (game?.scene) return go({ scene: game.scene }, 'start');
        return open('menu', {}, action === 'b' ? 'back' : 'select');
      }
      case 'invaders': {
        // ◀ ▶ and A are read held, by the canvas loop; a press answers START, B, and A on a screen.
        const g = gameRef.current;
        if (!g) return action === 'b' ? go({ scene: 'games' }, 'back') : undefined;
        // The game over, once its score has shown: A retries a send that failed, once; the rest is the game's.
        const s = sendRef.current;
        if (g.over && s && g.t - g.overAt >= OVER_SECONDS && overPress(s, action) === 'retry' && s.state === 'failed') {
          sfx('select');
          return sendScore(s.score, s.tries + 1);
        }
        const { game: next, leave } = pressGame(g, action);
        if (leave) {
          gameRef.current = null;
          showHud(null);
          return go({ scene: 'games' }, 'back');
        }
        if (next === g) return;
        gameRef.current = next;
        sfx(next.paused ? 'back' : 'select');
        return showHud(next);
      }
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
      default: {
        // `heroes` and `briefing`: ◀ ▶ turn the pages their group declares on the grid they are drawn on.
        if (action === 'left' || action === 'right') {
          const n = pagesFor(u.scene, { view, grid: gridFor(formRef.current, u.scene) });
          return n > 1 ? go({ page: turnPage(u.page, n, action) }, 'tab') : undefined;
        }
        if (action === 'a' || action === 'b' || action === 'start') return go({ scene: 'menu' }, 'back');
      }
    }
  }, [view, fleets, active, layout, chart, system, graph, go, open, leave, signIn, signOut, linkGithub, lockIn, nameAction, nameDone, heroDone, openItem, xp, gamesSeen, playInvaders, showHud, sendScore, seen, problem, app]);

  // ── Keyboard: the pad everywhere, a text mode on the name screen ──
  // Fullscreen hears every key first (and every click and touch press on its own): the first press
  // of the page load asks for it, F toggles it, and the Esc that leaves it is never also B.
  const fullscreen = useFullscreen();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const modified = e.metaKey || e.ctrlKey || e.altKey;
      if (fullscreen({ kind: 'key', key: e.key, scene: uiRef.current.scene, modified, repeat: e.repeat })) return e.preventDefault();
      if (modified) return;
      // Let Space and Enter activate a focused button natively; the button calls `act` itself.
      if (e.target instanceof Element && e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
      unlock();
      // Letters type on the name screen, but not under OPEN THE APP?: it takes the pad's keys (leave.ts).
      if (uiRef.current.scene === 'name' && !uiRef.current.leaving) {
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
      if (e.key === 'm' || e.key === 'M') return toggleSound();
      const action = keyAction(e.key);
      if (!action) return;
      e.preventDefault();
      held.keyDown(e.key);
      if (e.repeat && (action === 'a' || action === 'b' || action === 'start')) return;
      if (e.repeat && uiRef.current.scene === 'invaders') return; // a game reads a held key as held, never as repeats
      act(action);
    };
    const onKeyUp = (e: KeyboardEvent) => held.keyUp(e.key);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [act, fullscreen, leave, nameAction, nameDone, toggleSound, held]);

  // The title cycles its attract phases.
  const [, tick] = useState(0);
  useEffect(() => {
    if (ui.scene !== 'title') return;
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [ui.scene]);

  // ── Canvas loop ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grid = ui.scene === 'invaders' && hud ? GAME_GRID[hud.layout] : gridFor(form, ui.scene);
  const pages = pagesFor(ui.scene, { view, grid });
  const page = Math.min(ui.page, pages - 1);
  const frameRef = useRef({ view, layout, active, me, grid, page, mark, logo, theme, knowledge, chart, system });
  frameRef.current = { view, layout, active, me, grid, page, mark, logo, theme, knowledge, chart, system };
  useEffect(() => {
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let last = now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = now(), dt = t - last;
      last = t;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const u = uiRef.current;
      const f = frameRef.current;
      // The game plays the time since the last frame, with the buttons held now.
      let game = u.scene === 'invaders' ? gameRef.current : null;
      if (game) {
        game = stepGame(game, held.buttons(), dt);
        gameRef.current = game;
        for (const e of game.events) playGame(e, game);
        showHud(game);
        if (game.over && !sendRef.current) sendScoreRef.current(game.score); // once a game: sendRef is set at once
      }
      const picking = u.scene === 'select' ? f.active[u.pick]?.name ?? null : null;
      const frame: FrameState = {
        scene: u.scene, grid: f.grid, page: f.page, view: f.view, layout: f.layout, sel: u.sel, fleetSel: u.fleet, t, sceneT: t - u.since, reduced: reducedQuery.matches, mark: f.mark, logo: f.logo, theme: f.theme,
        join: {
          fleets: f.active, pick: u.pick, lockedAt: u.lockedAt, away: u.away || u.link === 'away',
          team: picking ?? f.me?.team ?? null,
          hero: u.scene === 'hero' ? u.hero : f.me?.hero ?? u.hero,
        },
        chart: { source: f.knowledge, layout: f.chart, system: f.system, sun: u.sun, world: u.world },
        game,
      };
      const phase = titlePhaseAt(t - u.since);
      drawFrame(ctx, frame, !f.view && phase === 'hiscore' ? 'title' : phase); // no high scores without the galaxy
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A click on a key hint ("[A] LINK GITHUB"), or a press of a Game Boy's control, presses that key.
  const press = useCallback((action: Action) => { unlock(); act(action); }, [act]);
  // The Game Boy's GAME ▮▯ APP switch: no key, but OPEN THE APP?, on any scene. None without an app.
  const switchToApp = useCallback(() => { unlock(); askLeave(); }, [askLeave]);

  // A tap on the screen, in the pixels of the grid it is drawn on.
  const onTap = (p: GridPoint) => {
    unlock();
    const u = uiRef.current;
    if (u.leaving) return; // the scene under OPEN THE APP? reads no tap
    if (u.scene === 'boot' || u.scene === 'title' || u.scene === 'gate' || u.scene === 'ready' || u.scene === 'welcome') return act('start');
    if (u.scene === 'link' && u.link === 'done') return act('start');
    if (u.scene === 'chart') {
      const hit = sunAt(chart, p);
      if (!hit) return;
      return hit.index === u.sun ? act('a') : go({ sun: hit.index, world: 0 }, 'move');
    }
    if (u.scene === 'system') {
      if (u.card) return; // the card is read, and closed, with its own buttons
      const hit = system ? worldAt(system, p) : null;
      if (!hit) return;
      return hit.index === u.world ? act('a') : go({ world: hit.index }, 'move');
    }
    if (u.scene !== 'map') return;
    const hit = planetAt(layout, p);
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
  const items = menuItems({ joined: Boolean(me?.team), linked: isLinked(session, me), signedIn: Boolean(session), newGames: !gamesSeen, app: Boolean(app) });
  const xpNow = xpStatus(isLinked(session, me), xp);
  const displayName = me?.display_name ?? (session ? foldName(session.givenName) || 'RECRUIT' : '');
  const who = session
    ? `${account.kind === 'demo' ? 'DEMO · ' : ''}P1 ${displayName}`
    : account.kind === 'demo' ? 'DEMO GALAXY' : account.kind === 'closed' ? 'SIGN-IN NOT OPEN YET' : problem ? 'GALAXY OUT OF REACH' : 'SIGNED OUT';
  const overlay = (() => {
    switch (ui.scene) {
      case 'boot': return <BootOverlay brand={brand} />;
      case 'title': return <TitleOverlay view={view} phase={view ? phase : phase === 'hiscore' ? 'title' : phase} sceneT={now() - ui.since} who={who} signedIn={Boolean(session)} brand={brand} />;
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
      case 'menu': return <MenuOverlay view={view} items={items} index={Math.min(ui.menu, items.length - 1)} me={me} onPick={openItem} chart={knowledge} xp={xpNow} />;
      case 'games': return <GamesOverlay xp={xpNow} me={me} index={ui.cabinet} scores={scores} onPick={(i) => { if (i === ui.cabinet) act('a'); else go({ cabinet: i }, 'move'); }} />;
      case 'levelup': return ui.levelUp ? <LevelUpOverlay levelUp={ui.levelUp} /> : null;
      case 'invaders': return view ? <InvadersOverlay hud={hud} values={view.rules.woundClose} hero={me?.hero ?? ui.hero} team={me?.team ?? null} hi={hiOf(scores[INVADERS])} send={send} /> : null;
      case 'map': return view ? <MapOverlay view={view} layout={layout} sel={ui.sel} onLand={() => act('a')} /> : null;
      case 'planet': return view && sel ? <PlanetOverlay view={view} planet={sel} tab={ui.tab} onTab={(tab) => go({ tab }, 'tab')} /> : null;
      case 'fleets': return view ? <FleetsOverlay view={view} crew={crew} index={ui.fleet} onPick={(i) => go({ fleet: i }, 'move')} /> : null;
      case 'heroes': return view ? <HeroesOverlay view={view} crew={crew} /> : null;
      case 'briefing': return view ? <BriefingOverlay view={view} /> : null;
      case 'chart': return <ChartOverlay source={knowledge} layout={chart} sun={ui.sun} onEnter={() => act('a')} />;
      case 'system': return graph && system
        ? <SystemOverlay graph={graph} layout={system} world={ui.world} card={ui.card} cardPage={ui.cardPage} onRead={() => act('a')} onPage={(cardPage) => go({ cardPage }, 'tab')} />
        : <ChartOverlay source={knowledge} layout={chart} sun={ui.sun} onEnter={() => act('a')} />;
    }
  })();

  const info = useMemo<ScreenInfo>(() => ({ form, grid, page, pages }), [form, grid, page, pages]);
  const body = { season: view?.season ?? null, muted, onAction: press, onSound: toggleSound, onApp: app ? switchToApp : undefined, leaving: ui.leaving };
  // The screen keeps its place in the tree in every form, so turning the phone keeps it as it is.
  // The root carries the theme's custom properties, and the sprites in its panels its stripes.
  return (
    <div className={`shell form-${form}`} style={themeStyle}>
      <Stripes.Provider value={stripesOf(theme)}>
        <Lens bare={form === 'full'} muted={muted}>
          <Screen scene={ui.scene} frame={frameFor(form)} info={info} canvasRef={canvasRef} onTap={onTap}>
            <Press.Provider value={press}>
              {overlay}
              {ui.leaving && <LeaveOverlay />}
            </Press.Provider>
            {ui.toast && <p className="j-toast" role="status">{ui.toast}</p>}
          </Screen>
        </Lens>
        <HeldPad.Provider value={ui.scene === 'invaders' ? held : null}>
          {form === 'handheld' && <Handheld {...body} />}
          {form === 'advance' && <Advance {...body} />}
        </HeldPad.Provider>
      </Stripes.Provider>
    </div>
  );
}

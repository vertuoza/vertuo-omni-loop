'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GalaxyView } from '@omni/galaxy';
import { drawFrame, H, layoutMap, neighbour, W, type FrameState, type SceneName } from './scenes';
import { play, type Sfx } from './sound';
import {
  BootOverlay, BriefingOverlay, FleetsOverlay, HeroesOverlay, MapOverlay, MenuOverlay, PlanetOverlay, TitleOverlay,
  MENU, PLANET_TABS, titlePhaseAt,
} from './screens';
import { Sprite } from './Sprite';
import { fleet } from './fleets';

export type Action = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'select';

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

export interface UI { scene: SceneName; sel: number; tab: number; menu: number; fleet: number; since: number }

const DEEP_LINKS: SceneName[] = ['map', 'fleets', 'heroes', 'briefing'];

function readHash(view: GalaxyView): Partial<UI> | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.replace('#', '');
  if ((DEEP_LINKS as string[]).includes(h)) return { scene: h as SceneName };
  const m = /^planet-(\d+)$/.exec(h);
  if (m) {
    const i = view.planets.findIndex((p) => p.prd === Number(m[1]));
    if (i >= 0) return { scene: 'planet', sel: i };
  }
  return null;
}

function writeHash(ui: UI, view: GalaxyView) {
  try {
    const h = ui.scene === 'planet' ? `planet-${view.planets[ui.sel]?.prd}` : (DEEP_LINKS as string[]).includes(ui.scene) ? ui.scene : '';
    const url = `${window.location.pathname}${window.location.search}${h ? `#${h}` : ''}`;
    window.history.replaceState(null, '', url);
  } catch { /* sandboxed frames may refuse; the hash is a convenience */ }
}

function readMuted() {
  try { return window.localStorage.getItem('omni-loop:muted') === '1'; } catch { return false; }
}

export function ArcadeApp({ view }: { view: GalaxyView }) {
  const layout = useMemo(() => layoutMap(view), [view]);
  const start = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const now = () => (performance.now() - start.current) / 1000;
  const firstPlanet = Math.max(0, view.planets.findIndex((p) => p.state === 'distress'));
  const [ui, setUi] = useState<UI>({ scene: 'boot', sel: firstPlanet, tab: 0, menu: 0, fleet: 0, since: 0 });
  const [muted, setMuted] = useState(false);
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    setMuted(readMuted());
    const linked = readHash(view);
    if (linked) setUi((u) => ({ ...u, ...linked, since: now() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (ui.scene !== 'boot') writeHash(ui, view); }, [ui, view]);

  const go = useCallback((patch: Partial<UI>, sfx?: Sfx) => {
    if (sfx) play(sfx, mutedRef.current);
    setUi((u) => ({ ...u, ...patch, since: patch.scene && patch.scene !== u.scene ? now() : u.since }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = useCallback((action: Action) => {
    const u = uiRef.current;
    const planets = view.planets.length;
    switch (u.scene) {
      case 'boot': return go({ scene: 'title' });
      case 'title':
        if (action === 'a' || action === 'start') return go({ scene: 'menu' }, 'start');
        return;
      case 'menu':
        if (action === 'up') return go({ menu: (u.menu + MENU.length - 1) % MENU.length }, 'move');
        if (action === 'down' || action === 'select') return go({ menu: (u.menu + 1) % MENU.length }, 'move');
        if (action === 'a' || action === 'start') return go({ scene: MENU[u.menu].scene }, 'select');
        if (action === 'b') return go({ scene: 'title' }, 'back');
        return;
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
        const n = view.teams.length;
        if (action === 'left' || action === 'up') return go({ fleet: (u.fleet + n - 1) % n }, 'move');
        if (action === 'right' || action === 'down' || action === 'select') return go({ fleet: (u.fleet + 1) % n }, 'move');
        if (action === 'a' || action === 'start') {
          const team = view.teams[u.fleet]?.name;
          const i = view.planets.findIndex((p) => p.ownerTeam === team);
          return go({ scene: 'map', ...(i >= 0 ? { sel: i } : {}) }, 'select');
        }
        if (action === 'b') return go({ scene: 'menu' }, 'back');
        return;
      }
      default:
        if (action === 'a' || action === 'b' || action === 'start') return go({ scene: 'menu' }, 'back');
    }
  }, [go, layout, view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'm' || e.key === 'M') {
        setMuted((m) => { try { window.localStorage.setItem('omni-loop:muted', m ? '0' : '1'); } catch { /* per-viewer only */ } return !m; });
        return;
      }
      const action = KEYS[e.key];
      if (!action) return;
      const target = e.target as HTMLElement | null;
      // Let Space and Enter activate a focused button natively; the button calls `act` itself.
      if (target?.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
      e.preventDefault();
      act(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act]);

  // Boot hands over to the title screen by itself; the title cycles its attract phases.
  useEffect(() => {
    if (ui.scene !== 'boot') return;
    const id = window.setTimeout(() => go({ scene: 'title' }), 3200);
    return () => window.clearTimeout(id);
  }, [ui.scene, go]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (ui.scene !== 'title') return;
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [ui.scene]);

  // ── Canvas loop ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    const loop = () => {
      const t = now();
      const u = uiRef.current;
      const frame: FrameState = {
        scene: u.scene, view, layout, sel: u.sel, fleetSel: u.fleet, t, sceneT: t - u.since, reduced: reducedQuery.matches,
      };
      drawFrame(ctx, frame, titlePhaseAt(t - u.since));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, layout]);

  // ── Fit the 640×360 screen into whatever room the console leaves it ──
  const slotRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      const s = Math.min(width / (W * 2), Math.max(height, 200) / (H * 2));
      setScale(Math.max(0.3, s));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const u = uiRef.current;
    if (u.scene === 'boot' || u.scene === 'title') return act('start');
    if (u.scene !== 'map') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const hit = layout.find((s) => Math.hypot(s.x - x, s.y - y) <= s.r + 5);
    if (!hit) return;
    if (hit.index === u.sel) go({ scene: 'planet', tab: 0 }, 'select');
    else go({ sel: hit.index }, 'move');
  };

  const phase = titlePhaseAt(now() - ui.since);
  const sel = view.planets[ui.sel];
  const overlay = (() => {
    switch (ui.scene) {
      case 'boot': return <BootOverlay />;
      case 'title': return <TitleOverlay view={view} phase={phase} sceneT={now() - ui.since} />;
      case 'menu': return <MenuOverlay view={view} index={ui.menu} onPick={(i) => go({ menu: i, scene: MENU[i].scene }, 'select')} />;
      case 'map': return <MapOverlay view={view} layout={layout} sel={ui.sel} onLand={() => act('a')} />;
      case 'planet': return sel ? <PlanetOverlay view={view} planet={sel} tab={ui.tab} onTab={(tab) => go({ tab }, 'tab')} /> : null;
      case 'fleets': return <FleetsOverlay view={view} index={ui.fleet} onPick={(i) => go({ fleet: i }, 'move')} />;
      case 'heroes': return <HeroesOverlay view={view} />;
      case 'briefing': return <BriefingOverlay view={view} />;
    }
  })();

  const top = view.teams[0];
  return (
    <div className="cabinet">
      <aside className="side-art side-left" aria-hidden="true">
        {['beaver', 'octopod', 'picsou'].map((t, i) => (
          <div key={t} className="side-card" style={{ ['--tilt' as string]: `${i % 2 ? 3 : -3}deg`, ['--fleet' as string]: fleet(t).color }}>
            <Sprite name={fleet(t).sprite} scale={5} />
            <span>{fleet(t).label}</span>
          </div>
        ))}
      </aside>

      <main className="console">
        <header className="marquee">
          <span className="marquee-title">OMNI LOOP</span>
          <span className="marquee-sub">GALAXY COMMAND · SEASON {view.season}</span>
        </header>

        <div className="screen-slot" ref={slotRef}>
          <div className="bezel" style={{ width: W * 2 * scale + 24, height: H * 2 * scale + 24 }}>
            <div className="screen-fit" style={{ width: W * 2 * scale, height: H * 2 * scale }}>
              <div className={`screen scene-${ui.scene}`} style={{ transform: `scale(${scale})` }}>
                <canvas
                  ref={canvasRef}
                  width={W}
                  height={H}
                  className="stage"
                  onClick={onCanvasClick}
                  aria-label="Galaxy screen"
                />
                <div className="overlay">{overlay}</div>
                <div className="crt" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>

        <p className="turn">TURN YOUR PHONE SIDEWAYS FOR THE FULL SCREEN</p>
        <div className="deck">
          <div className="plate">
            <span className="plate-big">PRESS START</span>
            <span className="plate-small plate-keys">ENTER · Z = A · X = B · ARROWS</span>
          </div>
          <div className="emblem" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="plate">
            <span className="plate-big">{top && top.points > 0 ? `HI ${top.points}` : 'FREE PLAY'}</span>
            <span className="plate-small">{top && top.points > 0 ? `${fleet(top.name).label} LEADS` : 'VIEW ONLY'} · {muted ? 'SOUND OFF (M)' : 'SOUND ON (M)'}</span>
          </div>
        </div>

        <nav className="pad" aria-label="Controller">
          <div className="dpad">
            <button type="button" className="d-up" aria-label="Up" onClick={() => act('up')} />
            <button type="button" className="d-left" aria-label="Left" onClick={() => act('left')} />
            <button type="button" className="d-right" aria-label="Right" onClick={() => act('right')} />
            <button type="button" className="d-down" aria-label="Down" onClick={() => act('down')} />
          </div>
          <div className="pills">
            <button type="button" onClick={() => act('select')}>SELECT</button>
            <button type="button" onClick={() => act('start')}>START</button>
          </div>
          <div className="ab">
            <button type="button" className="btn-b" onClick={() => act('b')} aria-label="B, back">B</button>
            <button type="button" className="btn-a" onClick={() => act('a')} aria-label="A, confirm">A</button>
          </div>
        </nav>
      </main>

      <aside className="side-art side-right" aria-hidden="true">
        <div className="side-card side-omni" style={{ ['--tilt' as string]: '2deg', ['--fleet' as string]: '#a45cff' }}>
          <Sprite name="omni" scale={5} />
          <span>OMNI-MAN</span>
        </div>
        {['cia', 'invincible-team'].map((t, i) => (
          <div key={t} className="side-card" style={{ ['--tilt' as string]: `${i % 2 ? 3 : -3}deg`, ['--fleet' as string]: fleet(t).color }}>
            <Sprite name={fleet(t).sprite} scale={5} />
            <span>{fleet(t).label}</span>
          </div>
        ))}
      </aside>
    </div>
  );
}

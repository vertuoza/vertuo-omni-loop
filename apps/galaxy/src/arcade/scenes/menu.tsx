'use client';
// The menu group's text layer: the menu (a visitor's and a player's) and How to play, laid out for
// the grid the screen is drawn on (menu.css places each for `.grid-wide` and `.grid-tall`).
import type { GalaxyView, WoundKind } from '@omni/galaxy';
import { woundTint } from '@omni/design';
import { useScreen } from '../Screen';
import { Sprite } from '../Sprite';
import { fleet, WOUND_LOOK } from '../fleets';
import type { Player } from '../types';
import type { ChartSource } from './chart-layout.ts';
import { chartRefusal, chartTally } from './chart.tsx';
import type { SceneName } from './common.ts';
import { BRIEFING_PAGES, type BriefingPage } from './menu.ts';
import './common.css';
import './menu.css';

function SourceChip({ view }: { view: GalaxyView }) {
  return view.source === 'supabase'
    ? <span className="source live">● SUPABASE LEDGER</span>
    : <span className="source">DEMO LEDGER · FICTIONAL DATA</span>;
}

// ── Menu ─────────────────────────────────────────────────────────────────────

export type MenuId = 'map' | 'chart' | 'fleets' | 'heroes' | 'briefing' | 'myhero' | 'change' | 'link' | 'signout';
export interface MenuItem { id: MenuId; label: string; scene?: SceneName; fresh?: boolean }

const GALAXY: MenuItem[] = [
  { id: 'map', label: 'GALAXY MAP', scene: 'map' },
  { id: 'chart', label: 'STAR CHART', scene: 'chart' },
  { id: 'fleets', label: 'FLEETS', scene: 'fleets' },
  { id: 'heroes', label: 'HALL OF HEROES', scene: 'heroes' },
  { id: 'briefing', label: 'HOW TO PLAY', scene: 'briefing' },
];

/**
 * The menu for who is at the cabinet: the galaxy for everyone signed in; then, for a player, their
 * hero and fleet; for a visitor, the way to play (linking GitHub).
 */
export function menuItems({ joined, linked, signedIn }: { joined: boolean; linked: boolean; signedIn: boolean }): MenuItem[] {
  return [
    ...(signedIn && !linked ? [{ id: 'link', label: 'PLAY', fresh: true }] as MenuItem[] : []),
    ...GALAXY,
    ...(joined && linked ? [{ id: 'myhero', label: 'MY HERO', fresh: true }, { id: 'change', label: 'CHANGE FLEET', fresh: true }] as MenuItem[] : []),
    ...(signedIn ? [{ id: 'signout', label: 'SIGN OUT' }] as MenuItem[] : []),
  ];
}

/**
 * Where a menu item's scene opens, or why it does not: the galaxy's screens need the galaxy, and the
 * star chart needs the knowledge (out of reach past the crew's gate, or absent from the build).
 */
export function doorOf(item: MenuItem, at: { view: GalaxyView | null; chart: ChartSource; problem: string | null }): { scene: SceneName } | { refused: string } | null {
  if (!item.scene) return null;
  if (item.id === 'chart') return at.chart && at.chart !== 'none' ? { scene: item.scene } : { refused: chartRefusal(at.chart) };
  return at.view ? { scene: item.scene } : { refused: at.problem ?? 'SIGN IN TO SEE THE GALAXY' };
}

export function MenuOverlay({ view, items, index, me, onPick, chart = null }: {
  view: GalaxyView | null; items: MenuItem[]; index: number; me: Player | null; onPick: (i: number) => void; chart?: ChartSource;
}) {
  const hint: Record<MenuId, string> = {
    map: view ? `${view.totals.planets} planets · ${view.totals.inDistress} in distress` : 'Out of reach',
    chart: chart === 'none' ? 'NOT IN THIS BUILD' : chart ? chartTally(chart) : 'OUT OF REACH',
    fleets: view ? `${view.teams.length} fleets · ${fleet(view.teams[0]?.name).label} lead` : 'Out of reach',
    heroes: view ? `${view.heroes.length} heroes scored in ${view.season}` : 'Out of reach',
    briefing: 'How points are won and lost',
    myhero: 'Your name and your look',
    change: 'Your future points follow you',
    link: 'Link your GitHub to join a fleet',
    signout: 'Back to the title',
  };
  const f = fleet(me?.team);
  return (
    <div className={`menu${items.length > 4 ? ' long' : ''}`}>
      <h2>SELECT MODE</h2>
      {me?.team && me.github_login
        ? <span className="j-badge" style={{ ['--fc' as string]: f.color }}>P1 {me.display_name} · {f.label}</span>
        : <span className="j-badge" style={{ ['--fc' as string]: '#8a90d6' }}>VISITOR</span>}
      <ul>
        {items.map((m, i) => (
          <li key={m.id}>
            <button type="button" className={`${i === index ? 'active' : ''}${m.id === 'link' ? ' nudge' : ''}`} onClick={() => onPick(i)}>
              <span className="cursor" aria-hidden="true">{i === index ? '▶' : ''}</span>
              <span className="menu-label">{m.label}</span>
              <span className="menu-hint">{hint[m.id]}</span>
            </button>
          </li>
        ))}
      </ul>
      <footer className="menu-foot">
        {view ? <SourceChip view={view} /> : <span className="source">GALAXY OUT OF REACH</span>}
        <span>B · BACK TO TITLE</span>
      </footer>
    </div>
  );
}

// ── How to play ──────────────────────────────────────────────────────────────

/**
 * How points are won and lost, from the rules the galaxy carries. The wide grid shows both sections
 * side by side; the tall one shows a section a page, which ◀ ▶ turn (`BRIEFING_PAGES`).
 */
export function BriefingOverlay({ view }: { view: GalaxyView }) {
  const { grid, page } = useScreen();
  const r = view.rules;
  const kinds = Object.keys(WOUND_LOOK) as WoundKind[];
  const sections: Record<BriefingPage, React.ReactNode> = {
    earn: (
      <section key="earn">
        <h3 className="gold">EARN</h3>
        <ul>
          <li><Sprite name="flag" scale={1} /> SECURE A ZONE <b>+{r.zoneSecured}</b></li>
          <li><Sprite name="beacon" scale={1} /> RESCUE ANOTHER FLEET <b>+{r.rescue}</b></li>
          <li><Sprite name="star" scale={1} /> FLEET TERRAFORMS <b>+{r.terraformOwner} × CLASS</b></li>
          <li><Sprite name="ship" scale={1} /> EXPEDITION ON IT <b>+{r.terraformExpedition}</b></li>
          <li className="note">ZONE SECURED AT NIGHT ×{r.nightShiftMultiplier} · ENTROPY CLEARED FOR ANOTHER FLEET ×{r.crossTeamMultiplier}</li>
        </ul>
      </section>
    ),
    entropy: (
      <section key="entropy">
        <h3 className="red">ENTROPY · CLEAR IT / IT COSTS</h3>
        <ul>
          {kinds.map((k) => (
            <li key={k}>
              <Sprite name="entropy" scale={0.5} tint={woundTint(k)} />
              <span style={{ color: WOUND_LOOK[k].color }}>{WOUND_LOOK[k].name}</span>
              <b>+{r.woundClose[k]} / −{r.decayPerTranche[k]}</b>
            </li>
          ))}
          <li className="note">DECAY PER {r.trancheHours} WORKING HOURS · LOST AFTER {r.lostAfterDays} SILENT DAYS</li>
        </ul>
      </section>
    ),
  };
  const tall = grid.name === 'tall';
  const at = Math.max(0, Math.min(page, BRIEFING_PAGES.length - 1));
  return (
    <div className="briefing">
      <h2>HOW TO PLAY</h2>
      {tall && <p className="brief-page"><span aria-hidden="true">◀</span> {`PAGE ${at + 1}/${BRIEFING_PAGES.length}`} <span aria-hidden="true">▶</span></p>}
      <div className="brief-cols">
        {tall ? sections[BRIEFING_PAGES[at]] : BRIEFING_PAGES.map((p) => sections[p])}
      </div>
      <p className="hint">RUN /omni-yolo &lt;prd&gt; TO LEND YOUR AGENT TO A PLANET · B · MENU</p>
    </div>
  );
}

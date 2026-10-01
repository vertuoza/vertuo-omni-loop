'use client';
// The menu group's text layer: the menu (a visitor's and a player's) and How to play, laid out for
// the grid the screen is drawn on (menu.css places each for `.grid-wide` and `.grid-tall`).
import { xpForLevel, type GalaxyView, type WoundKind, type XpRules } from '@omni/galaxy';
import { woundTint } from '@omni/design';
import { useScreen } from '../Screen';
import { Sprite } from '../Sprite';
import { crewLook, fleet, WOUND_LOOK } from '../fleets';
import type { Player } from '../types';
import type { ChartSource } from './chart-layout.ts';
import { chartRefusal, chartTally } from './chart.tsx';
import type { SceneName } from './common.ts';
import { BRIEFING_PAGES, type BriefingPage } from './menu.ts';
import { gamesHint, levelTag, type XpStatus } from '../games/room';
import { GAMES, type Game } from '../games/index';
import './common.css';
import './menu.css';

function SourceChip({ view }: { view: GalaxyView }) {
  return view.source === 'supabase'
    ? <span className="source live">● SUPABASE LEDGER</span>
    : <span className="source">DEMO LEDGER · FICTIONAL DATA</span>;
}

// ── Menu ─────────────────────────────────────────────────────────────────────

export type MenuId = 'map' | 'chart' | 'fleets' | 'heroes' | 'games' | 'briefing' | 'myhero' | 'change' | 'play' | 'app' | 'signout';
/** A row of the menu. `tag` is the small label beside it: NEW on GAMES until the room is seen. */
export interface MenuItem { id: MenuId; label: string; scene?: SceneName; fresh?: boolean; tag?: 'NEW' }

const GALAXY: MenuItem[] = [
  { id: 'map', label: 'GALAXY MAP', scene: 'map' },
  { id: 'chart', label: 'STAR CHART', scene: 'chart' },
  { id: 'fleets', label: 'FLEETS', scene: 'fleets' },
  { id: 'heroes', label: 'HALL OF HEROES', scene: 'heroes' },
];
const BRIEFING: MenuItem = { id: 'briefing', label: 'HOW TO PLAY', scene: 'briefing' };
/** Leaves the game for the app (PRD 238), after OPEN THE APP? (leave.ts): it opens no scene. */
const APP: MenuItem = { id: 'app', label: 'APP MODE' };

/**
 * The menu for who is at the cabinet: the galaxy and the game room for everyone signed in; then, for
 * a player (`joined`: they have a player row, in a fleet or solo), MY HERO and their fleet: CHANGE
 * FLEET, or JOIN A FLEET for a `solo` one, and neither when the workspace has no `fleets`; for a
 * visitor with no player row yet, the way to play. `newGames`: the game room was never opened on this
 * device, and GAMES carries a NEW tag. `app`: the arcade has an app to leave for (not in the
 * single-file artifact), and APP MODE stands just above SIGN OUT, since both leave the game.
 */
export function menuItems({ joined, signedIn, newGames = false, app = false, solo = false, fleets = true }: {
  joined: boolean; signedIn: boolean; newGames?: boolean; app?: boolean; solo?: boolean; fleets?: boolean;
}): MenuItem[] {
  const change: MenuItem = { id: 'change', label: solo ? 'JOIN A FLEET' : 'CHANGE FLEET', fresh: true };
  const games: MenuItem = { id: 'games', label: 'GAMES', scene: 'games', ...(newGames ? { tag: 'NEW' as const } : {}) };
  return [
    ...(signedIn && !joined ? [{ id: 'play', label: 'PLAY', fresh: true }] as MenuItem[] : []),
    ...GALAXY,
    ...(signedIn ? [games] : []),
    BRIEFING,
    ...(signedIn && joined ? [{ id: 'myhero', label: 'MY HERO', fresh: true }] as MenuItem[] : []),
    ...(signedIn && joined && fleets ? [change] : []),
    ...(app ? [APP] : []),
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

/** The level on a player's badge, when they have one: `P1 INKY · OCTOPOD · LV 3`. */
export function badgeOf(me: Player, xp: XpStatus): string {
  const tag = levelTag(xp);
  return `P1 ${me.display_name} · ${crewLook(me.team).label}${tag ? ` · ${tag}` : ''}`;
}

/** XP nobody read: no level shows, and the arcade never guesses one. */
const UNKNOWN_XP: XpStatus = { kind: 'unreadable' };

export function MenuOverlay({ view, items, index, me, onPick, chart = null, xp = UNKNOWN_XP }: {
  view: GalaxyView | null; items: MenuItem[]; index: number; me: Player | null; onPick: (i: number) => void; chart?: ChartSource;
  /** The player's XP, for GAMES's hint and the level on their badge. */
  xp?: XpStatus;
}) {
  const hint: Record<MenuId, string> = {
    map: view ? `${view.totals.planets} planets · ${view.totals.inDistress} in distress` : 'Out of reach',
    chart: chart === 'none' ? 'NOT IN THIS BUILD' : chart ? chartTally(chart) : 'OUT OF REACH',
    fleets: !view ? 'Out of reach' : view.teams.length ? `${view.teams.length} fleets · ${fleet(view.teams[0]!.name).label} lead` : 'No fleets yet',
    heroes: view ? `${view.heroes.length} heroes scored in ${view.season}` : 'Out of reach',
    games: gamesHint(xp),
    briefing: 'How points are won and lost',
    myhero: 'Your name and your look',
    change: me && !me.team ? 'Pick a fleet: your future points follow you' : 'Your future points follow you',
    play: 'Build your hero: your pull requests score',
    app: 'Leave the game for the app',
    signout: 'Back to the title',
  };
  const f = crewLook(me?.team);
  return (
    <div className={`menu${items.length > 4 ? ' long' : ''}`}>
      <h2>SELECT MODE</h2>
      {me
        ? <span className="j-badge" style={{ ['--fc' as string]: f.color }}>{badgeOf(me, xp)}</span>
        : <span className="j-badge" style={{ ['--fc' as string]: '#8a90d6' }}>VISITOR</span>}
      <ul>
        {items.map((m, i) => (
          <li key={m.id}>
            <button type="button" className={`${i === index ? 'active' : ''}${m.id === 'play' ? ' nudge' : ''}`} onClick={() => onPick(i)}>
              <span className="cursor" aria-hidden="true">{i === index ? '▶' : ''}</span>
              <span className="menu-label">{m.label}{m.tag && <i className="menu-tag">{m.tag}</i>}</span>
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

/** The personal credits XP counts, by their key in the rulebook's `xp.weights`, as How to play names them. */
const XP_CREDITS: Record<keyof XpRules['weights'], string> = {
  zoneSecured: 'ZONE SECURED',
  woundClosed: 'ENTROPY CLEARED',
  rescue: 'RESCUE',
  expedition: 'EXPEDITION BONUS',
  closer: 'CLOSER BONUS',
};

/** How many of the curve's first levels LEVELS shows (fewer when the cap comes sooner). */
const CURVE_SHOWN = 5;

/**
 * What LEVELS shows, every number from the `xp` block it is given: each personal credit's weight
 * (0 leaves it out), the XP each of the curve's first levels is reached at, the cap, and the level
 * each game in `unlocks` opens at, lowest first, named by the game room's registry.
 */
function briefingLevels(xp: XpRules, games: readonly Game[] = GAMES) {
  const titleOf = (id: string) => games.find((g) => g.id === id)?.title ?? id.replace(/-/g, ' ').toUpperCase();
  return {
    credits: (Object.keys(XP_CREDITS) as (keyof XpRules['weights'])[]).map((kind) => ({ kind, label: XP_CREDITS[kind], weight: xp.weights[kind] ?? 0 })),
    curve: Array.from({ length: Math.min(CURVE_SHOWN, xp.cap) }, (_, i) => ({ level: i + 1, xp: xpForLevel(i + 1, xp) })),
    cap: xp.cap,
    unlocks: Object.entries(xp.unlocks).map(([id, level]) => ({ id, title: titleOf(id), level })).sort((a, b) => a.level - b.level),
  };
}

/** An XP total as LEVELS prints it, its thousands grouped: 2,250. */
const xpText = (n: number) => n.toLocaleString('en-US');

/**
 * How points are won and lost, and the levels XP reaches, from the rules the galaxy carries. The
 * wide grid lays the three sections out on one page; the tall one shows a section a page, which
 * ◀ ▶ turn (`BRIEFING_PAGES`).
 */
export function BriefingOverlay({ view }: { view: GalaxyView }) {
  const { grid, page } = useScreen();
  const r = view.rules;
  const kinds = Object.keys(WOUND_LOOK) as WoundKind[];
  const lv = briefingLevels(r.xp);
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
    levels: (
      <section key="levels" className="brief-levels">
        <h3>LEVELS · XP NEVER RESETS</h3>
        <div className="lv-blocks">
          <div className="lv-credits">
            <h4>XP PER POINT</h4>
            <ul>
              {lv.credits.map((c) => <li key={c.kind}>{c.label} <b>{c.weight ? `×${c.weight}` : 'NOT COUNTED'}</b></li>)}
            </ul>
          </div>
          <div className="lv-curve">
            <h4>XP TO REACH</h4>
            <ol>
              {lv.curve.map((c) => <li key={c.level}>{`LV ${c.level}`} <b>{xpText(c.xp)}</b></li>)}
            </ol>
          </div>
          <div className="lv-games">
            <h4>UNLOCKS</h4>
            <ul>
              {lv.unlocks.map((u) => <li key={u.id}>{u.title} <b>{`LV ${u.level}`}</b></li>)}
            </ul>
            <p className="note">{`UP TO LV ${lv.cap} · EVERY SEASON ADDS UP · A REVERT TAKES NO XP BACK`}</p>
          </div>
        </div>
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
        {tall ? sections[BRIEFING_PAGES[at]!] : BRIEFING_PAGES.map((p) => sections[p])}
      </div>
      <p className="hint">RUN /omni-yolo &lt;prd&gt; TO LEND YOUR AGENT TO A PLANET · B · MENU</p>
    </div>
  );
}

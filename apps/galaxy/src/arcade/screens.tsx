'use client';
import type { GalaxyView, Planet, WoundKind } from '@omni/galaxy';
import { woundTint } from '@omni/sprites';
import { FleetSprite, HeroSprite, Sprite } from './Sprite';
import { age, fleet, ordinal, ROMAN, shortDate, STATE_LOOK, WOUND_LOOK } from './fleets';
import { W, type MapSlot, type SceneName } from './scenes';
import type { Player } from './types';

// ── Shared bits ──────────────────────────────────────────────────────────────

function StateChip({ planet }: { planet: Planet }) {
  const look = STATE_LOOK[planet.state];
  return <span className={`chip ${look.blink ? 'pulse' : ''}`} style={{ ['--chip' as string]: look.color }}>{look.label}</span>;
}

function Pips({ value, max = 5, label }: { value: number; max?: number; label: string }) {
  return (
    <span className="pips" role="img" aria-label={`${label} ${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < value ? `on lvl${value}` : ''} />)}
    </span>
  );
}

function Bar({ value, segments = 10, label }: { value: number; segments?: number; label: string }) {
  const on = Math.round(value * segments);
  return (
    <span className="bar" role="img" aria-label={`${label} ${Math.round(value * 100)}%`}>
      {Array.from({ length: segments }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}
    </span>
  );
}

function SourceChip({ view }: { view: GalaxyView }) {
  return view.source === 'supabase'
    ? <span className="source live">● SUPABASE LEDGER</span>
    : <span className="source">DEMO LEDGER · FICTIONAL DATA</span>;
}

const tint = (kind: WoundKind) => woundTint(kind);

// ── Boot & title ─────────────────────────────────────────────────────────────

export function BootOverlay() {
  return (
    <div className="boot">
      <p className="boot-brand">VERTUOZA</p>
      <p className="boot-presents">PRESENTS</p>
    </div>
  );
}

// The title screen cycles like an arcade attract mode: logo, the story, the high scores.
const PHASES = [['title', 14], ['story', 12], ['hiscore', 9]] as const;
const CYCLE = PHASES.reduce((n, [, s]) => n + s, 0);
export function titlePhaseAt(t: number): 'title' | 'story' | 'hiscore' {
  let k = ((t % CYCLE) + CYCLE) % CYCLE;
  for (const [name, s] of PHASES) { if (k < s) return name; k -= s; }
  return 'title';
}

const STORY = [
  'ENTROPY IS SPREADING.',
  'UNANSWERED QUESTIONS. STUCK SLICES.',
  'BUGS SHIPPED TO PRODUCTION.',
  'EVERY PRD IS A PLANET TO TERRAFORM.',
  'FIVE FLEETS. ONE COMMANDER.',
  'CLOSE THE WOUNDS. SAVE THE PLANETS.',
];

export function TitleOverlay({ view, phase, sceneT, who, signedIn }: {
  view: GalaxyView | null; phase: 'title' | 'story' | 'hiscore'; sceneT: number; who: string; signedIn: boolean;
}) {
  // Nobody gets in without signing in: until then the cabinet asks for a coin.
  const cta = signedIn ? 'PRESS START' : 'INSERT COIN';
  if (phase === 'story') {
    const into = (((sceneT % CYCLE) + CYCLE) % CYCLE) - PHASES[0][1];
    return (
      <div className="story">
        {STORY.map((line, i) => (
          <p key={line} className={into > i * 1.4 ? 'shown' : ''}>{line}</p>
        ))}
        <p className="press blink">{cta}</p>
      </div>
    );
  }
  if (phase === 'hiscore' && view) {
    return (
      <div className="attract-scores">
        <h2>HALL OF HEROES</h2>
        <ol>
          {view.heroes.slice(0, 5).map((h) => (
            <li key={h.name} className={`rank-${h.rank}`}>
              <span>{ordinal(h.rank)}</span><span>{h.name.toUpperCase()}</span><span>{h.points}</span>
            </li>
          ))}
          {!view.heroes.length && <li><span /><span>NO SCORES THIS SEASON YET</span><span /></li>}
        </ol>
        <p className="press blink">{cta}</p>
      </div>
    );
  }
  return (
    <div className="title">
      <h1 className="logo" aria-label="Omni Loop">
        <span className="logo-omni">OMNI</span>
        <span className="logo-loop">LOOP</span>
      </h1>
      <p className="tagline">TERRAFORM THE GALAXY</p>
      <p className="press blink">{cta}</p>
      <footer className="title-foot">
        <span>© 2026 VERTUOZA</span>
        <span>{who}</span>
        <span>{view ? `${view.totals.planets} PLANETS · ${view.totals.openWounds} ENTROPY` : 'SIGN IN TO SEE THE GALAXY'}</span>
      </footer>
    </div>
  );
}

// ── Menu ─────────────────────────────────────────────────────────────────────

export type MenuId = 'map' | 'fleets' | 'heroes' | 'briefing' | 'myhero' | 'change' | 'link' | 'signout';
export interface MenuItem { id: MenuId; label: string; scene?: SceneName; fresh?: boolean }

const GALAXY: MenuItem[] = [
  { id: 'map', label: 'GALAXY MAP', scene: 'map' },
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

export function MenuOverlay({ view, items, index, me, onPick }: {
  view: GalaxyView | null; items: MenuItem[]; index: number; me: Player | null; onPick: (i: number) => void;
}) {
  const hint: Record<MenuId, string> = {
    map: view ? `${view.totals.planets} planets · ${view.totals.inDistress} in distress` : 'Out of reach',
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

// ── Galaxy map ───────────────────────────────────────────────────────────────

export function MapOverlay({ view, layout, sel, onLand }: { view: GalaxyView; layout: MapSlot[]; sel: number; onLand: () => void }) {
  const p = view.planets[sel];
  const colW = W / Math.max(1, view.sectors.length);
  const slot = layout.find((s) => s.index === sel);
  return (
    <div className="map">
      <header className="hud">
        <span className="hud-season">SEASON {view.season}</span>
        <span className="hud-mid">{view.totals.terraformed}/{view.totals.planets} TERRAFORMED</span>
        <span className="hud-hi">HI {view.teams[0]?.points ?? 0}</span>
      </header>
      {view.sectors.map((s, i) => (
        <span key={s.name} className="sector-label" style={{ left: i * colW, width: colW }}>
          {s.name.toUpperCase()}
        </span>
      ))}
      {slot && p && (
        <span className="map-tag" style={{ left: slot.x, top: slot.y + slot.r + 12 }}>#{p.prd}</span>
      )}
      {p ? (
        <section className="dialog" aria-live="polite">
          <div className="dialog-row">
            <span className="dialog-prd">#{p.prd}</span>
            <span className="dialog-title">{p.title.toUpperCase()}</span>
            <StateChip planet={p} />
          </div>
          <div className="dialog-row small">
            <span className="fleet-tag" style={{ color: fleet(p.ownerTeam).color }}>
              <FleetSprite name={p.ownerTeam} scale={0.5} /> {fleet(p.ownerTeam).label}
            </span>
            <span>CLASS {ROMAN[p.class]}{p.crossSector ? ' · CROSS-SECTOR' : ''}</span>
            <span>THREAT <Pips value={p.threat} label="Threat" /></span>
            <span>ZONES {p.secured}/{p.zones.length}</span>
            <span className={p.openWounds.length ? 'warn' : ''}>ENTROPY {p.openWounds.length}</span>
          </div>
          <button type="button" className="dialog-go" onClick={onLand}>A · LAND</button>
        </section>
      ) : (
        <section className="dialog"><p className="empty">NO PLANETS CHARTED YET. OPEN A PRD ISSUE TO CHART ONE.</p></section>
      )}
    </div>
  );
}

// ── Planet ───────────────────────────────────────────────────────────────────

export const PLANET_TABS = ['STATUS', 'ZONES', 'ENTROPY', 'LOG'] as const;

function StatusTab({ p, view }: { p: Planet; view: GalaxyView }) {
  const owner = fleet(p.ownerTeam);
  const blockers = p.blockers.map((b) => view.planets.find((x) => x.prd === b));
  return (
    <dl className="stats">
      <dt>TERRAFORM</dt><dd><Bar value={p.progress} label="Terraformed" /> {Math.round(p.progress * 100)}%</dd>
      <dt>THREAT</dt><dd><Pips value={p.threat} label="Threat" /> {ROMAN[p.threat]}</dd>
      <dt>CLASS</dt><dd>{ROMAN[p.class]} · TERRAFORM BONUS ×{view.rules.classMultipliers[p.class - 1]}</dd>
      {p.crossSector && (<><dt>RING</dt><dd>CROSS-SECTOR · ×1.25</dd></>)}
      <dt>REGIONS</dt><dd className="wrap">{p.regions.length ? p.regions.join(' · ') : 'UNSURVEYED'}</dd>
      <dt>CAPTAIN</dt><dd>{p.captain ? `@${p.captain}` : '—'}</dd>
      <dt>FLEET</dt><dd style={{ color: owner.color }}><FleetSprite name={p.ownerTeam} scale={0.5} /> {owner.label}</dd>
      <dt>EXPEDITION</dt><dd>{p.expeditions.length ? p.expeditions.map((l) => `@${l}`).join(' ') : 'NONE YET'}</dd>
      {p.rescuers.length > 0 && (<><dt>RESCUERS</dt><dd>{p.rescuers.map((r) => `@${r.login}`).join(' ')}</dd></>)}
      {blockers.length > 0 && (<><dt>BLOCKED BY</dt><dd className="warn">{blockers.map((b, i) => b ? `#${b.prd} ${b.title}` : `#${p.blockers[i]}`).join(', ')}</dd></>)}
      {p.distressSince && (<><dt>DISTRESS</dt><dd className="warn pulse">SINCE {shortDate(p.distressSince)} · +{view.rules.rescue} TO ANSWER</dd></>)}
      <dt>SEASON PTS</dt><dd className="gold">{p.earned}</dd>
    </dl>
  );
}

const ZONE_ICON: Record<string, { sprite: string; label: string }> = {
  open: { sprite: 'open', label: 'OPEN' },
  claimed: { sprite: 'hammer', label: 'CLAIMED' },
  'under-fire': { sprite: 'fire', label: 'UNDER FIRE' },
  secured: { sprite: 'flag', label: 'SECURED' },
};

function ZonesTab({ p }: { p: Planet }) {
  if (!p.zones.length) {
    return <p className="empty">{p.state === 'locked' ? 'LOCKED. ZONES OPEN ONCE THE BLOCKING PLANETS ARE TERRAFORMED.' : 'NO ZONES OPEN YET. ZONES APPEAR WHEN THE FEATURE PR OPENS.'}</p>;
  }
  const waves = [...new Set(p.zones.map((z) => z.wave ?? 0))].sort((a, b) => a - b);
  return (
    <div className="zones">
      {waves.map((w) => (
        <div key={w} className="wave">
          <span className="wave-label">PHASE {w || '?'}</span>
          <div className="wave-tiles">
            {p.zones.filter((z) => (z.wave ?? 0) === w).map((z) => (
              <span key={`${z.region}:${z.id}`} className={`tile tile-${z.state}`} title={`${z.id} · ${z.region} · ${ZONE_ICON[z.state].label}${z.contributor ? ` · @${z.contributor}` : ''}`}>
                <Sprite name={ZONE_ICON[z.state].sprite} scale={1} animate={z.state !== 'secured'} />
                <span className="tile-id">{z.id}</span>
                {z.team && <span className="tile-team" style={{ background: fleet(z.team).color }} />}
              </span>
            ))}
          </div>
        </div>
      ))}
      <p className="legend">
        {Object.entries(ZONE_ICON).map(([k, v]) => <span key={k}><Sprite name={v.sprite} scale={0.5} /> {v.label}</span>)}
      </p>
      <p className="legend">SEALED ZONES APPEAR HERE WHEN THEIR BLOCKERS MERGE.</p>
    </div>
  );
}

function EntropyTab({ p, view }: { p: Planet; view: GalaxyView }) {
  if (!p.openWounds.length) return <p className="empty good">NO ENTROPY ON THE SURFACE. {p.closedWounds ? `${p.closedWounds} CLEARED.` : ''}</p>;
  return (
    <ul className="wounds">
      {p.openWounds.slice(0, 6).map((w) => (
        <li key={w.id}>
          <Sprite name="entropy" scale={1} tint={tint(w.kind)} animate />
          <span className="wound-name" style={{ color: WOUND_LOOK[w.kind].color }}>{WOUND_LOOK[w.kind].name}</span>
          <span className="wound-where">{w.region ?? ''}</span>
          <span className="wound-age">{age(w.ageHours)}</span>
          <span className="wound-cost">−{w.decayPerTranche}/{view.rules.trancheHours}H · +{view.rules.woundClose[w.kind]}</span>
        </li>
      ))}
      {p.openWounds.length > 6 && <li className="more">+{p.openWounds.length - 6} MORE</li>}
    </ul>
  );
}

function LogTab({ p }: { p: Planet }) {
  return (
    <ol className="log">
      {p.log.slice(0, 8).map((l, i) => (
        <li key={`${l.at}-${i}`}><time>{shortDate(l.at)}</time> {l.text}</li>
      ))}
    </ol>
  );
}

export function PlanetOverlay({ view, planet: p, tab, onTab }: { view: GalaxyView; planet: Planet; tab: number; onTab: (t: number) => void }) {
  return (
    <div className="planet">
      <header className="planet-head">
        <span className="dialog-prd">#{p.prd}</span>
        <h2>{p.title.toUpperCase()}</h2>
        <StateChip planet={p} />
      </header>
      <p className="planet-caption">
        {p.state === 'distress' ? 'SOS · NO CLAIM FOR 8 WORKING HOURS' : `ZONES ${p.secured}/${p.zones.length} · ENTROPY ${p.openWounds.length}`}
      </p>
      <section className="panel">
        <div className="tabs" role="tablist">
          {PLANET_TABS.map((t, i) => (
            <button key={t} type="button" role="tab" aria-selected={i === tab} className={i === tab ? 'active' : ''} onClick={() => onTab(i)}>
              {t}{t === 'ENTROPY' && p.openWounds.length ? ` ${p.openWounds.length}` : ''}
            </button>
          ))}
        </div>
        <div className="tab-body" role="tabpanel">
          {tab === 0 && <StatusTab p={p} view={view} />}
          {tab === 1 && <ZonesTab p={p} />}
          {tab === 2 && <EntropyTab p={p} view={view} />}
          {tab === 3 && <LogTab p={p} />}
        </div>
      </section>
      <footer className="hint">◀ ▶ TABS · ▲ ▼ NEXT PLANET · B MAP</footer>
    </div>
  );
}

// ── Fleets ───────────────────────────────────────────────────────────────────

export function FleetsOverlay({ view, crew, index, onPick }: { view: GalaxyView; crew: Player[]; index: number; onPick: (i: number) => void }) {
  const players = byLogin(crew);
  const nameOf = (login: string) => players.get(login.toLowerCase())?.display_name ?? `@${login}`;
  const t = view.teams[index];
  const look = fleet(t?.name);
  return (
    <div className="fleets">
      <h2>SELECT FLEET</h2>
      <div className="cards">
        {view.teams.map((team, i) => {
          const f = fleet(team.name);
          return (
            <button key={team.name} type="button" className={`card ${i === index ? 'active' : ''}`} style={{ ['--fleet' as string]: f.color }} onClick={() => onPick(i)}>
              <span className="card-rank">{ordinal(team.rank)}</span>
              <span className="card-art"><FleetSprite name={team.name} scale={f.sprite.startsWith('hero') ? 4 / 3 : 2} animate={i === index} /></span>
              <span className="card-name">{f.label}</span>
              <span className="card-pts">{team.points}</span>
            </button>
          );
        })}
      </div>
      {t && (
        <section className="fleet-detail" style={{ ['--fleet' as string]: look.color }}>
          <p className="fleet-motto">{look.motto}</p>
          <dl>
            <dt>HOME</dt><dd>{t.home ? t.home.toUpperCase() : 'NONE YET'}</dd>
            <dt>PLANETS</dt><dd>{t.planets} OWNED · {t.terraformed} DONE</dd>
            <dt>STREAK</dt><dd>{t.streak}</dd>
            <dt>DISTRESS</dt><dd className={t.inDistress ? 'warn' : ''}>{t.inDistress}</dd>
            <dt>ENTROPY</dt><dd className={t.openWounds ? 'warn' : ''}>{t.openWounds}</dd>
            <dt className="crew-dt">CREW</dt><dd className="crew">{t.members.length ? t.members.map(nameOf).join(' ') : '—'}</dd>
          </dl>
          <p className="hint">A · SHOW THEIR PLANETS · B · MENU</p>
        </section>
      )}
    </div>
  );
}

// ── Hall of Heroes ───────────────────────────────────────────────────────────

const byLogin = (crew: Player[]) => new Map(crew.filter((p) => p.github_login).map((p) => [p.github_login!.toLowerCase(), p]));

export function HeroesOverlay({ view, crew }: { view: GalaxyView; crew: Player[] }) {
  const players = byLogin(crew);
  return (
    <div className="heroes">
      <h2>HALL OF HEROES</h2>
      <p className="heroes-season">SEASON {view.season}</p>
      <table>
        <thead><tr><th>RANK</th><th>HERO</th><th>FLEET</th><th>SCORE</th></tr></thead>
        <tbody>
          {view.heroes.slice(0, 8).map((h) => (
            <tr key={h.name} className={`rank-${h.rank}`}>
              <td>{ordinal(h.rank)}</td>
              <td>{(() => {
                const p = players.get(h.name.toLowerCase());
                return p
                  ? <span className="hero-cell"><HeroSprite hero={p.hero} team={p.team} scale={0.5} title={`${p.display_name}'s hero`} /> {p.display_name}</span>
                  : h.name.toUpperCase();
              })()}</td>
              <td style={{ color: fleet(h.team).color }}><FleetSprite name={h.team} scale={0.5} /> {fleet(h.team).label}</td>
              <td>{h.points}</td>
            </tr>
          ))}
          {!view.heroes.length && <tr><td colSpan={4}>NO SCORES THIS SEASON YET</td></tr>}
        </tbody>
      </table>
      <p className="hint">TOP FLEETS · {view.teams.slice(0, 3).map((t) => `${fleet(t.name).label} ${t.points}`).join(' · ')}</p>
    </div>
  );
}

// ── How to play ──────────────────────────────────────────────────────────────

export function BriefingOverlay({ view }: { view: GalaxyView }) {
  const r = view.rules;
  const kinds = Object.keys(WOUND_LOOK) as WoundKind[];
  return (
    <div className="briefing">
      <h2>HOW TO PLAY</h2>
      <div className="brief-cols">
        <section>
          <h3 className="gold">EARN</h3>
          <ul>
            <li><Sprite name="flag" scale={1} /> SECURE A ZONE <b>+{r.zoneSecured}</b></li>
            <li><Sprite name="beacon" scale={1} /> RESCUE ANOTHER FLEET <b>+{r.rescue}</b></li>
            <li><Sprite name="star" scale={1} /> FLEET TERRAFORMS <b>+{r.terraformOwner} × CLASS</b></li>
            <li><Sprite name="ship" scale={1} /> EXPEDITION ON IT <b>+{r.terraformExpedition}</b></li>
            <li className="note">ZONE SECURED AT NIGHT ×{r.nightShiftMultiplier} · ENTROPY CLEARED FOR ANOTHER FLEET ×{r.crossTeamMultiplier}</li>
          </ul>
        </section>
        <section>
          <h3 className="red">ENTROPY · CLEAR IT / IT COSTS</h3>
          <ul>
            {kinds.map((k) => (
              <li key={k}>
                <Sprite name="entropy" scale={0.5} tint={tint(k)} />
                <span style={{ color: WOUND_LOOK[k].color }}>{WOUND_LOOK[k].name}</span>
                <b>+{r.woundClose[k]} / −{r.decayPerTranche[k]}</b>
              </li>
            ))}
            <li className="note">DECAY PER {r.trancheHours} WORKING HOURS · LOST AFTER {r.lostAfterDays} SILENT DAYS</li>
          </ul>
        </section>
      </div>
      <p className="hint">RUN /omni-yolo &lt;prd&gt; TO LEND YOUR AGENT TO A PLANET · B · MENU</p>
    </div>
  );
}

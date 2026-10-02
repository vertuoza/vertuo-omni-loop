'use client';
// The planet's text layer: its header and caption, and the panel of five tabs (status, zones,
// Entropy, log, and its PRD's dossier). On the wide grid the panel stands beside the planet; on the
// tall grid it runs across the screen under the band the header and the planet share (TALL_BAND in
// planet.ts), with the same rows.
import { defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { GalaxyView, Planet } from '@omni/galaxy';
import { woundTint } from '@omni/design';
import { FleetSprite, Sprite } from '../Sprite';
import { useScreen } from '../Screen';
import { Hint } from '../hint';
import { age, fleet, ROMAN, shortDate, WOUND_LOOK } from '../fleets';
import type { DossierArtifactKind, DossiersRead, PlanetDossier } from '../types';
import { Pips, StateChip } from './common.tsx';
import { TALL_BAND } from './planet.ts';
import './common.css';
import './planet.css';
import { cssVars } from '../css-vars';

function Bar({ value, segments = 10, label }: { value: number; segments?: number; label: string }) {
  const on = Math.round(value * segments);
  return (
    <span className="bar" role="img" aria-label={`${label} ${Math.round(value * 100)}%`}>
      {Array.from({ length: segments }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}
    </span>
  );
}

export const PLANET_TABS = ['STATUS', 'ZONES', 'ENTROPY', 'LOG', 'DOSSIER'] as const;

/** The DOSSIER tab's place among the tabs: the last, after LOG. */
export const DOSSIER_TAB: number = PLANET_TABS.indexOf('DOSSIER');

/** What a planet's DOSSIER tab shows: its dossier, none yet, or out of reach. */
export type DossierShown = PlanetDossier | 'none' | 'unreadable';

/** A planet as a dossier lookup names it: its number, and its home when it has one (PRD 728). */
export type PlanetRef = number | Pick<Planet, 'prd' | 'home' | 'key'>;

/**
 * The planet's dossier among those the page read: 'unreadable' when it, or every dossier, could not be
 * read; 'none' when it has none (or nothing was read: a page that says nothing of dossiers).
 *
 * A dossier is found by the planet's key, `<home>#<n>` (PRD 728). One kept by its number alone is the
 * planet's only when no other planet among `planets` holds that number: two repositories' PRD 88 never
 * share a dossier.
 */
export function dossierOf(dossiers: DossiersRead | undefined, planet: PlanetRef, planets: readonly Pick<Planet, 'prd' | 'key'>[] = []): DossierShown {
  if (dossiers === 'unreadable') return 'unreadable';
  const p = typeof planet === 'number' ? { prd: planet, home: null, key: String(planet) } : planet;
  const byKey = p.home ? dossiers?.[p.key] : undefined;
  if (byKey) return byKey;
  const twin = planets.some((o) => o.prd === p.prd && o.key !== p.key);
  return (twin ? undefined : dossiers?.[p.prd]) ?? 'none';
}

/**
 * The page START opens from the planet on `tab`: its dossier's `/prd/<id>`, on the DOSSIER tab only,
 * and only for a dossier with a page to open. Null otherwise, and START goes back to the map as it does
 * on every other tab.
 */
export function dossierLink(dossiers: DossiersRead | undefined, planet: PlanetRef, tab: number, planets: readonly Pick<Planet, 'prd' | 'key'>[] = []): string | null {
  if (tab !== DOSSIER_TAB) return null;
  const d = dossierOf(dossiers, planet, planets);
  return typeof d === 'object' ? d.url : null;
}

/** One line of the status tab: its label and its value. */
export interface StatusRow {
  label: string;
  value: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** On the tall grid, shares the line of the row before it. */
  pair?: true;
}

/** Everything the status tab says about a planet, in order: the same rows on either grid. */
export function statusRows(p: Planet, view: GalaxyView): StatusRow[] {
  const owner = fleet(p.ownerTeam);
  // A blocker is a PRD of the planet's own home (PRD 728): never a twin of another repository.
  const blockers = p.blockers.map((b) => view.planets.find((x) => x.prd === b && x.home === p.home));
  const rows: (StatusRow | false)[] = [
    { label: 'TERRAFORM', value: <><Bar value={p.progress} label="Terraformed" /> {Math.round(p.progress * 100)}%</> },
    { label: 'THREAT', value: <><Pips value={p.threat} label="Threat" /> {ROMAN[p.threat]}</> },
    { label: 'CLASS', value: <>{ROMAN[p.class]} · TERRAFORM BONUS ×{view.rules.classMultipliers[p.class - 1]}</> },
    p.crossSector && { label: 'RING', value: 'CROSS-SECTOR · ×1.25' },
    { label: 'REGIONS', value: p.regions.length ? p.regions.join(' · ') : 'UNSURVEYED', className: 'wrap' },
    { label: 'CAPTAIN', value: p.captain ? `@${p.captain}` : '—' },
    { label: 'FLEET', value: <><FleetSprite name={p.ownerTeam} scale={0.5} /> {owner.label}</>, style: { color: owner.color }, pair: true },
    { label: 'EXPEDITION', value: p.expeditions.length ? p.expeditions.map((l) => `@${l}`).join(' ') : 'NONE YET' },
    p.rescuers.length > 0 && { label: 'RESCUERS', value: p.rescuers.map((r) => `@${r.login}`).join(' ') },
    blockers.length > 0 && { label: 'BLOCKED BY', value: blockers.map((b, i) => b ? `#${b.prd} ${b.title}` : `#${p.blockers[i]}`).join(', '), className: 'warn' },
    !!p.distressSince && { label: 'DISTRESS', value: <>SINCE {shortDate(p.distressSince)} · +{view.rules.rescue} TO ANSWER</>, className: 'warn pulse' },
    { label: 'SEASON PTS', value: p.earned, className: 'gold' },
  ];
  return rows.filter((r): r is StatusRow => Boolean(r));
}

function StatusTab({ p, view }: { p: Planet; view: GalaxyView }) {
  const tall = useScreen().grid.name === 'tall';
  const rows = statusRows(p, view);
  // On the tall grid a paired row shares its line with the row before it (planet.css places them).
  const paired = (i: number) => (tall && defined(rows[i], 'a status row').pair ? 'pair' : tall && rows[i + 1]?.pair ? 'before-pair' : '');
  return (
    <dl className="stats">
      {rows.map((r, i) => (
        <Fragment key={r.label}>
          <dt className={paired(i) === 'pair' ? 'pair' : undefined}>{r.label}</dt>
          <dd className={[r.className, paired(i)].filter(Boolean).join(' ') || undefined} style={r.style}>{r.value}</dd>
        </Fragment>
      ))}
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
              <span key={`${z.region}:${z.id}`} className={`tile tile-${z.state}`} title={`${z.id} · ${z.region} · ${defined(ZONE_ICON[z.state], `the ${z.state} zone icon`).label}${z.contributor ? ` · @${z.contributor}` : ''}`}>
                <Sprite name={defined(ZONE_ICON[z.state], `the ${z.state} zone icon`).sprite} scale={1} animate={z.state !== 'secured'} />
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
          <Sprite name="entropy" scale={1} tint={woundTint(w.kind)} animate />
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

/** The artifacts, in the order the page to share shows them. */
const ARTIFACTS: ReadonlyArray<readonly [DossierArtifactKind, string]> = [['before-after', 'BEFORE/AFTER'], ['spec', 'SPEC'], ['plan', 'PLAN']];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** `24 SEP`, in UTC, as the page to share dates its versions: the same on the server and in any browser. */
function day(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * The PRD's dossier, summarised (PRD 216): each artifact's latest version and date, the rounds asked
 * and answered, and the last three answered, each question with its answer on one line. START opens the
 * page to share in a new tab; the hint is a button too. Reading a spec in pixel type would help nobody.
 */
function DossierTab({ dossier }: { dossier: DossierShown }) {
  if (dossier === 'unreadable') return <p className="empty">DOSSIERS OUT OF REACH</p>;
  if (dossier === 'none') return <p className="empty">NO DOSSIER YET. ONE OPENS WITH THE PRD&apos;S BRAINSTORM.</p>;
  return (
    <div className="dossier">
      <dl className="dossier-rows">
        {ARTIFACTS.map(([kind, label]) => {
          const v = dossier.latest[kind];
          return (
            <Fragment key={kind}>
              <dt>{label}</dt>
              <dd className={v ? undefined : 'none'}>{v ? `V${v.version} · ${day(v.at)}` : 'NONE YET'}</dd>
            </Fragment>
          );
        })}
        <dt>QUESTIONS</dt>
        <dd>{`${dossier.asked} ASKED · ${dossier.answered} ANSWERED`}</dd>
      </dl>
      <p className="dossier-label">LAST ANSWERS</p>
      {dossier.last.length ? (
        <ol className="dossier-last">
          {dossier.last.map((a, i) => (
            <li key={`${a.at}-${i}`} className="dossier-answer" title={`${a.question} → ${a.answer}`}>
              <span className="dossier-q">{a.question}</span>
              <span className="dossier-a">{a.answer}</span>
              {a.more > 0 && <span className="dossier-more">{`+${a.more}`}</span>}
            </li>
          ))}
        </ol>
      ) : <p className="dossier-none">NO ANSWER YET</p>}
      {dossier.url && <p className="dossier-open"><Hint k="START">OPEN</Hint></p>}
    </div>
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

export function PlanetOverlay({ view, planet: p, tab, onTab, dossier }: {
  view: GalaxyView; planet: Planet; tab: number; onTab: (t: number) => void; dossier: DossierShown;
}) {
  const { grid } = useScreen();
  return (
    <div className="planet" style={grid.name === 'tall' ? cssVars({ '--band': `${TALL_BAND}px` }) : undefined}>
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
            // No focus on click, as a key hint: Enter keeps meaning START (which opens the dossier's page).
            <button key={t} type="button" role="tab" aria-selected={i === tab} className={i === tab ? 'active' : ''} onMouseDown={(e) => { e.preventDefault(); }} onClick={() => { onTab(i); }}>
              {t}{t === 'ENTROPY' && p.openWounds.length ? ` ${p.openWounds.length}` : ''}
            </button>
          ))}
        </div>
        <div className="tab-body" role="tabpanel">
          {tab === 0 && <StatusTab p={p} view={view} />}
          {tab === 1 && <ZonesTab p={p} />}
          {tab === 2 && <EntropyTab p={p} view={view} />}
          {tab === 3 && <LogTab p={p} />}
          {tab === DOSSIER_TAB && <DossierTab dossier={dossier} />}
        </div>
      </section>
      <footer className="hint">◀ ▶ TABS · ▲ ▼ NEXT PLANET · B MAP</footer>
    </div>
  );
}

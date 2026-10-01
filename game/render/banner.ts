// The text block /omni-yolo prints (spec §7.4). Reads state; decides nothing.
import { tranchesBetween } from '../calendar.ts';
import type { Credit, DerivedPlanet } from '../types.ts';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const ICON: Readonly<Record<string, string>> = { transmission: '📡', 'unconfirmed-ground': '🟧', beacon: '🟥', 'fault-line': '⚡', 'under-fire': '🔥', aftershock: '⚡' };
const STATE: Readonly<Record<string, string>> = { distress: '📡 DISTRESS', 'awaiting-command': '🛡 AWAITING COMMAND', terraformed: '✅ TERRAFORMED', aftershock: '⚡ AFTERSHOCK', lost: '💀 LOST', locked: '🌑 LOCKED', charted: '🪐 CHARTED', decommissioned: '⚪ DECOMMISSIONED' };

// A wound kind's icon; none for a kind the banner does not know.
const iconOf = (kind: string | undefined): string | undefined => (kind === undefined ? undefined : ICON[kind]);

// The owning fleet's streak this season, or nothing.
const streakOf = (streaks: Readonly<Record<string, number>> | undefined, team: string | null): string => {
  const streak = team === null ? undefined : streaks?.[team];
  return streak ? ` 🔥${streak}` : '';
};

function workingHours(fromIso: string | null | undefined, now: Date): number {
  // As `new Date` reads them: null is the epoch, undefined an invalid date.
  return tranchesBetween(fromIso === null ? new Date(0) : new Date(fromIso ?? Number.NaN), now, 60);
}

export function renderBanner(
  p: DerivedPlanet,
  { season, now }: { season: { credits?: readonly Credit[]; streaks?: Readonly<Record<string, number>> }; now: Date },
): string {
  const secured = p.zones.filter((z) => z.state === 'secured').length;
  const phases = Math.max(0, ...p.zones.map((z) => z.wave));
  // The phase is one past the highest wave whose every zone is secured, capped at the last wave.
  const wavesDone = [...new Set(p.zones.map((z) => z.wave))].filter((w) => p.zones.filter((z) => z.wave === w).every((z) => z.state === 'secured'));
  const phase = Math.min(phases, 1 + (wavesDone.length ? Math.max(...wavesDone) : 0));
  const perRegion = p.regions.map((r) => `${r} ${p.zones.filter((z) => z.repo === r && z.state === 'secured').length}/${p.zones.filter((z) => z.repo === r).length}`).join(' · ');
  const open = p.wounds.filter((w) => !w.closedAt);
  const byKind = [...new Set(open.map((w) => w.kind))].map((k) => {
    const ws = open.filter((w) => w.kind === k);
    const oldest = ws.map((w) => w.openedAt).sort()[0];
    return `${ws.length} ${iconOf(k)} (${workingHours(oldest, now)}h)`;
  });
  const expedition = [...new Set(p.zones.map((z) => z.author).filter(Boolean))];
  // Rescuers (spec §5.6) are read from the season's credits, never re-derived: a paid rescue, or a
  // wound closure the economy marked crossTeam. Teams in order of first credit.
  const rescueCredits = (season.credits ?? []).filter((c) => c.planet === p.prd && c.to && (c.reason === 'rescue' || c.crossTeam));
  const rescuers = new Set(rescueCredits.map((c) => c.to)).size;
  const rescuerTeams = [...new Set(rescueCredits.map((c) => c.team).filter(Boolean))];
  const streak = streakOf(season.streaks, p.ownerTeam);
  const stateTag = STATE[p.state] ? ` · ${STATE[p.state]}` : '';
  const openZones = p.zones.filter((z) => z.state === 'open').map((z) => `${z.id} (${z.repo}, phase ${z.wave})`);
  // Spec §8: a planet whose captain has no team has no owning team; the banner flags it uncrewed
  // whenever either the captain or the owning team is missing.
  const uncrewed = !p.captain || !p.ownerTeam;
  const captainSeg = p.captain ? `@${p.captain}` : 'none';
  const crewSeg = `${p.ownerTeam ?? 'none'}${streak}${uncrewed ? ' (uncrewed)' : ''}`;
  return [
    `OMNI PLAN // PLANET ${p.prd} — ${p.title}`,
    `Class ${ROMAN[Math.min(p.class, 4)] || '?'}${p.crossSector ? ' ★ cross-sector' : ''} · Threat ${ROMAN[p.threat]}${stateTag} · phase ${phase}/${phases} · zones ${secured}/${p.zones.length} secured${perRegion ? ` (${perRegion})` : ''}`,
    `Wounds: ${byKind.length ? byKind.join(' · ') : 'none'}`,
    `Captain: ${captainSeg} · Crew: ${crewSeg} · Expeditions: ${expedition.length}${expedition.length ? ` (${expedition.join(', ')})` : ''} · Rescuers: ${rescuers}${rescuerTeams.length ? ` (${rescuerTeams.join(', ')})` : ''}`,
    `Open zones: ${openZones.length ? openZones.join(', ') : 'none'}`,
  ].join('\n');
}

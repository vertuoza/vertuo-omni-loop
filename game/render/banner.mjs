// The text block /omni-yolo prints (spec §7.4). Reads state; decides nothing.
import { tranchesBetween } from '../calendar.mjs';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const ICON = { transmission: '📡', 'unconfirmed-ground': '🟧', beacon: '🟥', 'fault-line': '⚡', 'under-fire': '🔥', aftershock: '⚡' };
const STATE = { distress: '📡 DISTRESS', 'awaiting-command': '🛡 AWAITING COMMAND', terraformed: '✅ TERRAFORMED', aftershock: '⚡ AFTERSHOCK', lost: '💀 LOST', locked: '🌑 LOCKED', charted: '🪐 CHARTED', decommissioned: '⚪ DECOMMISSIONED' };

function workingHours(fromIso, now) {
  return tranchesBetween(new Date(fromIso), now, 60);
}

export function renderBanner(p, { season, now }) {
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
    return `${ws.length} ${ICON[k]} (${workingHours(oldest, now)}h)`;
  });
  const expedition = [...new Set(p.zones.map((z) => z.author).filter(Boolean))];
  // Rescues are ledger facts; the banner reads them from the season, never re-derives them.
  const rescuers = new Set((season.credits ?? []).filter((c) => c.planet === p.prd && c.reason === 'rescue').map((c) => c.to)).size;
  const streak = season.streaks?.[p.ownerTeam] ? ` 🔥${season.streaks[p.ownerTeam]}` : '';
  const stateTag = STATE[p.state] ? ` · ${STATE[p.state]}` : '';
  const openZones = p.zones.filter((z) => z.state === 'open').map((z) => `${z.id} (${z.repo}, phase ${z.wave})`);
  return [
    `OMNI PLAN // PLANET ${p.prd} — ${p.title}`,
    `Class ${ROMAN[Math.min(p.class, 4)] || '?'}${p.crossSector ? ' ★ cross-sector' : ''} · Threat ${ROMAN[p.threat]}${stateTag} · phase ${phase}/${phases} · zones ${secured}/${p.zones.length} secured${perRegion ? ` (${perRegion})` : ''}`,
    `Wounds: ${byKind.length ? byKind.join(' · ') : 'none'}`,
    `Captain: ${p.captain ? '@' + p.captain : 'none (uncrewed)'} · Crew: ${p.ownerTeam ?? 'none'}${streak} · Expeditions: ${expedition.length}${expedition.length ? ` (${expedition.join(', ')})` : ''} · Rescuers: ${rescuers}`,
    `Open zones: ${openZones.length ? openZones.join(', ') : 'none'}`,
  ].join('\n');
}

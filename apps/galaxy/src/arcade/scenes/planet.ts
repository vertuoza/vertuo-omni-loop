// The planet on the canvas: the planet with its Entropy in orbit and its fleets on station.
import { drawPlanet, drawSprite, spriteSize, woundTint } from '@omni/sprites';
import type { Planet } from '@omni/galaxy';
import { fleet } from '../fleets';
import { frameOf, nebulaFor, planetLook, pulseRing, space, type FrameState } from './common.ts';

export function drawPlanetScene(ctx: CanvasRenderingContext2D, s: FrameState) {
  const p = s.view?.planets[s.sel];
  if (!p) return;
  const shake = p.state === 'aftershock' && !s.reduced && s.sceneT % 3 < 0.35 ? Math.round(Math.sin(s.t * 60) * 3) : 0;
  ctx.save();
  ctx.translate(shake, 0);
  space(ctx, s, 0.3);
  ctx.drawImage(nebulaFor('planet', 0, 360, 300), -40, 40);
  const cx = 176, cy = 204, r = 92;
  const look = planetLook(p);
  const rot = s.reduced ? 1 : s.t * 0.05 + (look.seed % 7);
  // Entropy units orbit on an ellipse: behind the planet first, then in front.
  const units = p.openWounds.slice(0, 8).map((w, i, arr) => ({ w, i, a: s.t * 0.4 + (i / arr.length) * Math.PI * 2 }));
  const orbit = (a: number) => ({ x: cx + Math.cos(a) * (r + 34) - 12, y: cy + Math.sin(a) * 30 - 12 });
  const drawUnit = ({ w, i, a }: { w: Planet['openWounds'][number]; i: number; a: number }) => {
    const o = orbit(a);
    drawSprite(ctx, 'entropy', o.x, o.y + (s.reduced ? 0 : Math.round(Math.sin(s.t * 4 + a) * 2)), { tint: woundTint(w.kind), frame: frameOf(s, 3, i * 0.4) });
  };
  units.filter((u) => Math.sin(u.a) < 0).forEach(drawUnit);
  if (p.state === 'distress' && !s.reduced) { pulseRing(ctx, cx, cy, r, s.t, '#ff3b5c'); pulseRing(ctx, cx, cy, r, s.t + 0.6, '#ff3b5c'); }
  ctx.globalAlpha = look.mood === 'ghost' ? 0.55 : 1;
  drawPlanet(ctx, { cx, cy, r, rot, ...look });
  ctx.globalAlpha = 1;
  units.filter((u) => Math.sin(u.a) >= 0).forEach(drawUnit);
  // Fleets on station: the hero of every fleet with a zone claimed or secured here.
  const teams = [...new Set(p.zones.map((z) => z.team).filter((t): t is string => Boolean(t)))];
  teams.slice(0, 5).forEach((team, i) => {
    const a = -s.t * 0.35 + (i / Math.max(1, teams.length)) * Math.PI * 2;
    const x = cx + Math.cos(a) * (r + 56), y = cy - 8 + Math.sin(a) * 68;
    const f = fleet(team);
    const { w, h } = spriteSize(f.sprite);
    drawSprite(ctx, f.sprite, x - w / 2, y - h / 2 + (s.reduced ? 0 : Math.round(Math.sin(s.t * 3 + i) * 2)), { tint: f.tint ?? undefined, frame: frameOf(s, 2, i * 0.4), flip: Math.cos(a) > 0 });
  });
  if (p.state === 'lost') drawSprite(ctx, 'skull', cx - 16, cy - r - 44, { scale: 2 });
  if (p.state === 'locked') drawSprite(ctx, 'lock', cx - 16, cy - 16, { scale: 2 });
  if (p.state === 'terraformed' || p.state === 'awaiting-command') {
    for (let i = 0; i < 5; i++) if (Math.floor(s.t * 2 + i) % 4 === 0) drawSprite(ctx, 'star', cx - r + ((i * 71) % (r * 2)), cy - r + ((i * 103) % (r * 2)), { frame: frameOf(s, 4) });
  }
  ctx.restore();
}

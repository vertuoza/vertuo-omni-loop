// Bug 2144: COMET RING's tunnel walls hold a kart. PRD 1775 stands a wall on every edge between roofed road and the void,
// from the ground up to the roof; a kart that meets it slides along it, losing speed, and never tips over or falls under the roof.
import { describe, expect, it } from 'vitest';
import { CIRCUITS } from './circuits';
import { NO_FX, stepFx, type Fx, type Kart, type Pad } from './kart';
import { RULES } from './rules';
import { sure } from '../test/sure';
import { locatePx, parseTrack, pointAtPx, roofAt, surfaceAt, TILE } from './track';

const track = parseTrack();
const span = sure(track.span, 'the tunnel');
const GAS: Pad = { left: false, right: false, accel: true, brake: false };
const DEG = Math.PI / 180;

/** A kart at full speed on the centre line, `along` tiles into the tunnel, heading `off` radians off the line (right is positive, y down). */
function aimed(along: number, off: number): Kart {
  const p = pointAtPx(track, (span.start + along) * TILE);
  return { x: p.x, y: p.y, angle: Math.atan2(p.ty, p.tx) + off, speed: RULES.topSpeed, steer: 0 };
}

/** The kart's steps with the gas held, for `seconds`, while it is under the roof: each with the kart and its fx. */
function underRoof(start: Kart, seconds: number): { kart: Kart; fx: Fx }[] {
  const steps: { kart: Kart; fx: Fx }[] = [];
  let k = start, fx = NO_FX;
  for (let t = 0; t < seconds && roofAt(track, k.x, k.y); t += RULES.subStep) {
    ({ kart: k, fx } = stepFx(track, k, GAS, RULES.subStep, 1, fx));
    steps.push({ kart: k, fx });
  }
  return steps;
}

describe('bug 2144: the tunnel walls of COMET RING hold a kart', () => {
  // 3 tiles in, the tunnel bends left (the outer wall on the right); 8 tiles in, it runs straight to its far portal, near enough that only a steep angle meets a wall first.
  const cases: [along: number, degrees: number[]][] = [[3, [20, 30, 45, 60, 75, 90]], [8, [45, 60, 75, 90]]];
  for (const [along, degrees] of cases) {
    for (const deg of degrees) {
      for (const side of [-1, 1] as const) {
        it(`a kart ${along} tiles into the tunnel, driven ${deg}° ${side < 0 ? 'left' : 'right'} into a wall, stays on the road and never falls`, () => {
          const steps = underRoof(aimed(along, side * deg * DEG), 2);
          const off = steps.findIndex(({ kart }) => surfaceAt(track, kart.x, kart.y) === 'void');
          const fell = steps.findIndex(({ fx }) => fx.fall > 0);
          expect({ off, fell }).toEqual({ off: -1, fell: -1 });
        });
      }
    }
  }

  it('slides along the outer wall of the bend, met at 30°, losing speed, instead of stopping at it', () => {
    const start = aimed(3, 30 * DEG);
    const steps = underRoof(start, 1);
    const last = sure(steps.at(-1), 'a step');
    // It meets the wall about 30 px further along the centre line; one held there gets no further.
    expect(roofAt(track, last.kart.x, last.kart.y)).toBe(true);
    expect(locatePx(track, last.kart.x, last.kart.y).along - locatePx(track, start.x, start.y).along).toBeGreaterThan(45);
    expect(Math.min(...steps.map(({ kart }) => kart.speed))).toBeLessThan(RULES.topSpeed * 0.9);
  });
});

describe('every circuit\'s tunnel holds a kart along its whole length (bug 2144)', () => {
  for (const circuit of CIRCUITS) {
    const ground = parseTrack(circuit.source);
    if (ground.span === null) continue;
    const { start, length } = ground.span;
    it(`${circuit.name}: a kart driven into either wall, at any tile of the tunnel, stays on the road while under the roof`, () => {
      const out: string[] = [];
      for (let along = 0.5; along < length; along += 1) {
        for (const deg of [-90, -45, 45, 90]) {
          const p = pointAtPx(ground, (start + along) * TILE);
          let k: Kart = { x: p.x, y: p.y, angle: Math.atan2(p.ty, p.tx) + deg * DEG, speed: RULES.topSpeed, steer: 0 }, fx = NO_FX;
          for (let t = 0; t < 2 && roofAt(ground, k.x, k.y); t += RULES.subStep) ({ kart: k, fx } = stepFx(ground, k, GAS, RULES.subStep, 1, fx));
          if (surfaceAt(ground, k.x, k.y) === 'void' || fx.fall > 0) out.push(`${along} tiles in, ${deg}°`);
        }
      }
      expect(out).toEqual([]);
    });
  }
});

// The fleets wall on the canvas: the comic "hero select" wall the cards stand on.
import { heroSelectWall, type FrameState } from './common.ts';

export function drawFleets(ctx: CanvasRenderingContext2D, s: FrameState) {
  heroSelectWall(ctx);
}

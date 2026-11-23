// The demo's clock (#3204): what "now" is for the demo world's dates. The screenshot test
// (scripts/visual.ts) pins it with OMNI_LOOP_DEMO_NOW, so the demo PRD's dates are the same on every
// run and the shots compare with their baselines; unset, it is the real clock.
import 'server-only';
import { serverEnv } from '../env';

/** The demo's "now", in epoch ms: the pinned time when OMNI_LOOP_DEMO_NOW is set, else the real clock. */
export function demoNow(): number {
  return serverEnv().demoNow ?? Date.now();
}

import { MASCOTS } from '@omni/design';
import { DEMO_MISSIONS, DEMO_PRDS, demoFleetBoard } from '../runners/runners-view.demo';
import { aiFleetList, type ListFleetRead } from './list';
import type { AiFleetsRead } from './list.live';

// The demo's AI Fleet list (PRD 3233 s3): Orion on a mission with a Shared runner running its work, Nova on a goal-only mission with
// no runner of its own, Atlas with no mission and its only runner offline: the demo board of the runners view, so the list and the
// tests of the view agree. The demo makes no fleet: its New AI fleet drawer has no workspace.

const mission = (id: string, title: string, progress: string): ListFleetRead['missions'][number] => ({ id, title, status: 'running', progress, waits: [] });

/** The demo's three fleets, each with its look, its heroes' roles and its mission. */
const DEMO_LIST: readonly ListFleetRead[] = [
  { tag: { name: 'orion', label: 'Orion', color: '#4fb0ff', mascot: 'robot' }, roles: ['pm', 'engineer', 'qa', 'reviewer'], missions: [mission(DEMO_MISSIONS.orion, 'Checkout rework', '3 of 6 merged · 2 ready')] },
  { tag: { name: 'nova', label: 'Nova', color: '#ff9f43', mascot: 'robot' }, roles: ['pm', 'engineer', 'qa', 'reviewer'], missions: [mission(DEMO_MISSIONS.nova, 'Order export', 'Writing the roadmap')] },
  { tag: { name: 'atlas', label: 'Atlas', color: '#2fc6a4', mascot: 'robot' }, roles: ['engineer', 'reviewer'], missions: [] },
];

export function demoAiFleets(now: Date): Extract<AiFleetsRead, { kind: 'list' }> {
  return { kind: 'list', list: aiFleetList(demoFleetBoard(now), DEMO_LIST, now, DEMO_PRDS), make: { workspace: null, mascots: MASCOTS, owner: false } };
}

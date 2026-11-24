import { MASCOTS } from '@omni/design';
import { DEMO_FLEETS, DEMO_MISSIONS, DEMO_PRDS, demoFleetBoard } from '../runners/runners-view.demo';
import { aiFleetList, type ListFleetRead } from './list';
import type { AiFleetsRead } from './list.live';

// The demo's AI Fleet list (PRD 3233 s3): Orion on a mission with a Shared runner running its work, Nova on a goal-only mission with
// no runner of its own, Atlas with no mission and its only runner offline: the demo board of the runners view, so the list and the
// tests of the view agree. The demo makes no fleet: its New AI fleet drawer has no workspace.

const LOOKS: Readonly<Record<string, { color: string; mascot: string }>> = {
  orion: { color: '#4fb0ff', mascot: 'robot' }, nova: { color: '#ff9f43', mascot: 'robot' }, atlas: { color: '#2fc6a4', mascot: 'robot' },
};

const mission = (id: string, title: string, progress: string): ListFleetRead['missions'][number] => ({ id, title, status: 'running', progress, waits: [] });

export function demoAiFleets(now: Date): Extract<AiFleetsRead, { kind: 'list' }> {
  const reads: ListFleetRead[] = DEMO_FLEETS.map((fleet) => ({
    tag: { name: fleet.name, label: fleet.label, color: LOOKS[fleet.name]?.color ?? null, mascot: LOOKS[fleet.name]?.mascot ?? null },
    roles: fleet.name === 'atlas' ? ['engineer', 'reviewer'] : ['pm', 'engineer', 'qa', 'reviewer'],
    missions:
      fleet.name === 'orion' ? [mission(DEMO_MISSIONS.orion, 'Checkout rework', '3 of 6 merged · 2 ready')]
      : fleet.name === 'nova' ? [mission(DEMO_MISSIONS.nova, 'Order export', 'Writing the roadmap')]
      : [],
  }));
  return { kind: 'list', list: aiFleetList(demoFleetBoard(now), reads, now, DEMO_PRDS), make: { workspace: null, mascots: MASCOTS, owner: false } };
}

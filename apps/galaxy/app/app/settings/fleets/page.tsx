import type { Metadata } from 'next';
import '../../../../src/fleets/fleets.css';
import { viewer } from '../../../../src/data/viewer';
import { FleetsScreen, type FleetsScreenView } from '../../../../src/fleets/FleetsScreen';
import { loadFleetsPage } from '../../../../src/fleets/load';
import { MASCOTS } from '../../../../src/fleets/store';

// /app/settings/fleets (PRD 400 s3; moved from /app/fleets by PRD 572, which now redirects here): the
// workspace's fleets, under the app's shared top bar (app/app/layout.tsx).
// Its owner creates, edits, retires and restores them through the owner-only fleet functions; every
// other member reads them. Rendered per request, as the signed-in person, so row-level security
// decides what the read returns. In development (or OMNI_LOOP_DEMO=1), the demo: an owner with no
// fleet yet, whose changes stay in the page.

export const metadata: Metadata = { title: 'Fleets · OMNI LOOP' };

async function viewOf(): Promise<FleetsScreenView> {
  const seen = await viewer();
  if (seen.kind === 'demo') return { kind: 'fleets', source: { kind: 'demo' }, owner: true, fleets: [], mascots: MASCOTS };
  if (seen.kind !== 'signed-in') return { kind: seen.kind };
  const { db, user, env } = seen;
  const load = await loadFleetsPage(db, user);
  if (load.kind !== 'fleets') return load;
  return {
    kind: 'fleets', source: { kind: 'database', ...env, workspace: load.workspace.id },
    owner: load.owner, fleets: load.fleets, mascots: load.mascots,
  };
}

export default async function FleetsRoute() {
  return <FleetsScreen view={await viewOf()} />;
}

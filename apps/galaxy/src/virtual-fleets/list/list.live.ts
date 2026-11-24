import 'server-only';
import { messageOf } from 'omni-loop/kit/lib/narrow.ts';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/database.types.ts';
import { MASCOTS } from '@omni/design';
import { loadFleets } from '../../data/load-galaxy';
import { memberWorkspace } from '../../data/workspace';
import { loadMissionsTab } from '../../missions/page/missions-tab.live';
import { runnersPageReads } from '../../runners/page/live';
import { loadRunnersPage } from '../../runners/page/load';
import { heroesServiceAs } from '../heroes/heroes.live';
import { virtualFleetsServiceAs } from '../virtual-fleets.live';
import { aiFleetList, type AiFleetList, type ListFleetRead } from './list';
import type { NewFleetProps } from './AiFleetList';

// The AI Fleet list's real read (PRD 3233 s3), as the person `db` acts for: the workspace they joined first, its AI fleets, their
// heroes and missions, and the Runners board read once for every row. A fleet whose heroes or missions cannot be read still has its
// row, with none; a board that cannot be read is the page's one notice.

export type AiFleetsRead =
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | { kind: 'list'; list: AiFleetList; make: NewFleetProps };

async function soft<T>(read: () => Promise<T>, fallback: T, what: string): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error(`ai-fleet: ${what} could not be read (${messageOf(error)})`);
    return fallback;
  }
}

export async function loadAiFleets(db: SupabaseClient<Database>, user: Pick<User, 'id'>, now: Date): Promise<AiFleetsRead> {
  const workspace = await soft(() => memberWorkspace(db, user.id), null, 'your workspace');
  if (!workspace) return { kind: 'no-workspace' };
  const reads = runnersPageReads(db, user);
  if (!reads) return { kind: 'unreadable' };
  const [names, owner, looks, page] = await Promise.all([
    soft(() => virtualFleetsServiceAs(db).names(workspace.id), [] as string[], 'the AI fleets'),
    soft(() => heroesServiceAs(db).owns(workspace.id, user.id), false, 'the workspace\'s owners'),
    soft(() => loadFleets(db, workspace.id), [], 'the fleets'),
    loadRunnersPage(reads, now),
  ]);
  if (page.kind !== 'board') return { kind: 'unreadable' };
  const fleets = await Promise.all(names.map(async (name): Promise<ListFleetRead> => {
    const look = looks.find((row) => row.name === name);
    const [heroes, missions] = await Promise.all([
      soft(() => heroesServiceAs(db).heroes(workspace.id, name), [], `the heroes of ${name}`),
      soft(async () => (await loadMissionsTab(db, workspace.id, name)).missions, [], `the missions of ${name}`),
    ]);
    return { tag: { name, label: look?.label ?? name, color: look?.color ?? null, mascot: look?.mascot ?? null }, roles: heroes.map((hero) => hero.role), missions };
  }));
  return { kind: 'list', list: aiFleetList(page.board, fleets, now, page.prds), make: { workspace: workspace.id, mascots: MASCOTS, owner } };
}

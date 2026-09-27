// What /releases shows (PRD 262), by the build's mode (src/data/mode.ts):
//
// - demo (development, or a build with OMNI_LOOP_DEMO=1): the built-in sample, nothing read;
// - closed (a deployed build with no Supabase): the unavailable line;
// - supabase: public.releases, read with the publishable key and no session (../store.ts).
//
// The page is static, regenerated at most every five minutes, so a failed read has two cases. While
// the build prerenders it, nothing is behind it: the page is built with the unavailable line and the
// build goes on. After that, a good render is: the read throws, and Next keeps serving the last page
// it rendered, retrying on a later request. Either way the reason goes to the server's log only; a
// visitor never reads an error's detail.
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { arcadeMode } from '../../data/mode';
import { DEMO_RELEASES } from '../demo';
import type { ReleaseRow } from '../row';
import { readReleases, releasesEnv, type ReleasesEnv } from '../store';

export type ReleasesView =
  | { kind: 'releases'; rows: readonly ReleaseRow[] }
  | { kind: 'unavailable' };

type Env = Record<string, string | undefined>;

const UNAVAILABLE: ReleasesView = { kind: 'unavailable' };

export async function releasesView(env: Env, read: (at: ReleasesEnv) => Promise<ReleaseRow[]> = readReleases): Promise<ReleasesView> {
  const mode = arcadeMode(env);
  if (mode === 'demo') return { kind: 'releases', rows: DEMO_RELEASES };
  const at = releasesEnv(env);
  if (mode === 'closed' || !at) return UNAVAILABLE;
  try {
    return { kind: 'releases', rows: await read(at) };
  } catch (error) {
    console.error('releases: public.releases could not be read', error);
    if (env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return UNAVAILABLE;
    throw new Error('releases could not be read: the last good page stays served');
  }
}

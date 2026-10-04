import { ReleasesPage } from '../../src/releases/page/ReleasesPage';
import { releasesView } from '../../src/releases/page/source';
import { serverEnv } from '../../src/env';

// /releases (PRD 262): every release of Omni Loop, week by week, newest first, for anyone. It reads
// public.releases as nobody (the publishable key, no session, no cookie), so it is rendered once and
// regenerated in the background at most every five minutes; a failed read keeps the last good page
// (src/releases/page/source.ts). In development it shows the demo sample; closed, the unavailable line.

export const revalidate = 300;

export default async function ReleasesRoute() {
  return <ReleasesPage view={await releasesView(serverEnv())} />;
}

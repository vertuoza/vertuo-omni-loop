import { ArcadeApp } from '../src/arcade/ArcadeApp';
import { loadGalaxy } from '../src/data/load-galaxy';

// The ledger moves every 15 minutes at most (the game workflow's poll); a minute is plenty.
export const revalidate = 60;

export default async function Page() {
  const view = await loadGalaxy();
  return <ArcadeApp view={view} />;
}

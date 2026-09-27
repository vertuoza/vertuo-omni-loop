import type { Metadata } from 'next';
import { Home } from '../src/home/Home';
import { HOME_METADATA } from '../src/home/share';

// `/` is HOME, the Omni Loop front door (PRD 261): static, the same for every visitor, reading no
// cookie and no database. The game is at /play (app/play/page.tsx). Shared, it previews as the ad:
// its title, its description and the Open Graph image beside it (app/opengraph-image.tsx).
export const metadata: Metadata = HOME_METADATA;

export default function Page() {
  return <Home />;
}

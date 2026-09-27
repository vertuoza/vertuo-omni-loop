import { Home } from '../src/home/Home';

// `/` is HOME, the Omni Loop front door (PRD 261): static, the same for every visitor, reading no
// cookie and no database. The game is at /play (app/play/page.tsx).
export default function Page() {
  return <Home />;
}

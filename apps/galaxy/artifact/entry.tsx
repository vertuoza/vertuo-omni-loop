// The artifact build: the same arcade, bundled into one HTML page, playing the demo galaxy
// generated in the browser at load time (so ages and decay are always relative to "now"). Sign-in
// and GitHub are simulated by the demo account, which keeps the guest in this browser's storage; the
// guest borrows the demo world's highest XP, so the game room shows lit. Its planets carry the demo
// dossiers, with no link: there is no page to open, so the DOSSIER tab shows no OPEN hint.
// The page's styles come first, as app/layout.tsx imports them for the Next build; each scene
// group's follow with its text layer. It never embeds a knowledge base: its star chart says so.
import '../src/arcade/arcade.css';
import { createRoot } from 'react-dom/client';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf } from '@omni/galaxy';
import { ArcadeApp } from '../src/arcade/ArcadeApp';
import { demoAccount } from '../src/arcade/account-demo';
import { demoDossiers } from '../src/data/dossiers';
import { demoXp } from '../src/data/xp';

const now = new Date();
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const fleets = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, t]) => ({ name, ...lookOf(name, t) }))
  .sort((a, b) => a.sort - b.sort);
createRoot(document.getElementById('root')!).render(<ArcadeApp view={view} fleets={fleets} account={demoAccount()} knowledge="none" xp={demoXp(now)} dossiers={demoDossiers(now, { open: false })} />);

// The artifact build: the same arcade, bundled into one HTML page, playing the demo galaxy
// generated in the browser at load time (so ages and decay are always relative to "now"). Sign-in
// and GitHub are simulated by the demo account, which keeps the guest in this browser's storage.
import { createRoot } from 'react-dom/client';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf } from '@omni/galaxy';
import { ArcadeApp } from '../src/arcade/ArcadeApp';
import { demoAccount } from '../src/arcade/account-demo';

const now = new Date();
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const fleets = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, t]) => ({ name, ...lookOf(name, t) }))
  .sort((a, b) => a.sort - b.sort);
createRoot(document.getElementById('root')!).render(<ArcadeApp view={view} fleets={fleets} account={demoAccount()} />);

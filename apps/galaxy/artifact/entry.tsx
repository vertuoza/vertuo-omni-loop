// The artifact build: the same arcade, bundled into one HTML page, playing the demo galaxy
// generated in the browser at load time (so ages and decay are always relative to "now").
import { createRoot } from 'react-dom/client';
import { buildGalaxy, demoEvents, DEMO_PROJECTS } from '@omni/galaxy';
import { ArcadeApp } from '../src/arcade/ArcadeApp';

const now = new Date();
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
createRoot(document.getElementById('root')!).render(<ArcadeApp view={view} />);

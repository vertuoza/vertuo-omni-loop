// The engine page's entry (PRD 1108 s4): `pnpm kit:build` bundles it, with React, into
// `kit/dist/pitch-engine/engine.js`, which the page's `index.html` loads.
import { boot } from './boot.tsx';

const container = document.getElementById('root');
if (container !== null) void boot(window.location.href, container);

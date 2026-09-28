import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/switch/home.css';
import '../../src/dashboard/dashboard.css';
import { TOKENS } from '../../src/ask/theme-tokens';
import { AppShell } from '../../src/nav/AppShell';
import { viewerLive } from '../../src/nav/viewer';

// /app, the app's home (PRD 238), on the ask pages' reading surface, inside the app shell (PRD 438):
// the sidebar and the top bar around the page, drawn from the person looking (the viewer, read once
// per request). The page, your dashboard (PRD 328), reads per request too.

export const metadata: Metadata = {
  title: 'App · OMNI LOOP',
  description: 'Your Omni Loop dashboard: your hero, your fleet, your season, and the app’s questions and knowledge.',
  robots: { index: false, follow: false },
};

// One colour for the browser's bar, Omni's ground: this metadata is static and cannot read the stored
// choice, and Omni is the default (PRD 284).
export const viewport: Viewport = {
  themeColor: TOKENS.omni.ground,
  colorScheme: 'light dark',
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell viewer={await viewerLive()}>{children}</AppShell>;
}

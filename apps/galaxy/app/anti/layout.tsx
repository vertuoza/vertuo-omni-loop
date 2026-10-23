import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/switch/home.css';
import { TOKENS } from '../../src/ask/theme-tokens';
import { AppShell } from '../../src/nav/AppShell';
import { viewerLive } from '../../src/nav/viewer';

// /anti and /anti/work (PRD 2490): the anti-loop mode of the app shell, in Rewind Light. The URL is the
// mode; the viewer is read per request, as /app does.

export const metadata: Metadata = {
  title: 'Anti-loop · OMNI LOOP',
  description: 'The anti-loop: the tech team\'s harness, architecture and retros.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: TOKENS.omni.ground,
  colorScheme: 'light dark',
};

export default async function AntiLayout({ children }: { children: React.ReactNode }) {
  return <AppShell viewer={await viewerLive()} mode="anti">{children}</AppShell>;
}

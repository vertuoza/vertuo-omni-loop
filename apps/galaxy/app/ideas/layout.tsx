import type { Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/switch/home.css';
import '../../src/ideas/ideas.css';
import { TOKENS } from '../../src/ask/theme-tokens';
import { IdeasFrame } from '../../src/ideas/IdeasFrame';
import { viewerLive } from '../../src/nav/viewer';

// /ideas/<owner>/<repo> (PRD 1246, s1), public, on the ask pages' reading surface exactly as /releases
// is: their tokens as CSS custom properties, their faces from @omni/design's fonts.css, and their theme
// script as the root's first child, so the stored theme is applied before the first paint. A signed-in
// person keeps the app shell, the sidebar with Ideas marked current; a visitor gets the app's one top bar,
// its sub-title Ideas (issue 1996, src/ideas/IdeasFrame.tsx). Each board's title and preview are its
// page's own metadata (./[owner]/[repo]/page.tsx).

export const viewport: Viewport = {
  themeColor: TOKENS.omni.ground,
  colorScheme: 'light dark',
};

export default async function IdeasLayout({ children }: { children: React.ReactNode }) {
  return <IdeasFrame viewer={await viewerLive()}>{children}</IdeasFrame>;
}

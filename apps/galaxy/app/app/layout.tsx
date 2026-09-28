import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/switch/home.css';
import '../../src/dashboard/dashboard.css';
import { ThemeScript } from '../../src/ask/theme-script';
import { TOKENS, themeCss } from '../../src/ask/theme-tokens';
import { TopBar } from '../../src/nav/TopBar';
import { HOME } from '../../src/switch/switch';

// /app, the app's home (PRD 238), on the ask pages' reading surface: their tokens as CSS custom
// properties, their faces from @omni/design's fonts.css, and their theme script as the root's first
// child, so the stored theme is applied before the first paint. The layout itself reads nothing (no
// session, no cookie, no database); the page, your dashboard (PRD 328), reads per request. The header
// is the app's one top bar (TopBar, PRD 346): the OMNI LOOP mark, a link home, then Release notes,
// Docs, the theme switch and Game mode.

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      {/* The script marks this root with the theme before anything in it is parsed; React leaves
          those two attributes alone. */}
      <div className="ask" suppressHydrationWarning>
        <ThemeScript />
        <TopBar sub={HOME.sub} />
        <main className="ask-main">{children}</main>
      </div>
    </>
  );
}

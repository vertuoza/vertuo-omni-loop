import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/switch/home.css';
import '../../src/releases/page/releases.css';
import { ThemeScript } from '../../src/ask/theme-script';
import { TOKENS, themeCss } from '../../src/ask/theme-tokens';
import { TopBar } from '../../src/nav/TopBar';
import { RELEASES_URL } from '../../src/releases/page/address';
import { RELEASES } from '../../src/releases/words';

// /releases (PRD 262), public and indexed, on the ask pages' reading surface exactly as /app is: their
// tokens as CSS custom properties, their faces from @omni/design's fonts.css, and their theme script
// as the root's first child, so the stored theme is applied before the first paint. The header is the
// app's one top bar (TopBar, PRD 346): the OMNI LOOP mark, a link to the app's home, the sub-title
// Releases, then Release notes, marked current, the theme switch and Game mode. No robots rule: search engines may index it, and link previews read its Open Graph.

export const metadata: Metadata = {
  title: RELEASES.title,
  description: RELEASES.description,
  alternates: { canonical: RELEASES_URL },
  openGraph: {
    type: 'website',
    url: RELEASES_URL,
    siteName: 'Omni Loop',
    title: RELEASES.title,
    description: RELEASES.description,
  },
};

// One colour for the browser's bar, Omni's ground: this metadata is static and cannot read the stored
// choice, and Omni is the default (PRD 284).
export const viewport: Viewport = {
  themeColor: TOKENS.omni.ground,
  colorScheme: 'light dark',
};

export default function ReleasesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      {/* The script marks this root with the theme before anything in it is parsed; React leaves
          those two attributes alone. */}
      <div className="ask" suppressHydrationWarning>
        <ThemeScript />
        <TopBar sub={RELEASES.sub} current="releases" />
        <main className="ask-main">{children}</main>
      </div>
    </>
  );
}

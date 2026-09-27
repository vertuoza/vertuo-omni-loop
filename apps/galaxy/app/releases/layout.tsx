import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/switch/home.css';
import '../../src/releases/page/releases.css';
import { ThemeScript } from '../../src/ask/theme-script';
import { ThemeSwitch } from '../../src/ask/theme-switch';
import { TOKENS, themeCss } from '../../src/ask/theme-tokens';
import { RELEASES_URL } from '../../src/releases/page/address';
import { RELEASES } from '../../src/releases/words';
import { GameModeButton } from '../../src/switch/GameModeButton';
import { APP_HOME } from '../../src/switch/switch';

// /releases (PRD 262), public and indexed, on the ask pages' reading surface exactly as /app is: their
// tokens as CSS custom properties, their faces from @omni/design's fonts.css, and their theme script
// as the root's first child, so the stored theme is applied before the first paint. The header is the
// app bar: the OMNI LOOP mark, a link to the app's home, the sub-title Releases, then the theme switch,
// then Game mode. No robots rule: search engines may index it, and link previews read its Open Graph.

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

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: TOKENS.light.ground },
    { media: '(prefers-color-scheme: dark)', color: TOKENS.dark.ground },
  ],
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
        <header className="ask-bar">
          <span className="ask-brand">
            <a className="ask-mark" href={APP_HOME}>OMNI LOOP</a>
            <span className="ask-brand-sub">{RELEASES.sub}</span>
          </span>
          <div className="app-bar-end">
            <ThemeSwitch />
            <GameModeButton />
          </div>
        </header>
        <main className="ask-main">{children}</main>
      </div>
    </>
  );
}

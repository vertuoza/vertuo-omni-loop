import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/switch/home.css';
import { ThemeScript } from '../../src/ask/theme-script';
import { ThemeSwitch } from '../../src/ask/theme-switch';
import { TOKENS, themeCss } from '../../src/ask/theme-tokens';
import { GameModeButton } from '../../src/switch/GameModeButton';
import { APP_HOME, HOME } from '../../src/switch/switch';

// /app, the app's home (PRD 238), on the ask pages' reading surface: their tokens as CSS custom
// properties, their faces from @omni/design's fonts.css, and their theme script as the root's first
// child, so the stored theme is applied before the first paint. It reads nothing (no session, no
// cookie, no database), so it renders once, at build time. The header is the app bar: the OMNI LOOP
// mark, a link home, then the theme switch, then Game mode.

export const metadata: Metadata = {
  title: 'App · OMNI LOOP',
  description: 'The Omni Loop app: its questions and its knowledge, as pages.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: TOKENS.light.ground },
    { media: '(prefers-color-scheme: dark)', color: TOKENS.dark.ground },
  ],
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
        <header className="ask-bar">
          <span className="ask-brand">
            <a className="ask-mark" href={APP_HOME}>OMNI LOOP</a>
            <span className="ask-brand-sub">{HOME.sub}</span>
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

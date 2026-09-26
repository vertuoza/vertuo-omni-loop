import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import { ThemeScript } from '../../src/ask/theme-script';
import { ThemeSwitch } from '../../src/ask/theme-switch';
import { TOKENS, themeCss } from '../../src/ask/theme-tokens';

// Every /ask page: a reading surface apart from the arcade. The tokens come first as CSS custom
// properties; the theme script is the ask root's first child, so it marks the root with the stored
// theme before anything in it is parsed, and before the first paint. The faces, all from
// @omni/design's fonts.css and served from this origin: Atkinson Hyperlegible Next to read,
// JetBrains Mono for previews, and the pixel face for the wordmark only.

export const metadata: Metadata = {
  title: 'Ask · OMNI LOOP',
  description: 'Claude’s questions, on a page made for reading.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: TOKENS.light.ground },
    { media: '(prefers-color-scheme: dark)', color: TOKENS.dark.ground },
  ],
  colorScheme: 'light dark',
};

export default function AskLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      {/* The script marks this root with the theme before anything in it is parsed; React leaves
          those two attributes alone. */}
      <div className="ask" suppressHydrationWarning>
        <ThemeScript />
        <header className="ask-bar">
          <span className="ask-brand">
            <span className="ask-mark">OMNI LOOP</span>
            <span className="ask-brand-sub">Claude asks</span>
          </span>
          <ThemeSwitch />
        </header>
        <main className="ask-main">{children}</main>
      </div>
    </>
  );
}

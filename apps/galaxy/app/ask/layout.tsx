import type { Metadata, Viewport } from 'next';
import '../../src/ask/ask.css';
import { themeScript } from '../../src/ask/theme';
import { ThemeSwitch } from '../../src/ask/theme-switch';
import { TOKENS, themeCss } from '../../src/ask/theme-tokens';

// Every /ask page: a reading surface apart from the arcade. The tokens come first as CSS custom
// properties; the theme script is the ask root's first child, so it marks the root with the stored
// theme before anything in it is parsed, and before the first paint. The faces: Atkinson
// Hyperlegible Next to read, JetBrains Mono for previews; the pixel face, loaded by the root
// layout, is for the wordmark only.

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

const FACES =
  'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap';

export default function AskLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      <link rel="stylesheet" href={FACES} precedence="default" />
      {/* The script marks this root with the theme before anything in it is parsed; React leaves
          those two attributes alone. */}
      <div className="ask" suppressHydrationWarning>
        <script
          type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
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

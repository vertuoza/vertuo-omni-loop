import type { Metadata, Viewport } from 'next';
import '../../src/ask/ask.css';
import { themeScript } from '../../src/ask/theme';
import { ThemeSwitch } from '../../src/ask/theme-switch';
import { TOKENS, themeCss } from '../../src/ask/theme-tokens';

// Every /ask page: a reading surface apart from the arcade. The theme script runs first, before
// anything below it is parsed, so the stored theme is applied before the first paint; the tokens
// follow as CSS custom properties, then the faces (Atkinson Hyperlegible Next to read, JetBrains
// Mono for previews; the pixel face, loaded by the root layout, is for the wordmark only).

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
      <script
        type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: themeScript }}
      />
      <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      <link rel="stylesheet" href={FACES} precedence="default" />
      <div className="ask">
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

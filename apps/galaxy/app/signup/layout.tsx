import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/signup/signup.css';
import { ThemeScript } from '../../src/ask/theme-script';
import { TOKENS, themeCss } from '../../src/ask/theme-tokens';

// /signup (PRD 359), on the ask pages' reading surface: their tokens as CSS custom properties, their
// faces (from @omni/design's fonts.css, served from this origin), and their theme script as the root's
// first child, so the stored theme is applied before the first paint.

export const metadata: Metadata = {
  title: 'Sign up · OMNI LOOP',
  description: 'Install Omni Loop on your GitHub org, and land in its workspace.',
  robots: { index: false, follow: false },
};

// One colour for the browser's bar, Omni's ground: this metadata is static and cannot read the stored
// choice, and Omni is the default (PRD 284).
export const viewport: Viewport = {
  themeColor: TOKENS.omni.ground,
  colorScheme: 'light dark',
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      {/* The script marks this root with the theme before anything in it is parsed; React leaves
          those two attributes alone. */}
      <div className="ask" suppressHydrationWarning>
        <ThemeScript />
        <main className="ask-main">{children}</main>
      </div>
    </>
  );
}

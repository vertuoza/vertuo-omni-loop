import type { Metadata, Viewport } from 'next';
import '@omni/design/fonts.css';
import '../../src/ask/ask.css';
import '../../src/signup/signup.css';
import { TOKENS } from '../../src/ask/theme-tokens';
import { Doorway } from '../../src/doorway/Doorway';

// /signup (PRD 359), in the doorway (PRD 1705): the frame of the pages a person meets before they are
// inside the app, on the ask pages' reading surface, with their faces (from @omni/design's fonts.css,
// served from this origin). The doorway writes the tokens and the theme script.

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
  return <Doorway>{children}</Doorway>;
}

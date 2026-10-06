import type { Metadata, Viewport } from 'next';
import { OMNI_LOOP } from '@omni/design';
import { SITE } from '../src/releases/page/address';
// The faces come from @omni/design, served from this origin: no third-party font request.
import '@omni/design/fonts.css';
import '../src/arcade/arcade.css';

// Every relative address a page's metadata names (its Open Graph image's among them) resolves on the
// site's one address, whichever host served the page (PRD 983).
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: OMNI_LOOP.name.toUpperCase(),
  description: 'The galaxy map of the Omni Loop game: every PRD is a planet the fleets terraform together.',
};

// The phone is the Game Boy: edge to edge (the bodies keep the notch and the home indicator clear
// with the safe-area insets), and never zoomed by a pinch or a double tap.
export const viewport: Viewport = {
  themeColor: OMNI_LOOP.themeColor, viewportFit: 'cover', width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

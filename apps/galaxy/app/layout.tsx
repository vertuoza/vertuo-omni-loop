import type { Metadata, Viewport } from 'next';
// The faces come from @omni/design, served from this origin: no third-party font request.
import '@omni/design/fonts.css';
import '../src/arcade/arcade.css';

export const metadata: Metadata = {
  title: 'OMNI LOOP',
  description: 'The galaxy map of the Omni Loop game: every PRD is a planet the fleets terraform together.',
};

// The phone is the Game Boy: edge to edge (the bodies keep the notch and the home indicator clear
// with the safe-area insets), and never zoomed by a pinch or a double tap.
export const viewport: Viewport = {
  themeColor: '#07061c', viewportFit: 'cover', width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

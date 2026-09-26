import type { Metadata, Viewport } from 'next';
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jersey+10&family=Press+Start+2P&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}

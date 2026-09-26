import type { Metadata, Viewport } from 'next';
import { OMNI_LOOP } from '@omni/design';
import '../../src/design/design.css';

// /design, on the arcade's dark ground (tokens.css and fonts.css come with the root layout), with
// its own stylesheet, scoped to `.ds`, which lets the page scroll.

export const metadata: Metadata = {
  title: `Design system · ${OMNI_LOOP.name.toUpperCase()}`,
  description: `The ${OMNI_LOOP.name} design system: the logo, the colours, the type and every sprite, drawn from @omni/design.`,
};

export const viewport: Viewport = { themeColor: OMNI_LOOP.themeColor, colorScheme: 'dark' };

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

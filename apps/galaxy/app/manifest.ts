import type { MetadataRoute } from 'next';
import { INK, OMNI_LOOP } from '@omni/design';

// The Omni page's web manifest (PRD 1322 s9): it makes the page installable, so a phone can add it to
// its home screen, which an iPhone needs before it takes Web Push (iOS 16.4 and later). It opens on
// the app, standalone, in the arcade's void, with the crest (app/icon.ts) as its icon.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: OMNI_LOOP.name,
    short_name: OMNI_LOOP.name,
    description: 'Your PRDs, your fleet and the approvals that wait for you.',
    id: '/app',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: INK.void,
    theme_color: OMNI_LOOP.themeColor,
    icons: [{ src: '/icon', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}

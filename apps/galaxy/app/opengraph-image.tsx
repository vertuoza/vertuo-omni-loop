// HOME's Open Graph image (PRD 261): the card a shared link to `/` previews with, the crest and JOIN
// THE LOOP! on the starfield. Drawn once at build time from src/home/share.tsx.
import { ImageResponse } from 'next/og';
import { SHARE_CARD, shareCard } from '../src/home/share';

export const alt = SHARE_CARD.alt;
export const size = { width: SHARE_CARD.width, height: SHARE_CARD.height };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(shareCard(), size);
}

// The favicon: the Omni Loop crest's own 16×16 drawing, from @omni/design, as a crisp SVG.
import { logoSvg, OMNI_LOOP } from '@omni/design';

export const size = { width: 16, height: 16 };
export const contentType = 'image/svg+xml';

export default function Icon() {
  return new Response(logoSvg(OMNI_LOOP.icon), { headers: { 'Content-Type': contentType } });
}

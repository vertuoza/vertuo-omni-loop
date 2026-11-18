import { Badge } from './Badge.tsx';
import { BADGE_TONES } from './Badge.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Badge in each tone. */
export const badgeSpecimen: Specimen = (_prop, value) => <Badge tone={one(BADGE_TONES, value)}>Draft</Badge>;

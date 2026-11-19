import { Tag } from './Tag.tsx';
import { TAG_TONES } from './Tag.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Tag in each tone. */
export const tagSpecimen: Specimen = (_prop, value) => <Tag tone={one(TAG_TONES, value)}>backend</Tag>;

import { Stat } from './Stat.tsx';
import { STAT_SIZES } from './Stat.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Stat in each size. */
export const statSpecimen: Specimen = (_prop, value) => <Stat label="Open PRDs" value={12} hint="this week" size={one(STAT_SIZES, value)} />;

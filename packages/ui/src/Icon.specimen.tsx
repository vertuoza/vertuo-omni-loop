import { Icon } from './Icon.tsx';
import { ICON_SIZES } from './Icon.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** The home icon at each size. */
export const iconSpecimen: Specimen = (_prop, value) => <Icon name="home" size={one(ICON_SIZES, value)} label="Home" />;

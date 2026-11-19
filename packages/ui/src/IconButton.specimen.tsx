import { IconButton } from './IconButton.tsx';
import { ICON_BUTTON_VARIANTS } from './IconButton.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** An IconButton in each variant, enabled and disabled. */
export const iconButtonSpecimen: Specimen = (prop, value) => (
  <IconButton
    icon="search"
    label="Search"
    {...(prop === 'variant' ? { variant: one(ICON_BUTTON_VARIANTS, value) } : {})}
    disabled={prop === 'disabled' && value === 'true'}
  />
);

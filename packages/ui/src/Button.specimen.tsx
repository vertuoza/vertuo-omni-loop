import { Button } from './Button.tsx';
import { BUTTON_SIZES, BUTTON_VARIANTS } from './Button.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Button in each variant, at each size, enabled and disabled. */
export const buttonSpecimen: Specimen = (prop, value) => (
  <Button
    {...(prop === 'variant' ? { variant: one(BUTTON_VARIANTS, value) } : {})}
    {...(prop === 'size' ? { size: one(BUTTON_SIZES, value) } : {})}
    disabled={prop === 'disabled' && value === 'true'}
  >
    Approve
  </Button>
);
